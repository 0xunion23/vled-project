import express from 'express';
import { answerQuestion, retrieveContext } from '../services/ragService.js';
import { generateFollowUpQuestions } from '../services/followUpQuestionService.js';
import SearchLog from '../models/SearchLog.js';
export const chatRouter = express.Router();

chatRouter.post('/', async (req, res, next) => {
  try {
    const message = req.body?.message;

    await SearchLog.create({
      query: message
    });

    const result = await answerQuestion(message);
    let relatedQuestions = [];
    const normalizedMessage = String(message || '').trim();

    try {
      if (!normalizedMessage) {
        return res.json({
          ...result,
          relatedQuestions
        });
      }

      const retrievedDocs = await retrieveContext(message);
      relatedQuestions = await generateFollowUpQuestions(retrievedDocs, message);
    } catch (followUpError) {
      console.error('Failed to generate follow-up questions:', followUpError);
    }

    res.json({
      ...result,
      relatedQuestions
    });
  } catch (error) {
    next(error);
  }
});
