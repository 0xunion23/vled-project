import { Faq } from '../models/Faq.js';
import { embedTexts } from './embeddingService.js';
import normalizeQuestion from '../utils/normalizeQuestion.js';

const MIN_RELATED_QUESTIONS = 3;
const MAX_RELATED_QUESTIONS = 5;

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

function normalizeKey(question) {
  return normalizeQuestion(String(question || ''));
}

function getFaqFromResult(result) {
  return result?.faq || result || null;
}

function getFaqId(faq) {
  return String(faq?.id || faq?._id || '');
}

function addQuestion(questions, seenQuestionKeys, excludedIds, faq, currentQuestionKey) {
  const question = String(faq?.question || '').trim();
  const questionKey = normalizeKey(question);
  const faqId = getFaqId(faq);

  if (
    !question ||
    !questionKey ||
    questionKey === currentQuestionKey ||
    seenQuestionKeys.has(questionKey) ||
    excludedIds.has(faqId)
  ) {
    return;
  }

  seenQuestionKeys.add(questionKey);
  questions.push(question);
}

async function retrieveExpandedRelatedFaqs(query) {
  const [queryEmbedding] = await embedTexts([query]);
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    return [];
  }

  const faqs = await Faq.find({
    isActive: true,
    embedding: { $exists: true, $ne: [] },
  }).lean();

  return faqs
    .filter((faq) => Array.isArray(faq.embedding) && faq.embedding.length > 0)
    .map((faq) => ({
      faq: {
        ...faq,
        id: String(faq._id),
      },
      score: dotProduct(queryEmbedding, faq.embedding),
    }))
    .sort((left, right) => right.score - left.score);
}

export function isIrrelevantPlatformResponse(answer) {
  const normalizedAnswer = String(answer || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalizedAnswer === 'hello how can i help you today';
}

export async function getRelatedFaqQuestions({
  query,
  retrievedDocs = [],
  primarySourceId,
  maxQuestions = MAX_RELATED_QUESTIONS,
} = {}) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) {
    return [];
  }

  const questions = [];
  const seenQuestionKeys = new Set();
  const excludedIds = new Set([String(primarySourceId || '')].filter(Boolean));
  const currentQuestionKey = normalizeKey(normalizedQuery);

  for (const result of retrievedDocs) {
    addQuestion(
      questions,
      seenQuestionKeys,
      excludedIds,
      getFaqFromResult(result),
      currentQuestionKey
    );

    if (questions.length >= maxQuestions) {
      return questions;
    }
  }

  if (questions.length >= MIN_RELATED_QUESTIONS) {
    return questions;
  }

  const expandedResults = await retrieveExpandedRelatedFaqs(normalizedQuery);

  for (const result of expandedResults) {
    addQuestion(
      questions,
      seenQuestionKeys,
      excludedIds,
      getFaqFromResult(result),
      currentQuestionKey
    );

    if (questions.length >= maxQuestions) {
      break;
    }
  }

  return questions;
}
