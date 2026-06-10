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

// Formats the last N turns of conversation history into a readable transcript.
// Each turn is: "User: <question>\nAssistant: <answer>"
// Keeps only the most recent MAX_HISTORY_TURNS to avoid bloating the context window.
const MAX_HISTORY_TURNS = 5;

function buildHistoryBlock(history = []) {
  if (!Array.isArray(history) || history.length === 0) return '';

  // history is an array of { role: 'user'|'assistant', text: string }
  // Take last MAX_HISTORY_TURNS *pairs* (user + assistant), so up to MAX*2 messages
  const relevant = history
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .filter(m => typeof m.text === 'string' && m.text.trim())
    .slice(-(MAX_HISTORY_TURNS * 2));

  if (relevant.length === 0) return '';

  const lines = relevant.map(m =>
    m.role === 'user'
      ? `User: ${m.text.trim()}`
      : `Assistant: ${m.text.trim()}`
  ).join('\n');

  return `\nConversation history (most recent first, for context only):\n${lines}\n`;
}

export async function generateWithOllama({ query, contexts, bestscore, history = [] }) {
  const contextText = contexts
    .map(
      (context, index) =>
        `Context ${index + 1}\nCategory: ${context.category}\nQuestion: ${context.question}\nAnswer: ${context.answer}`
    )
    .join('\n\n');

  const historyBlock = buildHistoryBlock(history);

  const prompt = `You are a FAQ support chatbot.
Use only the retrieved context to answer the current question.
The conversation history is provided so you can resolve pronouns and follow-up references (e.g. "what about that?", "tell me more", "and the deadline?").
Do NOT use the history to introduce information that is not in the context.

Choose exactly one response:
1. If the context answers the question (including follow-ups resolved via history), give only the answer in 1-2 concise sentences.
2. If the context does not answer the question, say exactly: "I do not have enough information in the FAQ knowledge base to answer that."

Never combine an answer with the fallback sentence. Do not add information not in the context.
Retrieval confidence: ${bestscore}
${historyBlock}
Retrieved context:
${contextText}

Current question: ${query}

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
