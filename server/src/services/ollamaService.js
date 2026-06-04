import { env } from '../config/env.js';

// ── Non-streaming generation ──────────────────────────────────────────────────
// Used by answerQuestion in ragService.js (unchanged signature)
export async function generateWithOllama({ query, contexts, bestscore }) {
  const contextText = contexts
    .map(
      (context, index) =>
        `Context ${index + 1}\nCategory: ${context.category}\nQuestion: ${context.question}\nAnswer: ${context.answer}`
    )
    .join('\n\n');

  const prompt = `You are a FAQ support chatbot.
Answer using only the retrieved context.
If the context only contains greetings, say: "Hello, how can I help you today?".
If the context does not contain the answer, say: "I do not have enough information in the FAQ knowledge base to answer that."
Keep the answer concise and helpful.

Retrieved context:
${contextText}

User question: ${query}

Answer:`;

  const response = await fetch(`${env.ollamaBaseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.ollamaModel,
      prompt,
      stream: false,
      options: { temperature: 0.1, num_ctx: 4096 }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama request failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  return String(data.response || '').trim();
}

// ── Streaming generation — pipes tokens to an Express res via SSE ─────────────
// Caller sets SSE headers before calling. Streams NDJSON from Ollama line by line.
export async function streamWithOllama({ query, contexts, res }) {
  const contextText = contexts
    .map(
      (context, index) =>
        `Context ${index + 1}\nCategory: ${context.category}\nQuestion: ${context.question}\nAnswer: ${context.answer}`
    )
    .join('\n\n');

  const prompt = `You are a FAQ support chatbot.
Answer using only the retrieved context.
If the context only contains greetings, say: "Hello, how can I help you today?".
If the context does not contain the answer, say: "I do not have enough information in the FAQ knowledge base to answer that."
Keep the answer concise and helpful.

Retrieved context:
${contextText}

User question: ${query}

Answer:`;

  const response = await fetch(`${env.ollamaBaseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.ollamaModel,
      prompt,
      stream: true,
      options: { temperature: 0.1, num_ctx: 4096 }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama request failed: ${response.status} ${body}`);
  }

  // Ollama streams NDJSON — one JSON object per line, each with a `response` token
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line for next iteration

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.response) {
          res.write(`data: ${JSON.stringify({ token: json.response })}\n\n`);
        }
        if (json.done) {
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        }
      } catch {
        // Malformed JSON line — skip
      }
    }
  }
}

// ── Validator (fixed prompt — clearer examples) ───────────────────────────────
export async function validateWithOllama({ query, contexts }) {
  const prompt = `You are a validator bot.
Invalid query example: random noise, greetings like "hi", "hello", "ok".
Valid query example: specific questions slightly related to context but couldn't be answered by context.
Validate the query.
If query is valid then return "valid"
If query is invalid then say, "Hello, how can I help you today?".`;

  const response = await fetch(`${env.ollamaBaseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.ollamaModel,
      prompt: `${prompt}\n\nUser question: ${query}\n\nAnswer:`,
      stream: false,
      options: { temperature: 0.1, num_ctx: 4096 }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama request failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  return String(data.response || '').trim();
}
