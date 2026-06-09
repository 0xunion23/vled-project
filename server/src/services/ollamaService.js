import { env } from '../config/env.js';

async function requestOllamaGenerate({ prompt, signal }) {
  const response = await fetch(`${env.ollamaBaseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: env.ollamaModel,
      prompt,
      stream: false,
      keep_alive: env.ollamaKeepAlive,
      options: {
        temperature: 0.1,
        num_ctx: env.ollamaNumCtx,
        num_predict: env.ollamaNumPredict,
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama request failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  return String(data.response || '').trim();
}

export async function generateWithOllama({ query, contexts, bestscore }) {
  const contextText = contexts
    .map(
      (context, index) =>
        `Context ${index + 1}\nCategory: ${context.category}\nQuestion: ${context.question}\nAnswer: ${context.answer}`
    )
    .join('\n\n');

  const prompt = `You are a FAQ support chatbot.
Use only the retrieved context.

Choose exactly one response:
1. If the context answers the question, give only the answer in 1-2 concise sentences.
2. If the context does not answer the question, say exactly: "I do not have enough information in the FAQ knowledge base to answer that."

Never combine an answer with the fallback sentence. Do not add information that is not in the context.
Retrieval confidence: ${bestscore}

Retrieved context:
${contextText}

User question: ${query}

Answer:`;

  return requestOllamaGenerate({ prompt });
}

export async function validateWithOllama({ query, contexts }) { 
  const prompt = `You are a validator bot.
    valid query example: specific questions slightly related to context but couldnt be answered by context. 
If query is valid then return "valid"
If query is invalid then say, "Hello,How can i help you today ?".`;

  return requestOllamaGenerate({
    prompt: `${prompt}\n\nUser question: ${query}\n\nAnswer:`,
  });
}

export async function warmOllamaModel() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.ollamaWarmupTimeoutMs);

  try {
    await requestOllamaGenerate({
      prompt: 'Reply with exactly: ready',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function detectHallucination({ contexts, answer }) {
  const contextText = contexts
    .map(
      (context, index) =>
        `Context ${index + 1}\nCategory: ${context.category}\nQuestion: ${context.question}\nAnswer: ${context.answer}`
    )
    .join('\n\n');

  const prompt = `You are a factual checker. Your job is to detect if the generated answer contains information that is NOT present in the retrieved contexts.
If the answer contains any ungrounded, fabricated, or fake facts not explicitly mentioned in the retrieved contexts, respond with "fake".
If the answer is completely grounded in and supported by the retrieved contexts, respond with "grounded".

Retrieved contexts:
${contextText}

Generated answer to check:
${answer}

Response (either "fake" or "grounded"):`;

  try {
    const response = await fetch(`${env.ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.ollamaModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.0,
          num_ctx: 4096
        }
      })
    });

    if (!response.ok) {
      return 'grounded';
    }

    const data = await response.json();
    const result = String(data.response || '').trim().toLowerCase();
    return result.includes('fake') ? 'fake' : 'grounded';
  } catch (error) {
    console.error('Hallucination validation failed:', error);
    return 'grounded';
  }
}
