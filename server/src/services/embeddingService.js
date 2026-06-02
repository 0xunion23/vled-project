import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const embedScriptPath = path.resolve(__dirname, '../python/embed_worker.py');

const pendingRequests = new Map();

let worker = null;
let workerReady = null;
let nextRequestId = 1;

export function buildFaqText(faq) {
  const tags = Array.isArray(faq.tags) && faq.tags.length > 0 ? `\nTags: ${faq.tags.join(', ')}` : '';
  return `Category: ${faq.category || 'General'}\nQuestion: ${faq.question}\nAnswer: ${faq.answer}${tags}`;
}

function rejectPendingRequests(error) {
  for (const request of pendingRequests.values()) {
    clearTimeout(request.timeout);
    request.reject(error);
  }

  pendingRequests.clear();
}

function handleWorkerLine(line) {
  if (!line.trim()) return;

  const payload = JSON.parse(line);

  if (payload.type === 'ready') {
    workerReady?.resolve();
    return;
  }

  const request = pendingRequests.get(payload.id);
  if (!request) return;

  pendingRequests.delete(payload.id);
  clearTimeout(request.timeout);

  if (payload.error) {
    request.reject(new Error(`Embedding worker failed: ${payload.error}`));
    return;
  }

  request.resolve(payload.embeddings);
}

function startWorker() {
  workerReady = {};
  workerReady.promise = new Promise((resolve, reject) => {
    workerReady.resolve = resolve;
    workerReady.reject = reject;
  });

  worker = spawn(env.pythonBin, [embedScriptPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      FLAG_EMBEDDING_MODEL: env.flagEmbeddingModel
    }
  });

  let stdoutBuffer = '';

  worker.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop() || '';

    for (const line of lines) {
      handleWorkerLine(line);
    }
  });

  worker.stderr.on('data', (chunk) => {
    const message = chunk.toString().trim();
    if (message) console.error(`[embedding-worker] ${message}`);
  });

  worker.on('error', (error) => {
    workerReady?.reject(error);
    rejectPendingRequests(error);
  });

  worker.on('close', (code) => {
    const error = new Error(`Embedding worker exited with code ${code}`);
    workerReady?.reject(error);
    rejectPendingRequests(error);
    worker = null;
    workerReady = null;
  });

  return workerReady.promise;
}

async function getWorker() {
  if (!worker) {
    await startWorker();
    return worker;
  }

  await workerReady.promise;
  return worker;
}

export async function embedTexts(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  const activeWorker = await getWorker();
  const id = nextRequestId;
  nextRequestId += 1;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Embedding request timed out after ${env.embeddingTimeoutMs}ms`));
    }, env.embeddingTimeoutMs);

    pendingRequests.set(id, { resolve, reject, timeout });
    activeWorker.stdin.write(`${JSON.stringify({ id, texts })}\n`);
  });
}

export async function embedFaq(faq) {
  const [embedding] = await embedTexts([buildFaqText(faq)]);
  return embedding;
}
