import express from 'express';
import { answerQuestion, retrieveContext } from '../services/ragService.js';
import { streamWithOllama, validateWithOllama } from '../services/ollamaService.js';
import { buildFaqText } from '../services/embeddingService.js';
import { trackQuestion } from '../services/mostAskedService.js';
import SearchLog from '../models/SearchLog.js';

export const chatRouter = express.Router();

// ── POST /api/chat — original non-streaming endpoint (unchanged behaviour) ────
chatRouter.post('/', async (req, res, next) => {
  try {
    const message = req.body?.message;
    await SearchLog.create({ query: message });
    const result = await answerQuestion(message);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ── GET /api/chat/stream — streaming endpoint via Server-Sent Events ──────────
// Client connects with EventSource or fetch+ReadableStream.
// The endpoint streams tokens as they're generated, then sends metadata at the end.
//
// SSE event format:
//   data: {"token":"word"}        — one token from Ollama
//   data: {"done":true}           — Ollama finished generating
//   data: {"meta":{...}}          — confidence, answerFound, sources
//   data: {"error":"..."}         — on failure
chatRouter.get('/stream', async (req, res) => {
  const message = String(req.query.message || '').trim();

  if (!message) {
    res.status(400).json({ error: 'message query param is required.' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering if present
  res.flushHeaders();

  try {
    // Log the search
    await SearchLog.create({ query: message });
    await trackQuestion(message);

    // Retrieve context (same as non-streaming path)
    const results = await retrieveContext(message);
    const bestScore = results[0]?.score || 0;
    const answerFound = bestScore >= parseFloat(process.env.MIN_CONFIDENCE || '0.45');

    if (results.length === 0) {
      res.write(`data: ${JSON.stringify({ token: 'No indexed FAQ knowledge base has been loaded yet. Seed or add FAQs, then run reindexing.' })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.write(`data: ${JSON.stringify({ meta: { answerFound: false, confidence: 0, sources: [] } })}\n\n`);
      res.end();
      return;
    }

    const contexts = results.map(r => ({
      question: r.faq.question,
      answer:   r.faq.answer,
      category: r.faq.category,
      text:     buildFaqText(r.faq),
      score:    r.score,
    }));

    const sources = results.map(r => ({
      id:       r.faq.id,
      question: r.faq.question,
      category: r.faq.category,
      score:    Number(r.score.toFixed(4)),
    }));

    if (!answerFound) {
      // Low confidence — validate query then stream fallback message
      const validation = await validateWithOllama({ query: message, contexts });
      const fallbackText = validation.toLowerCase() === 'valid'
        ? "I don't have enough information in the FAQ knowledge base to answer that."
        : validation;

      res.write(`data: ${JSON.stringify({ token: fallbackText })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.write(`data: ${JSON.stringify({ meta: { answerFound: false, confidence: bestScore, sources } })}\n\n`);
      res.end();
      return;
    }

    // Stream the answer token by token
    await streamWithOllama({ query: message, contexts, res });

    // Send metadata after streaming completes
    res.write(`data: ${JSON.stringify({ meta: { answerFound: true, confidence: bestScore, sources } })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Stream error:', error.message);
    res.write(`data: ${JSON.stringify({ error: 'Something went wrong while streaming the response.' })}\n\n`);
    res.end();
  }
});
