import { env } from "../config/env.js";
import { DuplicateQuestion } from "../models/DuplicateQuestion.js";
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

function getQueryWordCount(query) {
  return String(query)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

function normalizeQueryText(query) {
  return String(query || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isObviousGreeting(query) {
  const normalized = normalizeQueryText(query);
  const greetings = new Set([
    "hi",
    "hello",
    "hey",
    "hlo",
    "good morning",
    "good afternoon",
    "good evening",
    "how are you",
  ]);

  return greetings.has(normalized);
}

function isGibberishLike(query) {
  const normalized = normalizeQueryText(query).replace(/\s/g, "");
  if (!normalized) return true;
  if (normalized.length < 4) return false;

  const vowelCount = (normalized.match(/[aeiou]/g) || []).length;
  const hasDigit = /\d/.test(normalized);
  const hasLongConsonantRun = /[bcdfghjklmnpqrstvwxyz]{6,}/.test(normalized);

  return !hasDigit && (vowelCount === 0 || hasLongConsonantRun);
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
  const normalizedAnswer = String(answer || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return normalizedAnswer === "i do not have enough information in the faq knowledge base to answer that.";
}

function isFaqAnswer(answer) {
  return !isNotEnoughInformationAnswer(answer);
}

function normalizeValidationLabel(label) {
  const normalized = String(label || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .trim();

  if (normalized === "valid") return "valid";
  if (normalized === "greeting") return "greeting";
  return "invalid";
}

function isFollowUpLikeQuery(query) {
  const normalized = normalizeQueryText(query);
  const wordCount = getQueryWordCount(normalized);

  if (!normalized || isObviousGreeting(normalized) || isGibberishLike(normalized)) {
    return false;
  }

  const startsLikeFollowUp =
    /^(what about|how about|and|also|then|so|but|can i|could i|what if|is it|does it|do i|will i)\b/.test(normalized);
  const hasVagueReference = /\b(that|this|it|there|same)\b/.test(normalized);
  const isShortTopicFollowUp =
    wordCount <= 3 &&
    /\b(later|earlier|exam|exams|duration|deadline|start|certificate|team|stipend|noc)\b/.test(normalized);

  return wordCount <= 7 && (startsLikeFollowUp || hasVagueReference || isShortTopicFollowUp);
}

function buildRetrievalQuery(query, memoryQueries = []) {
  const usableMemory = memoryQueries
    .map((memoryQuery) => String(memoryQuery || "").trim())
    .filter(Boolean)
    .slice(-3);

  if (usableMemory.length === 0 || !isFollowUpLikeQuery(query)) {
    return query;
  }

  return [...usableMemory, query].join(" ");
}

function trackQuestionInBackground(query) {
  trackQuestion(query).catch((error) => {
    console.error('Failed to track most asked question:', error);
  });
}

function escalateUnansweredInBackground(query, result) {
  if (result.answerFound !== false) {
    return;
  }

  const topSource = result.sources?.[0];
  const similarityScore = topSource?.score || result.confidence || 0;

  DuplicateQuestion.create({
    question: query,
    matchedQuestion: topSource?.question,
    similarityScore,
    status: similarityScore >= 0.75 ? 'duplicate' : 'new',
  }).catch((error) => {
    console.error('Failed to escalate unanswered question:', error);
  });
}

function returnWithTracking(query, result) {
  trackQuestionInBackground(query);
  escalateUnansweredInBackground(query, result);
  return result;
}

export async function answerQuestion(query, options = {}) {
  const normalizedQuery = String(query || "").trim();

  if (!normalizedQuery) {
    return {
      answer: "Please enter a question.",
      answerFound: false,
      confidence: 0,
      sources: [],
    };
  }

  const retrievalQuery = buildRetrievalQuery(normalizedQuery, options.memoryQueries || []);
  const results = await retrieveContext(retrievalQuery);
  const bestScore = results[0]?.score || 0;
  const minConfidence = getMinConfidenceForQuery(retrievalQuery);
  const answerFound = bestScore >= minConfidence;

  if (results.length === 0) {
    return returnWithTracking(normalizedQuery, {
      answer:
        "No indexed FAQ knowledge base has been loaded yet. Seed or add FAQs, then run reindexing.",
      answerFound: false,
      confidence: 0,
      sources: [],
    });
  }
  const contexts = results.map(toContext);
  if (!answerFound) {
    const validationLabel = normalizeValidationLabel(
      await validateWithOllama({ query: normalizedQuery, contexts })
    );

    if (validationLabel === "valid") {
      return returnWithTracking(normalizedQuery, {
        answer:
          "I don't have enough information in the FAQ knowledge base to answer that.",
        answerFound: false,
        memoryEligible: true,
        confidence: bestScore,
        sources: results.map(toSource),
      });
    }

    if (validationLabel === "greeting") {
      return returnWithTracking(normalizedQuery, {
        answer: "Hello, how can I help you today?",
        answerFound: true,
        memoryEligible: false,
        confidence: bestScore,
        sources: results.map(toSource),
      });
    }

    return returnWithTracking(normalizedQuery, {
      answer:
        "That doesn't seem to be an internship-related question. Feel free to ask me anything about the Vicharanashala internship.",
      answerFound: true,
      memoryEligible: false,
      confidence: bestScore,
      sources: results.map(toSource),
    });
  }
  const answer = await generateWithOllama({
    query: normalizedQuery,
    contexts,
    bestscore: bestScore,
  });

return returnWithTracking(normalizedQuery, {
  answer,
  answerFound: isFaqAnswer(answer),
  memoryEligible: isFaqAnswer(answer),
  confidence: bestScore,
  sources: results.map(toSource),
});
}
