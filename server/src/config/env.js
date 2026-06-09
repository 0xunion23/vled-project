import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/faq_vled_rag',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  minConfidence: Number(process.env.MIN_CONFIDENCE || 0.53),
  topK: Number(process.env.TOP_K || 4),
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'gemma3:4b',
  ollamaKeepAlive: process.env.OLLAMA_KEEP_ALIVE || '30m',
  ollamaNumCtx: Number(process.env.OLLAMA_NUM_CTX || 2048),
  ollamaNumPredict: Number(process.env.OLLAMA_NUM_PREDICT || 120),
  ollamaWarmupTimeoutMs: Number(process.env.OLLAMA_WARMUP_TIMEOUT_MS || 20000),
  flagEmbeddingModel: process.env.FLAG_EMBEDDING_MODEL || 'BAAI/bge-small-en-v1.5',
  pythonBin: process.env.PYTHON_BIN || 'python3',
  embeddingTimeoutMs: Number(process.env.EMBEDDING_TIMEOUT_MS || 30000),
  jwtSecret: process.env.JWT_SECRET || 'change-this-secret-in-production'
};
