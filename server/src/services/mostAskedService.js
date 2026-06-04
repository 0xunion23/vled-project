import MostAskedQuestion from '../models/MostAskedQuestion.js';
import normalizeQuestion from '../utils/normalizeQuestion.js';

export async function trackQuestion(question) {
  const normalizedQuestion = normalizeQuestion(question);

  if (!normalizedQuestion) {
    return;
  }

  const existingQuestion = await MostAskedQuestion.findOne({
    normalizedQuestion
  });

  if (existingQuestion) {
    existingQuestion.count += 1;
    await existingQuestion.save();
  } else {
    await MostAskedQuestion.create({
      normalizedQuestion,
      displayQuestion: question.trim(),
      count: 1
    });
  }
}
