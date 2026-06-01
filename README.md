# FAQ VLED RAG Chatbot

MERN-based RAG chatbot matching the provided architecture, with escalation intentionally left out for now.

The chatbot is fully local:

- MongoDB stores FAQ documents and their embeddings.
- FlagEmbedding builds local BGE embeddings.
- The retriever ranks FAQ vectors with cosine similarity.
- Ollama runs the local chat model that writes the final answer.
- React provides the user chat page.

## Flow

1. User asks a question in the React page.
2. Express embeds the query with FlagEmbedding.
3. The retriever compares the query vector against FAQ vectors in MongoDB.
4. The top contexts are passed to Ollama.
5. Ollama answers only from retrieved context.
6. If confidence is below `MIN_CONFIDENCE`, the API returns a fallback message without escalation.

## Requirements

- Node.js and npm
- MongoDB running locally
- Python 3.10+
- Ollama running locally
- A pulled Ollama chat model, for example:

```bash
ollama pull gemma3:4b
```

## Setup

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
npm run install:all
python3 -m pip install -r server/requirements.txt
npm run seed
npm run dev
```

Client: `http://localhost:5173`

Server: `http://localhost:5001`

MongoDB defaults to `mongodb://127.0.0.1:27017/faq_vled_rag`.

Ollama defaults to `http://127.0.0.1:11434` using `gemma3:4b`.

## Environment

`server/.env`:

```bash
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/faq_vled_rag
CLIENT_ORIGIN=http://localhost:5173
MIN_CONFIDENCE=0.45
TOP_K=4
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gemma3:4b
FLAG_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
PYTHON_BIN=python3
```

## Reindexing

Run this after editing FAQ text directly in MongoDB:

```bash
npm run reindex --prefix server
```

## API

```http
POST /api/chat
Content-Type: application/json

{
  "message": "Where is FAQ data stored?"
}
```

Response:

```json
{
  "answer": "FAQ data is stored in MongoDB...",
  "answerFound": true,
  "confidence": 0.71,
  "sources": [
    {
      "id": "...",
      "question": "Where is FAQ data stored?",
      "category": "Storage",
      "score": 0.7123
    }
  ]
}
```
