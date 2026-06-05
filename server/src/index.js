import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { connectMongo } from './db/mongoose.js';
import { chatRouter } from './routes/chatRoutes.js';
import { orgRouter } from './routes/orgRoutes.js';
import { faqRouter } from './routes/faqRoutes.js';
import {questionReviewRouter} from './routes/questionReviewRoutes.js';
import { mostAskedRouter } from './routes/mostAskedRoutes.js';
import analyticsRoutes from './routes/analytics.js';
import suggestionRoutes from './routes/suggestionRoutes.js';

const app = express();

app.use(cors({ origin: env.clientOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(
  '/api/question-review',
  questionReviewRouter
);

app.use('/api/suggestions', suggestionRoutes);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/chat', chatRouter);
app.use('/api/orgs', orgRouter);
app.use('/api/faqs', faqRouter);
app.use('/api/most-asked', mostAskedRouter);
app.use('/api/analytics', analyticsRoutes);


app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    message: 'Something went wrong while processing the request.'
  });
});

await connectMongo();

app.listen(env.port, () => {
  console.log(`RAG server listening on http://localhost:${env.port}`);
});
