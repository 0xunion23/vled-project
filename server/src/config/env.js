import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/faq_vled_rag',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  minConfidence: Number(process.env.MIN_CONFIDENCE || 0.45),
  topK: Number(process.env.TOP_K || 4),
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'gemma3:4b',
  flagEmbeddingModel: process.env.FLAG_EMBEDDING_MODEL || 'BAAI/bge-small-en-v1.5',
  pythonBin: process.env.PYTHON_BIN || 'python3'
};
