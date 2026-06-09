import MostAskedQuestion from '../models/MostAskedQuestion.js';
import normalizeQuestion from '../utils/normalizeQuestion.js';
import { embedTexts } from './embeddingService.js';

function cosineSimilarity(left, right) {
  if (!left?.length || !right?.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let i = 0; i < left.length; i++) {
    dot += left[i] * right[i];
    leftMagnitude += left[i] * left[i];
    rightMagnitude += right[i] * right[i];
  }

  return dot / (
    Math.sqrt(leftMagnitude) *
    Math.sqrt(rightMagnitude)
  );
}


export async function trackQuestion(question) {
  const normalizedQuestion = normalizeQuestion(question);

  if (!normalizedQuestion) {
    return;
  }

 const exactQuestion = await MostAskedQuestion.findOne({
  normalizedQuestion
});

if (exactQuestion) {
  exactQuestion.count += 1;
  exactQuestion.displayQuestion = question.trim();
  await exactQuestion.save();
  return;
}

const [questionEmbedding] = await embedTexts([
  normalizedQuestion
]);

const questions = await MostAskedQuestion.find();

let bestMatch = null;
let highestSimilarity = 0;

for (const storedQuestion of questions) {
  if (!storedQuestion.embedding?.length) {
    continue;
  }

  const similarity = cosineSimilarity(
    questionEmbedding,
    storedQuestion.embedding
  );

  if (similarity > highestSimilarity) {
    highestSimilarity = similarity;
    bestMatch = storedQuestion;
  }
}

/* console.log(
  'Highest similarity:',
  highestSimilarity
);
*/

const SIMILARITY_THRESHOLD = 0.85;

if (
  bestMatch &&
  highestSimilarity >= SIMILARITY_THRESHOLD
) {
  bestMatch.count += 1;
  await bestMatch.save();
} else {
  try {
    await MostAskedQuestion.create({
      normalizedQuestion,
      displayQuestion: question.trim(),
      count: 1,
      embedding: questionEmbedding
    });
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    await MostAskedQuestion.updateOne(
      { normalizedQuestion },
      {
        $inc: { count: 1 },
        $set: { displayQuestion: question.trim() }
      }
    );
  }
}
}
