import express from 'express';
import { Escalation } from '../models/Escalation.js';
import { QueryLog } from '../models/QueryLog.js';

export const adminRouter = express.Router();

// GET /api/admin/escalations — list open escalations
adminRouter.get('/escalations', async (_req, res, next) => {
  try {
    const escalations = await Escalation.find({ status: 'open' })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(escalations);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/escalations/:id/answer — admin provides answer and resolves
adminRouter.patch('/escalations/:id/answer', async (req, res, next) => {
  try {
    const { answer } = req.body;
    if (!answer || !String(answer).trim()) {
      return res.status(400).json({ message: 'Answer is required.' });
    }
    const escalation = await Escalation.findByIdAndUpdate(
      req.params.id,
      {
        status: 'resolved',
        adminAnswer: String(answer).trim(),
        resolvedAt: new Date()
      },
      { new: true }
    );
    if (!escalation) return res.status(404).json({ message: 'Not found' });
    res.json(escalation);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/stats — dashboard summary stats
adminRouter.get('/stats', async (_req, res, next) => {
  try {
    const [totalQueries, answeredQueries, escalatedOpen, escalatedResolved] = await Promise.all([
      QueryLog.countDocuments(),
      QueryLog.countDocuments({ answerFound: true }),
      Escalation.countDocuments({ status: 'open' }),
      Escalation.countDocuments({ status: 'resolved' })
    ]);

    const avgConfidenceResult = await QueryLog.aggregate([
      { $group: { _id: null, avg: { $avg: '$confidence' } } }
    ]);
    const avgConfidence = avgConfidenceResult[0]?.avg || 0;

    res.json({
      totalQueries,
      answeredQueries,
      fallbackQueries: totalQueries - answeredQueries,
      answerRate: totalQueries ? Math.round((answeredQueries / totalQueries) * 100) : 0,
      avgConfidence: Number(avgConfidence.toFixed(2)),
      escalatedOpen,
      escalatedResolved
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/top-questions — most asked questions
adminRouter.get('/top-questions', async (_req, res, next) => {
  try {
    const top = await QueryLog.aggregate([
      {
        $group: {
          _id: { $toLower: '$question' },
          question: { $first: '$question' },
          count: { $sum: 1 },
          avgConfidence: { $avg: '$confidence' },
          answerFoundCount: { $sum: { $cond: ['$answerFound', 1, 0] } }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);
    res.json(top);
  } catch (error) {
    next(error);
  }
});
