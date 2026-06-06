import { Faq } from '../models/Faq.js';
import normalizeQuestion from '../utils/normalizeQuestion.js';

const MIN_FOLLOW_UP_QUESTIONS = 3;
const MAX_FOLLOW_UP_QUESTIONS = 5;

function getFaqFromRetrievedDoc(doc) {
  return doc?.faq || doc || null;
}

function normalizeKey(question) {
  return normalizeQuestion(String(question || ''));
}

function getQuestionCandidate(faq) {
  const question = String(faq?.question || '').trim();
  if (!question) return null;

  return {
    question,
    category: String(faq?.category || 'General').trim() || 'General',
  };
}

function addUniqueQuestion(candidates, seen, candidate, currentQuestionKey) {
  if (!candidate) return;

  const questionKey = normalizeKey(candidate.question);
  if (!questionKey || questionKey === currentQuestionKey || seen.has(questionKey)) {
    return;
  }

  seen.add(questionKey);
  candidates.push(candidate.question);
}

function getPreferredCategories(retrievedDocs) {
  const categories = [];
  const seen = new Set();

  for (const doc of retrievedDocs) {
    const faq = getFaqFromRetrievedDoc(doc);
    const category = String(faq?.category || '').trim();
    const key = category.toLowerCase();

    if (category && !seen.has(key)) {
      seen.add(key);
      categories.push(category);
    }
  }

  return categories;
}

async function findSameCategoryQuestions(categories, excludedQuestionKeys) {
  if (categories.length === 0) {
    return [];
  }

  const faqs = await Faq.find({
    isActive: true,
    category: { $in: categories },
  })
    .select('question category')
    .lean();

  return faqs.filter((faq) => !excludedQuestionKeys.has(normalizeKey(faq.question)));
}

export async function generateFollowUpQuestions(retrievedDocs = [], currentQuestion = '') {
  const docs = Array.isArray(retrievedDocs) ? retrievedDocs : [];
  const currentQuestionKey = normalizeKey(currentQuestion);
  const seen = new Set();
  const relatedQuestions = [];

  if (currentQuestionKey) {
    seen.add(currentQuestionKey);
  }

  const retrievedFaqs = docs.map(getFaqFromRetrievedDoc).filter(Boolean);
  const preferredCategories = getPreferredCategories(docs);
  const preferredCategoryKeys = new Set(preferredCategories.map((category) => category.toLowerCase()));

  for (const faq of retrievedFaqs) {
    addUniqueQuestion(relatedQuestions, seen, getQuestionCandidate(faq), currentQuestionKey);

    if (relatedQuestions.length >= MAX_FOLLOW_UP_QUESTIONS) {
      return relatedQuestions;
    }
  }

  const sameCategoryFaqs = await findSameCategoryQuestions(preferredCategories, seen);
  sameCategoryFaqs.sort((left, right) => {
    const leftPreferred = preferredCategoryKeys.has(String(left.category || '').toLowerCase()) ? 0 : 1;
    const rightPreferred = preferredCategoryKeys.has(String(right.category || '').toLowerCase()) ? 0 : 1;
    return leftPreferred - rightPreferred;
  });

  for (const faq of sameCategoryFaqs) {
    addUniqueQuestion(relatedQuestions, seen, getQuestionCandidate(faq), currentQuestionKey);

    if (relatedQuestions.length >= MAX_FOLLOW_UP_QUESTIONS) {
      return relatedQuestions;
    }
  }

  if (relatedQuestions.length >= MIN_FOLLOW_UP_QUESTIONS) {
    return relatedQuestions;
  }

  const fallbackFaqs = await Faq.find({ isActive: true })
    .select('question category')
    .limit(MAX_FOLLOW_UP_QUESTIONS * 3)
    .lean();

  for (const faq of fallbackFaqs) {
    addUniqueQuestion(relatedQuestions, seen, getQuestionCandidate(faq), currentQuestionKey);

    if (relatedQuestions.length >= MAX_FOLLOW_UP_QUESTIONS) {
      break;
    }
  }

  return relatedQuestions;
}
