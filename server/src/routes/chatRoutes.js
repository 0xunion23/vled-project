import express from 'express';
import { answerQuestion, retrieveContext, getMinConfidenceForQuery } from '../services/ragService.js';
import { streamWithOllama, validateWithOllama } from '../services/ollamaService.js';
import { moderateMessage, BLOCK_MESSAGES } from '../services/moderationService.js';
import { buildFaqText } from '../services/embeddingService.js';
import { trackQuestion } from '../services/mostAskedService.js';
import SearchLog from '../models/SearchLog.js';
import { env } from '../config/env.js';

export const chatRouter = express.Router();

// ── POST /api/chat ────────────────────────────────────────────────────────────
// Standard non-streaming chat. Runs moderation before anything else.
chatRouter.post('/', async (req, res, next) => {
  try {
    const message = req.body?.message;

    // Content moderation — blocks profanity, injection, unsafe content
    const moderation = await moderateMessage(message);
    if (!moderation.allowed) {
      return res.status(400).json({
        answer:      BLOCK_MESSAGES[moderation.reason] || BLOCK_MESSAGES.unsafe_content,
        answerFound: false,
        confidence:  0,
        sources:     [],
        blocked:     true,
        reason:      moderation.reason,
      });
    }

    await SearchLog.create({ query: message });
    const result = await answerQuestion(message);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ── GET /api/chat/stream ──────────────────────────────────────────────────────
// Streaming chat via Server-Sent Events. Runs moderation before streaming.
// SSE event format:
//   data: {"token":"word"}    — one token from Ollama
//   data: {"done":true}       — generation complete
//   data: {"meta":{...}}      — confidence, answerFound, sources (sent last)
//   data: {"error":"..."}     — on failure
chatRouter.get('/stream', async (req, res) => {
  const message = String(req.query.message || '').trim();

  if (!message) {
    res.status(400).json({ error: 'message query param is required.' });
    return;
  }

  // Content moderation — same layer as POST
  const moderation = await moderateMessage(message);
  if (!moderation.allowed) {
    res.status(400).json({
      answer:      BLOCK_MESSAGES[moderation.reason] || BLOCK_MESSAGES.unsafe_content,
      answerFound: false,
      confidence:  0,
      sources:     [],
      blocked:     true,
      reason:      moderation.reason,
    });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    await SearchLog.create({ query: message });
    await trackQuestion(message);

    const results = await retrieveContext(message);

    if (results.length === 0) {
      res.write(`data: ${JSON.stringify({ token: 'No indexed FAQ knowledge base has been loaded yet. Seed or add FAQs, then run reindexing.' })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.write(`data: ${JSON.stringify({ meta: { answerFound: false, confidence: 0, sources: [] } })}\n\n`);
      res.end();
      return;
    }

    // Use raw vector score for confidence gating (same logic as answerQuestion)
    const bestScore = results[0]?._vectorScore ?? results[0]?.score ?? 0;
    const minConfidence = getMinConfidenceForQuery(message);
    const answerFound = bestScore >= minConfidence;

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

    await streamWithOllama({ query: message, contexts, bestscore: bestScore, res });
    res.write(`data: ${JSON.stringify({ meta: { answerFound: true, confidence: bestScore, sources } })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Stream error:', error.message);
    res.write(`data: ${JSON.stringify({ error: 'Something went wrong while streaming.' })}\n\n`);
    res.end();
  }
});
