import { env } from "../config/env.js";
import { Escalation } from "../models/Escalation.js";
import { Faq } from "../models/Faq.js";
import { QueryLog } from "../models/QueryLog.js";
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
    embedding: { $exists: true, $ne: [] }
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

export async function retrieveContext(query) {
  const [queryEmbedding] = await embedTexts([query]);
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) return [];

  const knowledgeBase = await getKnowledgeBase();
  const ranked = knowledgeBase
    .filter((faq) => Array.isArray(faq.embedding) && faq.embedding.length > 0)
    .map((faq) => ({ faq, score: dotProduct(queryEmbedding, faq.embedding) }))
    .sort((left, right) => right.score - left.score);

  return uniqueByQuestion(ranked).slice(0, env.topK);
}

function toSource(result) {
  return {
    id: result.faq.id,
    question: result.faq.question,
    category: result.faq.category,
    score: Number(result.score.toFixed(4))
  };
}

function toContext(result) {
  return {
    question: result.faq.question,
    answer: result.faq.answer,
    category: result.faq.category,
    text: buildFaqText(result.faq),
    score: result.score
  };
}

export async function answerQuestion(query, sessionId = '') {
  const normalizedQuery = String(query || '').trim();

  if (!normalizedQuery) {
    return { answer: 'Please enter a question.', answerFound: false, confidence: 0, sources: [] };
  }

  // Track for most-asked analytics (peers' feature)
  await trackQuestion(normalizedQuery);

  const results = await retrieveContext(normalizedQuery);
  const bestScore = results[0]?.score || 0;
  const secondScore = results[1]?.score || 0;
  const scoreGap = bestScore - secondScore;

  // A strong match needs both high score AND a clear gap over the second result
  const answerFound = bestScore >= env.minConfidence && scoreGap >= 0.03;

  if (results.length === 0) {
    return {
      answer: 'No indexed FAQ knowledge base has been loaded yet. Seed or add FAQs, then run reindexing.',
      answerFound: false,
      confidence: 0,
      sources: []
    };
  }

  const contexts = results.map(toContext);

  if (!answerFound) {
    const isRelevant = bestScore >= env.minEscalation && scoreGap >= 0.02;

    if (isRelevant) {
      // Escalate — relevant but no confident match in KB
      await Promise.all([
        Escalation.create({ question: normalizedQuery, confidence: bestScore, sources: results.map(toSource), sessionId: sessionId || '' }),
        QueryLog.create({ question: normalizedQuery, confidence: bestScore, answerFound: false, escalated: true })
      ]);
      return {
        answer: "I couldn't find a confident answer in the FAQ knowledge base. Your question has been escalated and the team will follow up.",
        answerFound: false, escalated: true, confidence: bestScore, sources: results.map(toSource)
      };
    }

    // Off-topic
    await QueryLog.create({ question: normalizedQuery, confidence: bestScore, answerFound: false, escalated: false });
    return {
      answer: "Your question doesn't appear to be related to the Vicharanashala internship. Please ask something about the internship program.",
      answerFound: false, escalated: false, confidence: bestScore, sources: []
    };
  }

  const answer = await generateWithOllama({ query: normalizedQuery, contexts });

  await QueryLog.create({ question: normalizedQuery, confidence: bestScore, answerFound: true, escalated: false });

  return { answer, answerFound: true, escalated: false, confidence: bestScore, sources: results.map(toSource) };
}
