# FAQ OxEngine — System Design

## Overview

FAQ OxEngine is a fully local Retrieval-Augmented Generation (RAG) chatbot built for the Vicharanashala internship program at IIT Ropar. It allows users to ask natural language questions and receive accurate, grounded answers sourced from the official FAQ knowledge base — without any external API dependencies.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                         │
│                    React Frontend (Vite)                     │
│                     localhost:5173                           │
└─────────────────────────┬───────────────────────────────────┘
                          │  POST /api/chat { message }
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express API Server                        │
│                      localhost:5001                          │
│                                                             │
│   1. Receives user query                                    │
│   2. Calls Python subprocess to embed the query             │
│   3. Retrieves top-K similar FAQs from MongoDB              │
│   4. Checks confidence threshold                            │
│   5. Sends context + query to Ollama                        │
│   6. Returns structured response                            │
└────────┬──────────────────────┬──────────────────┬──────────┘
         │                      │                  │
         ▼                      ▼                  ▼
┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐
│  Python Process │  │     MongoDB      │  │     Ollama      │
│  (FlagEmbedding)│  │  faq_vled_rag    │  │  gemma3:1b      │
│                 │  │                  │  │                 │
│  Embeds query   │  │  Stores FAQs     │  │  Generates      │
│  into 384-dim   │  │  + 384-dim       │  │  final answer   │
│  vector         │  │  embedding       │  │  from context   │
│                 │  │  vectors         │  │  only           │
└─────────────────┘  └──────────────────┘  └─────────────────┘
```

---

## Request Flow

```
User: "Is there a stipend?"
         │
         ▼
  [1] Express receives message
         │
         ▼
  [2] Python embeds query
      "Is there a stipend?" → [0.023, -0.041, 0.187, ...]  (384 numbers)
         │
         ▼
  [3] Load all FAQ vectors from MongoDB (cached in memory)
      Compute dot product similarity against all 148 FAQ vectors
      Rank by score, pick top 4
         │
         ▼
  [4] Check confidence
      best_score >= MIN_CONFIDENCE (0.45)?
         │
      ┌──┴──┐
     YES    NO
      │      │
      │      ▼
      │   Return fallback:
      │   "I don't have enough information..."
      │
      ▼
  [5] Build prompt for Ollama:
      "Answer using ONLY the retrieved context.
       Context 1: [FAQ text]
       Context 2: [FAQ text]
       ...
       User question: Is there a stipend?"
         │
         ▼
  [6] Ollama generates grounded answer
         │
         ▼
  [7] Return to client:
      {
        answer: "Yes, interns receive...",
        answerFound: true,
        confidence: 0.81,
        sources: [{ question, category, score }, ...]
      }
