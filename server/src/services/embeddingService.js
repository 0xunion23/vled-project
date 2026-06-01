import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const embedScriptPath = path.resolve(__dirname, '../python/embed_flag.py');

export function buildFaqText(faq) {
  const tags = Array.isArray(faq.tags) && faq.tags.length > 0 ? `\nTags: ${faq.tags.join(', ')}` : '';
  return `Category: ${faq.category || 'General'}\nQuestion: ${faq.question}\nAnswer: ${faq.answer}${tags}`;
}

export async function embedTexts(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const child = spawn(env.pythonBin, [embedScriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        FLAG_EMBEDDING_MODEL: env.flagEmbeddingModel
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FlagEmbedding process failed: ${stderr || `exit code ${code}`}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed.embeddings);
      } catch (error) {
        reject(new Error(`Could not parse FlagEmbedding output: ${error.message}`));
      }
    });

    child.stdin.write(JSON.stringify({ texts, model: env.flagEmbeddingModel }));
    child.stdin.end();
  });
}

export async function embedFaq(faq) {
  const [embedding] = await embedTexts([buildFaqText(faq)]);
  return embedding;
}
