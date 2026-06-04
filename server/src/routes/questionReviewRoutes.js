import express from 'express';
import { reviewQuestion }
from '../services/questionReviewService.js';

export const questionReviewRouter =
  express.Router();

questionReviewRouter.post(
  '/',
  async (req, res, next) => {
    try {
      const result =
        await reviewQuestion(
          req.body.message
        );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);