```

---

## Components

### Frontend — `client/`

| File | Purpose |
|------|---------|
| `src/main.jsx` | Single-file React app — chat UI, message history, confidence badges, source chips, quick prompts |
| `src/styles.css` | Custom CSS — responsive layout, mobile support |
| `index.html` | HTML entry point |
| `.env` | `VITE_API_URL` — points to Express server |

### Backend — `server/src/`

| File | Purpose |
|------|---------|
| `index.js` | Express app entry — CORS, routes, error handler, MongoDB connect |
| `config/env.js` | All config from environment variables with defaults |
| `models/Faq.js` | Mongoose schema — question, answer, category, tags, embedding, isActive |
| `routes/chatRoutes.js` | `POST /api/chat` — accepts message, returns answer |
| `routes/faqRoutes.js` | `GET/POST /api/faqs` — list and add FAQs |
| `services/ragService.js` | Core RAG logic — retrieval, confidence check, answer generation |
| `services/embeddingService.js` | Spawns Python subprocess, sends texts, receives vectors |
| `services/ollamaService.js` | Calls Ollama `/api/generate` with grounded prompt |
| `python/embed_flag.py` | Loads BGE model, encodes texts, returns JSON embeddings |

### Scripts — `server/src/scripts/`

| Script | Command | Purpose |
|--------|---------|---------|
| `seedFaqs.js` | `npm run seed` | Wipes DB, inserts 6 built-in FAQs with embeddings |
| `reindexFaqs.js` | `npm run reindex` | Re-embeds all existing FAQs (run after manual edits) |
| `importSamagamaFaqs.js` | `npm run import:samagama` | Scrapes samagama.in/internship/faq, embeds and upserts all FAQs |

---

## Knowledge Base

The knowledge base lives in MongoDB (`faq_vled_rag.faqs`). It is populated once and queried at runtime — Samagama is never called during a user query.

| Source | FAQs | Topics |
|--------|------|--------|
| Samagama import | 142 | NOC, stipend, ViBe platform, team formation, Rosetta journal, Spurti points, certificates, code of conduct, interviews |
| Built-in seed | 6 | System architecture, confidence, storage, models |
| **Total** | **148** | |

Each FAQ document stores:
- `question` — the FAQ question text
- `answer` — the full answer text
- `category` — section heading from the source page
- `tags` — searchable labels
- `sourceId` / `sourceUrl` — link back to original source
- `embedding` — 384-dimensional BGE vector for semantic search
- `isActive` — soft delete flag

---

## Embedding & Retrieval

**Model:** `BAAI/bge-small-en-v1.5` (384 dimensions, ~130MB, runs locally)

**How similarity works:**
- All FAQ embeddings are L2-normalized at index time
- Query embedding is also normalized at query time
- Dot product of two normalized vectors = cosine similarity
- Score range: 0.0 (unrelated) → 1.0 (identical)

**Retrieval config (via `.env`):**

| Variable | Default | Meaning |
|----------|---------|---------|
| `MIN_CONFIDENCE` | `0.45` | Minimum score to attempt an answer |
| `TOP_K` | `4` | Number of FAQ contexts passed to Ollama |

**In-memory cache:** FAQ vectors are loaded from MongoDB once and cached. Cache is invalidated whenever a new FAQ is added or reindexed.

---

## LLM — Ollama

The LLM only sees the retrieved FAQ context — it has no access to the internet or its own training knowledge for answering. The prompt explicitly instructs it:

```
You are a FAQ support chatbot.
Answer using only the retrieved context.
If the context does not contain the answer, say:
"I do not have enough information in the FAQ knowledge base to answer that."
```

**Config:**

| Variable | Default |
|----------|---------|
| `OLLAMA_MODEL` | `gemma3:1b` |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` |
| Temperature | `0.1` (deterministic) |
| Context window | `4096` tokens |

---

## Environment Variables

### `server/.env`

```env
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/faq_vled_rag
CLIENT_ORIGIN=http://localhost:5173
MIN_CONFIDENCE=0.45
TOP_K=4
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gemma3:1b
FLAG_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
PYTHON_BIN=python
```

### `client/.env`

```env
VITE_API_URL=http://localhost:5001
```

---

## API

### `POST /api/chat`

**Request:**
```json
{ "message": "Is there a stipend?" }
```

**Response:**
```json
{
  "answer": "Yes, interns receive a monthly honorarium...",
  "answerFound": true,
  "confidence": 0.81,
  "sources": [
    {
      "id": "...",
      "question": "What is the stipend amount?",
      "category": "4. Selection, offer letter, and certificate",
      "score": 0.8123
    }
  ]
}
```

**Low confidence response:**
```json
{
  "answer": "I don't have enough information in the FAQ knowledge base to answer that.",
  "answerFound": false,
  "confidence": 0.31,
  "sources": [...]
}
```

### `GET /api/faqs`
Returns all active FAQs.

### `POST /api/faqs`
Adds a new FAQ and auto-embeds it.

---

## Current Limitations

| Limitation | Detail |
|------------|--------|
| Local only | MongoDB, Ollama, and the embedding model all run on the developer's machine. Not accessible to external users. |
| No escalation | Low-confidence queries return a fallback message. No handoff to a human agent is implemented. |
| Static knowledge base | FAQs are not auto-updated. If Samagama content changes, `npm run import:samagama` must be re-run manually. |
| Memory constraint | `gemma3:1b` requires ~1GB RAM. Larger models need more memory. |
| No auth | The API has no authentication. Anyone with network access to port 5001 can query it. |

---

## Path to Production

To make this accessible to real users, the following changes are needed:

1. **Host the server** on a cloud VM (AWS, GCP, DigitalOcean) or containerize with Docker
2. **Use MongoDB Atlas** (free tier) instead of local MongoDB — accessible from anywhere
3. **Replace Ollama** with an API-based LLM (OpenAI, Groq, Gemini) to avoid hosting a local model
4. **Deploy the frontend** to Vercel or Netlify — free, instant
5. **Add authentication** if the chatbot should be restricted to registered interns
6. **Automate FAQ sync** — schedule `import:samagama` to run periodically so the knowledge base stays current
