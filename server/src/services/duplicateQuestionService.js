import { retrieveContext } from './ragService.js';

const DUPLICATE_THRESHOLD = 0.75;

export async function checkDuplicateQuestion(question) {
  const results = await retrieveContext(question);

  if (!results.length) {
    return {
      isDuplicate: false,
      similarity: 0,
      matchedQuestion: null
    };
  }

  const bestMatch = results[0];

  return {
    isDuplicate: bestMatch.score >= DUPLICATE_THRESHOLD,
    similarity: bestMatch.score,
    matchedQuestion: bestMatch.faq.question
  };
}