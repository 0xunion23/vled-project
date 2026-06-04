import { env } from "../config/env.js";
import { Faq } from "../models/Faq.js";
import { buildFaqText, embedFaq, embedTexts } from "./embeddingService.js";
import { generateWithOllama, validateWithOllama } from "./ollamaService.js";
import { trackQuestion } from './mostAskedService.js';

let cachedKnowledgeBase = null;

function dotProduct(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return 0;
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
  if (cachedKnowledgeBase) return cachedKnowledgeBase;
  const faqs = await Faq.find({
    isActive: true,
    embedding: { $exists: true, $ne: [] },
  }).lean();
  cachedKnowledgeBase = faqs.map((faq) => ({ ...faq, id: String(faq._id) }));
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

// ── Vector retrieval (original, unchanged) ────────────────────────────────────
async function vectorRetrieve(query) {
  const [queryEmbedding] = await embedTexts([query]);
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) return [];
  const knowledgeBase = await getKnowledgeBase();
  return knowledgeBase
    .filter((faq) => Array.isArray(faq.embedding) && faq.embedding.length > 0)
    .map((faq) => ({ faq, score: dotProduct(queryEmbedding, faq.embedding) }))
    .sort((a, b) => b.score - a.score);
}

// ── Keyword retrieval via MongoDB $text index ─────────────────────────────────
// The Faq model already has: faqSchema.index({ question:'text', answer:'text', category:'text', tags:'text' })
// We use it here for the first time.
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
    // Text index may not exist in test environments — gracefully return empty
    return [];
  }
}

// ── Reciprocal Rank Fusion ────────────────────────────────────────────────────
// Merges two ranked lists into a single combined ranking.
// RRF(d) = Σ 1 / (k + rank_i(d))   where k=60 is standard
// Higher combined score = more relevant in both lists.
function reciprocalRankFusion(vectorResults, keywordResults, k = 60) {
  const scores = new Map(); // faq._id → { faq, rrfScore }

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

// ── Hybrid retrieval — vector + keyword merged with RRF ───────────────────────
export async function retrieveContext(query) {
  // Run both retrievers in parallel
  const [vectorResults, keywordResults] = await Promise.all([
    vectorRetrieve(query),
    keywordRetrieve(query),
  ]);

  // Merge with Reciprocal Rank Fusion
  const merged = reciprocalRankFusion(vectorResults, keywordResults);

  return uniqueByQuestion(merged).slice(0, env.topK);
}

function toSource(result) {
  return {
    id:       result.faq.id,
    question: result.faq.question,
    category: result.faq.category,
    score:    Number(result.score.toFixed(4)),
  };
}

function toContext(result) {
  return {
    question: result.faq.question,
    answer:   result.faq.answer,
    category: result.faq.category,
    text:     buildFaqText(result.faq),
    score:    result.score,
  };
}

// ── answerQuestion — unchanged interface ──────────────────────────────────────
export async function answerQuestion(query) {
  const normalizedQuery = String(query || "").trim();

  if (!normalizedQuery) {
    return { answer: "Please enter a question.", answerFound: false, confidence: 0, sources: [] };
  }

  await trackQuestion(normalizedQuery);

  const results = await retrieveContext(normalizedQuery);
  const bestScore = results[0]?.score || 0;
  const answerFound = bestScore >= env.minConfidence;
  console.log(bestScore);

  if (results.length === 0) {
    return {
      answer: "No indexed FAQ knowledge base has been loaded yet. Seed or add FAQs, then run reindexing.",
      answerFound: false, confidence: 0, sources: [],
    };
  }

  const contexts = results.map(toContext);

  if (!answerFound) {
    const answer = await validateWithOllama({ query: normalizedQuery, contexts });
    if (answer.toLowerCase() === "valid") {
      return {
        answer: "I don't have enough information in the FAQ knowledge base to answer that.",
        answerFound: false, confidence: bestScore, sources: results.map(toSource),
      };
    } else {
      return { answer, answerFound: true, confidence: bestScore, sources: results.map(toSource) };
    }
  }

  const answer = await generateWithOllama({ query: normalizedQuery, contexts });
  return { answer, answerFound: true, confidence: bestScore, sources: results.map(toSource) };
}
