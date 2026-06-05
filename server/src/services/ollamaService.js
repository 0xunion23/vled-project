import { env } from '../config/env.js';

export async function generateWithOllama({ query, contexts, bestscore }) {
  const contextText = contexts
    .map(
      (context, index) =>
        `Context ${index + 1}\nCategory: ${context.category}\nQuestion: ${context.question}\nAnswer: ${context.answer}`
    )
    .join('\n\n');

  const prompt = `You are a FAQ support chatbot.
Answer using only the retrieved context.

If (${bestscore} < 0.6 && contest does not contain the answer)if both condition satisfied then only , say: "I do not have enough information in the FAQ knowledge base to answer that."
otherwise, answer the question based on the retrieved context.
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
      options: {
        temperature: 0.1,
        num_ctx: 4096
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

export async function validateWithOllama({ query, contexts }) { 
  const prompt = `You are a validator bot.
    valid query example: specific questions slightly related to context but couldnt be answered by context. 
If query is valid then return "valid"
If query is invalid then say, "Hello,How can i help you today ?".`;

  const response = await fetch(`${env.ollamaBaseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.ollamaModel,
      prompt: `${prompt}\n\nUser question: ${query}\n\nAnswer:`,
      stream: false,
      options: {
        temperature: 0.1,
        num_ctx: 4096
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
