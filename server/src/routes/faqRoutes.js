import express from 'express';
import { Faq } from '../models/Faq.js';
import { embedAndSaveFaq } from '../services/ragService.js';

export const faqRouter = express.Router();

faqRouter.get('/', async (_req, res, next) => {
  try {
    const faqs = await Faq.find({ isActive: true }).sort({ updatedAt: -1 });
    res.json(faqs);
  } catch (error) {
    next(error);
  }
});

faqRouter.post('/', async (req, res, next) => {
  try {
    const faq = new Faq(req.body);
    await embedAndSaveFaq(faq);
    res.status(201).json(faq);
  } catch (error) {
    next(error);
  }
});
