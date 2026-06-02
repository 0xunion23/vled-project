import { env } from '../config/env.js';

export async function generateWithOllama({ query, contexts }) {
  const contextText = contexts
    .map(
      (context, index) =>
        `Context ${index + 1}\nCategory: ${context.category}\nQuestion: ${context.question}\nAnswer: ${context.answer}`
    )
    .join('\n\n');

  const prompt = `You are a FAQ support chatbot.
Answer using only the retrieved context.
If the context only contains greetings ,say : "Hello,How can i help you today ?".
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
    invalid query example: ramdon noice
    valid query example: specific questions slightly related to context but couldnt be answered by context. 
Validate the query.
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
