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

export async function validateWithOllama({ query }) { 
  const prompt = `You are a query validator. Your ONLY job is to detect pure gibberish or random keyboard noise.

INVALID (gibberish/noise): "asdfghjkl", "qwerty123", "xzxzxz", "aaaaaa", "123456abc", random characters with no meaning.
VALID (everything else): ANY real sentence, question, or phrase in any language — even if unrelated to internship, even if the answer is unknown.

Examples of VALID queries:
- "what is the dress code"
- "who can sign the NOC"
- "from when can I start the internship"
- "what is the weather"
- "hello"
- "tell me a joke"

Respond with ONLY one word: "valid" or "invalid". No explanation.`;

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
