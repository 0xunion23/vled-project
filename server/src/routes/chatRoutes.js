import express from 'express';
import { answerQuestion, retrieveContext } from '../services/ragService.js';
import {
  getRelatedFaqQuestions,
  isIrrelevantPlatformResponse
} from '../services/relatedQuestionService.js';
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

      if (isIrrelevantPlatformResponse(result.answer) || !result.sources?.length) {
        return res.json({
          ...result,
          relatedQuestions
        });
      }

      const retrievedDocs = await retrieveContext(message);
      relatedQuestions = await getRelatedFaqQuestions({
        query: message,
        retrievedDocs,
        primarySourceId: result.sources?.[0]?.id
      });
    } catch (relatedQuestionError) {
      console.error('Failed to get related FAQ questions:', relatedQuestionError);
    }

    res.json({
      ...result,
      relatedQuestions
    });
  } catch (error) {
    next(error);
  }
});
