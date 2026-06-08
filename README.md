# FAQ VLED RAG Chatbot

MERN-based FAQ chatbot that follows the RAG architecture for local question answering. Escalation is intentionally left out for now.

The app runs fully on local services:

- React + Vite provides the chatbot UI.
- Express exposes the FAQ and chat APIs.
- MongoDB stores FAQ documents and saved embeddings.
- A local Python embedding worker builds BGE embeddings with Transformers.
- The retriever ranks stored FAQ vectors against the query vector.
- Ollama runs the local chat model that generates the final answer from retrieved context.

## Architecture Flow

1. A user asks a question in the React chat page.
2. Express sends the query to the embedding worker.
3. The retriever compares the query embedding with FAQ embeddings stored in MongoDB.
4. The top matching FAQ contexts are sent to Ollama.
5. Ollama answers using only the retrieved FAQ context.
6. The API returns the answer, confidence score, and source FAQ records.

## Requirements

- Node.js and npm
- MongoDB running locally
- Python 3.10+
- Ollama running locally
- An Ollama chat model, for example:

```bash
ollama pull gemma3:4b
```

## Setup

Create local environment files:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Install JavaScript dependencies:

```bash
npm run install:all
```

Install Python dependencies:

```bash
python3 -m pip install -r server/requirements.txt
```

Seed the FAQ database:

```bash
npm run seed
```

Run the full project:

```bash
npm run dev
```

Client:

```text
http://localhost:5173
```

Server:

```text
http://localhost:5001
```

## Environment

Default server configuration is in `server/.env.example`:

```bash
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/faq_vled_rag
CLIENT_ORIGIN=http://localhost:5173
MIN_CONFIDENCE=0.53
TOP_K=4
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gemma3:4b
FLAG_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
PYTHON_BIN=python3
EMBEDDING_TIMEOUT_MS=30000
```

## Useful Commands

Run only the server:

```bash
npm run dev --prefix server
```

Run only the client:

```bash
npm run dev --prefix client
```

Build the client:

```bash
npm run build --prefix client
```

Rebuild embeddings after editing FAQ text directly in MongoDB:

```bash
npm run reindex --prefix server
```

Import Samagama FAQ data:

```bash
npm run import:samagama --prefix server
```

## API

Health check:

```http
GET /health
```

Chat:

```http
POST /api/chat
Content-Type: application/json

{
  "message": "How long is the internship?"
}
```

Example response:

```json
{
  "answer": "Two months from your chosen start date...",
  "answerFound": true,
  "confidence": 0.7,
  "sources": [
    {
      "id": "...",
      "question": "How long is the internship?",
      "category": "Timing and dates",
      "score": 0.7008
    }
  ]
}
```

## Notes

- FAQ embeddings are stored in MongoDB; they are not recomputed for every user query.
- User queries are embedded at request time so they can be compared with stored FAQ vectors.
- Ollama and MongoDB must be running before using the chatbot API.
- If the client shows that the chatbot API is unreachable, check Express, MongoDB, and Ollama first.
