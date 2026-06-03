import { env } from "../config/env.js";
import { Faq } from "../models/Faq.js";
import { buildFaqText, embedFaq, embedTexts } from "./embeddingService.js";
import { generateWithOllama, validateWithOllama } from "./ollamaService.js";
import { PendingQuestion } from "../models/PendingQuestion.js";
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

export async function retrieveContext(query) {
  const [queryEmbedding] = await embedTexts([query]);
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    return [];
  }

  const knowledgeBase = await getKnowledgeBase();

  const ranked = knowledgeBase
    .filter((faq) => Array.isArray(faq.embedding) && faq.embedding.length > 0)
    .map((faq) => ({
      faq,
      score: dotProduct(queryEmbedding, faq.embedding),
    }))
    .sort((left, right) => right.score - left.score);

  return uniqueByQuestion(ranked).slice(0, env.topK);
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

export async function answerQuestion(query) {
  const normalizedQuery = String(query || "").trim();
const [queryEmbedding] =
await embedTexts([normalizedQuery]);
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
  const answerFound = bestScore >= env.minConfidence;
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

  const duplicate =
    await findDuplicateQuestion(
      queryEmbedding
    );

  if (duplicate) {
    return {
      answer:
        `A similar question is already under review: "${duplicate.match.question}"`,
      answerFound: false,
      duplicateFound: true,
      confidence: duplicate.score,
      sources: []
    };
  }

  await PendingQuestion.create({
    question: normalizedQuery,
    embedding: queryEmbedding,
    status: "pending"
  });

  return {
    answer:
      "Your question has been submitted for review.",
    answerFound: false,
    ticketCreated: true,
    confidence: bestScore,
    sources: []
  };
}
  const answer = await generateWithOllama({
    query: normalizedQuery,
    contexts,
  });

  return {
    answer,
    answerFound: true,
    confidence: bestScore,
    sources: results.map(toSource),
  };
}
async function findDuplicateQuestion(
  queryEmbedding,
  threshold = 0.85
) {
  const pendingQuestions =
    await PendingQuestion.find({
      status: "pending"
    });

  let bestMatch = null;
  let bestScore = 0;

  for (const question of pendingQuestions) {
    const score = dotProduct(
      queryEmbedding,
      question.embedding
    );

    if (score > bestScore) {
      bestScore = score;
      bestMatch = question;
    }
  }

  if (
    bestMatch &&
    bestScore >= threshold
  ) {
    return {
      match: bestMatch,
      score: bestScore
    };
  }

  return null;
}