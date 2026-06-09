import { env } from '../config/env.js';
import { OrgFaq } from '../models/OrgFaq.js';
import { buildFaqText, embedFaq, embedTexts } from './embeddingService.js';
import { generateWithOllama } from './ollamaService.js';

// Per-org in-memory cache: { [orgId]: [{ ...faq, id }] }
const orgKnowledgeBases = new Map();

function dotProduct(left, right) {
  const length = Math.min(left.length, right.length);
  let score = 0;
  for (let i = 0; i < length; i++) score += left[i] * right[i];
  return score;
}

function uniqueByQuestion(results) {
  const seen = new Set();
  return results.filter(({ faq }) => {
    const key = faq.question.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getOrgKnowledgeBase(orgId) {
  const key = String(orgId);
  if (orgKnowledgeBases.has(key)) return orgKnowledgeBases.get(key);

  const faqs = await OrgFaq.find({
    orgId,
    isActive: true,
    embedding: { $exists: true, $ne: [] },
  }).lean();

  const kb = faqs.map((faq) => ({ ...faq, id: String(faq._id) }));
  orgKnowledgeBases.set(key, kb);
  return kb;
}

export function invalidateOrgRetriever(orgId) {
  orgKnowledgeBases.delete(String(orgId));
}

export async function embedAndSaveOrgFaq(faq) {
  const embedding = await embedFaq(faq);
  faq.embedding = embedding;
  await faq.save();
  invalidateOrgRetriever(faq.orgId);
  return faq;
}

export async function retrieveOrgContext(orgId, query) {
  const [queryEmbedding] = await embedTexts([query]);
  const kb = await getOrgKnowledgeBase(orgId);

  const ranked = kb
    .filter((faq) => Array.isArray(faq.embedding) && faq.embedding.length > 0)
    .map((faq) => ({ faq, score: dotProduct(queryEmbedding, faq.embedding) }))
    .sort((a, b) => b.score - a.score);

  return uniqueByQuestion(ranked).slice(0, env.topK);
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

function isNotEnoughInformationAnswer(answer) {
  const normalizedAnswer = String(answer || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  return normalizedAnswer === 'i do not have enough information in the faq knowledge base to answer that.';
}

function isFaqAnswer(answer) {
  return !isNotEnoughInformationAnswer(answer);
}

export async function answerOrgQuestion(orgId, query) {
  const normalizedQuery = String(query || '').trim();

  if (!normalizedQuery) {
    return { answer: 'Please enter a question.', answerFound: false, confidence: 0, sources: [] };
  }

  const results = await retrieveOrgContext(orgId, normalizedQuery);
  const bestScore = results[0]?.score || 0;
  const answerFound = bestScore >= env.minConfidence;

  if (results.length === 0) {
    return {
      answer:      'No FAQs found for this organisation yet.',
      answerFound: false,
      confidence:  0,
      sources:     [],
    };
  }

  if (!answerFound) {
    return {
      answer:      "I don't have enough information in this organisation's FAQs to answer that.",
      answerFound: false,
      confidence:  bestScore,
      sources:     results.map(toSource),
    };
  }

  const answer = await generateWithOllama({
    query: normalizedQuery,
    contexts: results.map(toContext),
    bestscore: bestScore,
  });

  return {
    answer,
    answerFound: isFaqAnswer(answer),
    confidence: bestScore,
    sources: results.map(toSource),
  };
}
