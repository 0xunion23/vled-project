import { DuplicateQuestion } from '../models/DuplicateQuestion.js';
import { checkDuplicateQuestion } from './duplicateQuestionService.js';

export async function reviewQuestion(question) {
  const duplicateCheck =
    await checkDuplicateQuestion(question);

  if (duplicateCheck.isDuplicate) {
    await DuplicateQuestion.create({
      question,
      matchedQuestion:
        duplicateCheck.matchedQuestion,
      similarityScore:
        duplicateCheck.similarity,
      status: 'duplicate'
    });

    return {
      duplicate: true,
      matchedQuestion:
        duplicateCheck.matchedQuestion,
      similarity:
        duplicateCheck.similarity
    };
  }

  await DuplicateQuestion.create({
    question,
    similarityScore:
      duplicateCheck.similarity,
    status: 'new'
  });

  return {
    duplicate: false
  };
}