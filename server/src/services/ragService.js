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

function isCasualAcknowledgement(query) {
  const normalized = normalizeQueryText(query);
  const casualMessages = new Set([
    "ok",
    "okay",
    "okk",
    "k",
    "thanks",
    "thank you",
    "thx",
    "got it",
    "cool",
    "sure",
    "fine",
    "great",
    "nice",
    "awesome",
    "alright",
    "all right",
    "understood",
  ]);

  return casualMessages.has(normalized);
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

function userIdOf(user) {
  return user?._id || user?.id || null;
}

function buildUserContext(user, escalatedQuestions = []) {
  if (!user) {
    return "No authenticated user profile is available.";
  }

  const lines = [
    `Name: ${user.name || "Unknown"}`,
    `Email: ${user.email || "Unknown"}`,
  ];

  if (escalatedQuestions.length > 0) {
    lines.push(
      "Recent escalated questions:",
      ...escalatedQuestions.map(
        (question, index) => `${index + 1}. ${question.question}`
      )
    );
  } else {
    lines.push("Recent escalated questions: none");
  }

  return lines.join("\n");
}

async function getRecentEscalatedQuestions(user, limit = 5) {
  const userId = userIdOf(user);
  if (!userId) {
    return [];
  }

  return DuplicateQuestion.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

function isUserProfileQuery(query) {
  const normalized = normalizeQueryText(query);

  return (
    /\b(who am i|my profile|my account|my name|what is my name|my email|what is my email)\b/.test(normalized) ||
    /\b(do you know me|tell me about me)\b/.test(normalized)
  );
}

function isEscalationHistoryQuery(query) {
  const normalized = normalizeQueryText(query);

  return (
    /\b(my|me|mine)\b.*\b(escalated|escalation|unanswered|pending|review)\b/.test(normalized) ||
    /\b(escalated|unanswered|pending)\b.*\b(questions|queries)\b/.test(normalized)
  );
}

function answerUserProfileQuestion(user) {
  if (!user) {
    return {
      answer: "I can only see your profile after you log in.",
      answerFound: true,
      memoryEligible: false,
      confidence: 1,
      sources: [],
    };
  }

  return {
    answer: `You are logged in as ${user.name} (${user.email}).`,
    answerFound: true,
    memoryEligible: false,
    confidence: 1,
    sources: [],
  };
}

async function answerEscalationHistoryQuestion(user) {
  const escalatedQuestions = await getRecentEscalatedQuestions(user);

  if (escalatedQuestions.length === 0) {
    return {
      answer: "You do not have any escalated questions yet.",
      answerFound: true,
      memoryEligible: false,
      confidence: 1,
      sources: [],
    };
  }

  const items = escalatedQuestions
    .map((question, index) => `${index + 1}. ${question.question}`)
    .join("\n");

  return {
    answer: `Here are your recent escalated questions:\n${items}`,
    answerFound: true,
    memoryEligible: false,
    confidence: 1,
    sources: [],
  };
}

function normalizeValidationLabel(label) {
  const normalized = String(label || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .trim();

  if (normalized === "valid") return "valid";
  if (normalized === "greeting") return "greeting";
  if (normalized === "casual") return "casual";
  return "invalid";
}

function isFollowUpLikeQuery(query) {
  const normalized = normalizeQueryText(query);
  const wordCount = getQueryWordCount(normalized);

  if (!normalized || isObviousGreeting(normalized) || isCasualAcknowledgement(normalized) || isGibberishLike(normalized)) {
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

async function createEscalatedQuestion(query, user, source) {
  await DuplicateQuestion.create({
    userId: userIdOf(user),
    question: query,
    matchedQuestion: source?.question,
    similarityScore: source?.score || 0,
    status: (source?.score || 0) >= 0.75 ? 'duplicate' : 'new',
  });
}

export async function escalateQuestionForReview(query, user) {
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) {
    const error = new Error("Question is required.");
    error.statusCode = 400;
    throw error;
  }

  const results = await retrieveContext(normalizedQuery);
  await createEscalatedQuestion(normalizedQuery, user, results[0] ? toSource(results[0]) : null);

  return {
    escalated: true,
    message: "Query escalated for review",
  };
}

function markEscalationEligible(result, query) {
  if (result.answerFound !== false) {
    return result;
  }

  return {
    ...result,
    escalationEligible: true,
    escalationQuery: query,
    escalationStatus: "pending",
  };
}

function returnWithTracking(query, result) {
  const trackedResult = markEscalationEligible(result, query);
  trackQuestionInBackground(query);
  return trackedResult;
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

  if (isUserProfileQuery(normalizedQuery)) {
    return returnWithTracking(
      normalizedQuery,
      answerUserProfileQuestion(options.user),
      options
    );
  }

  if (isEscalationHistoryQuery(normalizedQuery)) {
    return returnWithTracking(
      normalizedQuery,
      await answerEscalationHistoryQuestion(options.user),
      options
    );
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
    }, options);
  }
  const contexts = results.map(toContext);
  const escalatedQuestions = await getRecentEscalatedQuestions(options.user, 3);
  const userContext = buildUserContext(options.user, escalatedQuestions);

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
      }, options);
    }

    if (validationLabel === "greeting") {
      return returnWithTracking(normalizedQuery, {
        answer: "Hello, how can I help you today?",
        answerFound: true,
        memoryEligible: false,
        confidence: bestScore,
        sources: results.map(toSource),
      }, options);
    }

    if (validationLabel === "casual") {
      return returnWithTracking(normalizedQuery, {
        answer: "Let me know if anything else comes up.",
        answerFound: true,
        memoryEligible: false,
        confidence: bestScore,
        sources: results.map(toSource),
      }, options);
    }

    return returnWithTracking(normalizedQuery, {
      answer:
        "That doesn't seem to be an internship-related question. Feel free to ask me anything about the Vicharanashala internship.",
      answerFound: true,
      memoryEligible: false,
      confidence: bestScore,
      sources: results.map(toSource),
    }, options);
  }
  const answer = await generateWithOllama({
    query: normalizedQuery,
    contexts,
    bestscore: bestScore,
    userContext,
    conversationContext: options.memoryQueries || [],
  });

  return returnWithTracking(normalizedQuery, {
    answer,
    answerFound: isFaqAnswer(answer),
    memoryEligible: isFaqAnswer(answer),
    confidence: bestScore,
    sources: results.map(toSource),
  }, options);
}
