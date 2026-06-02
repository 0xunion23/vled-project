import { Router } from 'express';
import Escalation from '../models/Escalation.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const escalation = await Escalation.create({
      question: req.body.question,
      confidence: req.body.confidence
    });

    res.status(201).json(escalation);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.get('/', async (_req, res) => {
  try {
    const escalations = await Escalation.find().sort({
      createdAt: -1
    });

    res.json(escalations);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;