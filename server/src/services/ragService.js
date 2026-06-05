import { env } from "../config/env.js";
import { Faq } from "../models/Faq.js";
import { buildFaqText, embedFaq, embedTexts } from "./embeddingService.js";
import { generateWithOllama, validateWithOllama } from "./ollamaService.js";
import { trackQuestion } from './mostAskedService.js';

let cachedKnowledgeBase = null;

function dotProduct(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) {
    return 0;
  }
  const length = Math.min(left.length, right.length);
  let score = 0;
  for (let index = 0; index < length; index += 1) {
    score += left[index] * right[index];
  }
  return score;
}

function uniqueByQuestion(results) {
  const seen = new Set();
  const uniqueResults = [];
  for (const result of results) {
    const key = result.faq.question.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(result);
    }
  }
  return uniqueResults;
}

async function getKnowledgeBase() {
  if (cachedKnowledgeBase) {
    return cachedKnowledgeBase;
  }
  const faqs = await Faq.find({
    isActive: true,
    embedding: { $exists: true, $ne: [] },
  }).lean();
  cachedKnowledgeBase = faqs.map((faq) => ({
    ...faq,
    id: String(faq._id),
  }));
  return cachedKnowledgeBase;
}

export function invalidateRetriever() {
  cachedKnowledgeBase = null;
}

export async function embedAndSaveFaq(faq) {
  const embedding = await embedFaq(faq);
  faq.embedding = embedding;
  await faq.save();
  invalidateRetriever();
  return faq;
}

export async function reindexFaqs() {
  const faqs = await Faq.find({ isActive: true });
  for (const faq of faqs) {
    faq.embedding = await embedFaq(faq);
    await faq.save();
  }
  invalidateRetriever();
  return faqs.length;
}

// ── Vector retrieval (original logic, extracted into own function) ─────────────
async function vectorRetrieve(query) {
  const [queryEmbedding] = await embedTexts([query]);
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    return [];
  }
  const knowledgeBase = await getKnowledgeBase();
  return knowledgeBase
    .filter((faq) => Array.isArray(faq.embedding) && faq.embedding.length > 0)
    .map((faq) => ({ faq, score: dotProduct(queryEmbedding, faq.embedding) }))
    .sort((left, right) => right.score - left.score);
}

// ── Keyword retrieval via MongoDB $text index ─────────────────────────────────
// The Faq model already has: faqSchema.index({ question:'text', answer:'text',
// category:'text', tags:'text' }) — this function uses it for the first time.
async function keywordRetrieve(query) {
  try {
    const docs = await Faq.find(
      { $text: { $search: query }, isActive: true },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .lean();
    return docs.map((faq) => ({
      faq: { ...faq, id: String(faq._id) },
      score: faq.score || 0,
    }));
  } catch {
    // Gracefully degrade if text index not available
    return [];
  }
}

// ── Reciprocal Rank Fusion ────────────────────────────────────────────────────
// Standard IR technique for merging two ranked lists.
// RRF(d) = Σ 1/(k + rank_i(d))  where k=60 is the standard constant.
// Items appearing high in both lists get the highest combined score.
function reciprocalRankFusion(vectorResults, keywordResults, k = 60) {
  const scores = new Map();
  vectorResults.forEach((result, rank) => {
    const id = String(result.faq._id || result.faq.id);
    const prev = scores.get(id) || { faq: result.faq, rrfScore: 0 };
    scores.set(id, { faq: prev.faq, rrfScore: prev.rrfScore + 1 / (k + rank + 1) });
  });
  keywordResults.forEach((result, rank) => {
    const id = String(result.faq._id || result.faq.id);
    const prev = scores.get(id) || { faq: result.faq, rrfScore: 0 };
    scores.set(id, { faq: prev.faq, rrfScore: prev.rrfScore + 1 / (k + rank + 1) });
  });
  return Array.from(scores.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map(({ faq, rrfScore }) => ({ faq, score: rrfScore }));
}

// ── Hybrid retrieval — replaces original retrieveContext ─────────────────────
export async function retrieveContext(query) {
  const [vectorResults, keywordResults] = await Promise.all([
    vectorRetrieve(query),
    keywordRetrieve(query),
  ]);
  const merged = reciprocalRankFusion(vectorResults, keywordResults);
  return uniqueByQuestion(merged).slice(0, env.topK);
}

function toSource(result) {
  return {
    id: result.faq.id,
    question: result.faq.question,
    category: result.faq.category,
    score: Number(result.score.toFixed(4)),
  };
}

function toContext(result) {
  return {
    question: result.faq.question,
    answer: result.faq.answer,
    category: result.faq.category,
    text: buildFaqText(result.faq),
    score: result.score,
  };
}

// ── All helper functions below are original — untouched ───────────────────────
function getQueryWordCount(query) {
  return String(query)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

function getMinConfidenceForQuery(query) {
  const wordCount = getQueryWordCount(query);
  const baseConfidence = env.minConfidence;
  if (wordCount <= 1) return Math.max(baseConfidence, 0.78);
  if (wordCount <= 2) return Math.max(baseConfidence, 0.72);
  if (wordCount <= 4) return Math.max(baseConfidence, 0.62);
  if (wordCount >= 10) return Math.max(0.45, baseConfidence - 0.05);
  return baseConfidence;
}

function isNotEnoughInformationAnswer(answer) {
  return String(answer || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .includes("i do not have enough information in the faq knowledge base to answer that");
}

function isFaqAnswer(answer) {
  return !isNotEnoughInformationAnswer(answer);
}

// ── answerQuestion — original logic, completely unchanged ─────────────────────
export async function answerQuestion(query) {
  const normalizedQuery = String(query || "").trim();

  if (!normalizedQuery) {
    return {
      answer: "Please enter a question.",
      answerFound: false,
      confidence: 0,
      sources: [],
    };
  }

  await trackQuestion(normalizedQuery);

  const results = await retrieveContext(normalizedQuery);
  const bestScore = results[0]?.score || 0;
  const minConfidence = getMinConfidenceForQuery(normalizedQuery);
  const answerFound = bestScore >= minConfidence;
  console.log(bestScore);
  if (results.length === 0) {
    return {
      answer:
        "No indexed FAQ knowledge base has been loaded yet. Seed or add FAQs, then run reindexing.",
      answerFound: false,
      confidence: 0,
      sources: [],
    };
  }
  const contexts = results.map(toContext);
  if (!answerFound) {
    const answer = await validateWithOllama({ query: normalizedQuery, contexts });
    if (answer.toLowerCase() === "valid") {
      return {
        answer:
          "I don't have enough information in the FAQ knowledge base to answer that.",
        answerFound: false,
        confidence: bestScore,
        sources: results.map(toSource),
      };
    } else {
      return {
        answer,
        answerFound: isFaqAnswer(answer),
        confidence: bestScore,
        sources: results.map(toSource),
      };
    }
  }
  const answer = await generateWithOllama({
    query: normalizedQuery,
    contexts,
    bestscore: bestScore,
  });

  return {
    answer,
    answerFound: isFaqAnswer(answer),
    confidence: bestScore,
    sources: results.map(toSource),
  };
}
