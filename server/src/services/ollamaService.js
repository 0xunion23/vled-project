import { env } from '../config/env.js';

async function requestOllamaGenerate({ prompt, signal, options = {} }) {
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
        ...options,
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
  const prompt = `You are a validator bot for the Vicharanashala internship FAQ chatbot.
Classify the user question into exactly one label:
- "valid": a genuine internship-related question that is not answered well enough by the retrieved FAQ context.
- "greeting": a greeting or casual opener such as hi, hello, hey, good morning, or how are you.
- "casual": a casual acknowledgement or closing message such as ok, okay, thanks, thank you, got it, cool, sure, fine, great, or nice.
- "invalid": gibberish, random text, or anything not related to the Vicharanashala internship.

Return only one word: valid, greeting, casual, or invalid.`;

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
