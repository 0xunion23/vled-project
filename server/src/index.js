import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { connectMongo } from './db/mongoose.js';
import { chatRouter } from './routes/chatRoutes.js';
import { faqRouter } from './routes/faqRoutes.js';
import mostAskedRouter from './routes/mostAskedRoutes.js';

const app = express();

app.use(cors({ origin: env.clientOrigin }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/chat', chatRouter);
app.use('/api/faqs', faqRouter);

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
