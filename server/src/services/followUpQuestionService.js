import { getRelatedFaqQuestions } from './relatedQuestionService.js';

export async function generateFollowUpQuestions(retrievedDocs = [], currentQuestion = '') {
  return getRelatedFaqQuestions({
    query: currentQuestion,
    retrievedDocs,
    primarySourceId: retrievedDocs[0]?.faq?.id || retrievedDocs[0]?.id,
  });
}
