import express from 'express';
import MostAskedQuestion from '../models/MostAskedQuestion.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const questions = await MostAskedQuestion.find()
      .sort({ count: -1 })
      .limit(20);

    res.json(questions);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: 'Failed to fetch most asked questions'
    });
  }
});

export default router;
