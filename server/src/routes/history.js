import express from 'express';
import SearchLog from '../models/SearchLog.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const history = await SearchLog.find()
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;