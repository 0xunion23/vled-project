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
| `OLLAMA_MODEL` | `gemma3:4b` |
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
OLLAMA_MODEL=gemma3:4b
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
| Memory constraint | `gemma3:4b` requires ~4GB RAM. Larger models need more memory. |
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

---

## Feature: Org FAQ Bot Creator & Shareable Link

### Overview

This feature extends FAQ OxEngine from a single fixed chatbot into a platform where any visitor can create their own branded FAQ chatbot for their organisation — in under two minutes, with no technical setup — and share it with anyone via a link.

The existing global FAQ pipeline (`POST /api/chat`, `ragService.js`, `faqs` collection) is completely untouched. Everything new is additive.

---

### What Changes

| Type | File | Change |
|------|------|--------|
| New model | `server/src/models/Organisation.js` | Stores org name, domain, description, tone |
| New model | `server/src/models/OrgFaq.js` | Per-org FAQs with BGE embedding vector |
| New service | `server/src/services/orgRagService.js` | RAG pipeline scoped to a single org |
| New routes | `server/src/routes/orgRoutes.js` | 4 new API routes |
| Modified | `server/src/index.js` | 2 lines added — import + mount orgRouter |
| Modified | `client/src/main.jsx` | 4 new views added alongside existing chat |
| Modified | `client/src/styles.css` | New CSS classes appended at bottom |

---

### Architecture (updated)

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                         │
│                    React Frontend (Vite)                     │
│                     localhost:5173                           │
│                                                             │
│  View: home       → existing FAQ chat (unchanged)           │
│  View: create     → org details form                        │
│  View: review     → editable FAQ list                       │
│  View: share      → shareable link screen                   │
│  View: orgChat    → branded FAQ chat for visitors           │
└──────────────┬──────────────────────┬───────────────────────┘
               │                      │
    POST /api/chat              POST /api/orgs/*
    (unchanged)                 (new routes)
               │                      │
               ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express API Server                        │
│                      localhost:5001                          │
│                                                             │
│   Existing:  POST /api/chat      → ragService.js            │
│              GET  /api/faqs      → faqRoutes.js             │
│              POST /api/faqs      → faqRoutes.js             │
│                                                             │
│   New:       POST /api/orgs/generate  → Ollama prompt       │
│              POST /api/orgs           → save + embed FAQs   │
│              GET  /api/orgs/:orgId    → org profile         │
│              POST /api/orgs/:orgId/chat → orgRagService     │
└──────┬───────────────────┬───────────────────┬─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐  ┌──────────────────┐  ┌─────────────────┐
│   Python    │  │     MongoDB      │  │     Ollama      │
│ (BGE embed) │  │  faq_vled_rag    │  │  gemma3:4b      │
│             │  │                  │  │                 │
│  Same model │  │  faqs (existing) │  │  1. Generate    │
│  same script│  │  organisations   │  │     draft FAQs  │
│  now also   │  │  orgfaqs  ← new  │  │  2. Answer      │
│  batch-     │  │                  │  │     org chat    │
│  embeds org │  │                  │  │     queries     │
│  FAQs       │  │                  │  │                 │
└─────────────┘  └──────────────────┘  └─────────────────┘
```

---

### New Request Flows

#### Creator: Generate FAQs

```
Creator fills form (name, domain, description, tone)
         │
         ▼
  POST /api/orgs/generate
         │
         ▼
  Express builds a structured prompt:
  "Generate 15 FAQs for org X in domain Y... return only JSON array"
         │
         ▼
  Ollama returns JSON array of { question, answer, category }
         │
         ▼
  Strip markdown fences, parse JSON, fallback regex if needed
         │
         ▼
  Return faqs[] to frontend for review — nothing saved yet
```

#### Creator: Publish

```
Creator approves / edits / adds FAQs, clicks Publish
         │
         ▼
  POST /api/orgs  { name, domain, description, tone, faqs[] }
         │
         ▼
  Organisation.create() → saves org to MongoDB
         │
         ▼
  embedTexts([faq1.question + faq1.answer, faq2...])
  → single batch Python call → 384-dim vectors for all FAQs
         │
         ▼
  OrgFaq.insertMany(faqDocs with embeddings)
         │
         ▼
  Return { orgId, name, faqCount }
         │
         ▼
  Frontend shows shareable link: site.com/?org=<orgId>
```

#### Visitor: Chat via shared link

```
Visitor opens site.com/?org=<orgId>
         │
         ▼
  App reads ?org= query param on load
  GET /api/orgs/:orgId → fetch org name + domain for header
         │
         ▼
  Visitor types question
  POST /api/orgs/:orgId/chat { message }
         │
         ▼
  orgRagService.answerOrgQuestion(orgId, query)
         │
         ▼
  embedTexts([query]) → 384-dim query vector
         │
         ▼
  OrgFaq.find({ orgId }) → load this org's FAQs (in-memory cache)
  dot product similarity against all org FAQ vectors
  rank, pick top-K
         │
         ▼
  best_score >= MIN_CONFIDENCE?
         │
      ┌──┴──┐
     YES    NO
      │      │
      │      ▼
      │   Return fallback:
      │   "I don't have enough information in
      │    this organisation's FAQs to answer that."
      │
      ▼
  generateWithOllama({ query, contexts })
         │
         ▼
  Return { answer, answerFound, confidence, sources }
```

---

### New API Routes

#### `POST /api/orgs/generate`

Generates a draft FAQ list from org details. Nothing is saved.

**Request:**
```json
{
  "name": "Acme Corp",
  "domain": "E-commerce",
  "description": "We sell handmade furniture online and ship across India.",
  "tone": "friendly"
}
```

**Response:**
```json
{
  "faqs": [
    { "question": "How long does shipping take?", "answer": "We deliver in 5-7 days...", "category": "Services" },
    { "question": "Do you offer returns?",        "answer": "Yes, within 30 days...",   "category": "Policies" }
  ]
}
```

---

#### `POST /api/orgs`

Saves the organisation and all approved FAQs with embeddings.

**Request:**
```json
{
  "name": "Acme Corp",
  "domain": "E-commerce",
  "description": "...",
  "tone": "friendly",
  "faqs": [
    { "question": "...", "answer": "...", "category": "Services" }
  ]
}
```

**Response:**
```json
{ "orgId": "64f3a1...", "name": "Acme Corp", "faqCount": 15 }
```

---

#### `GET /api/orgs/:orgId`

Returns the org profile for the visitor's chat page header.

**Response:**
```json
{
  "org": {
    "_id": "64f3a1...",
    "name": "Acme Corp",
    "domain": "E-commerce",
    "description": "...",
    "tone": "friendly"
  }
}
```

---

#### `POST /api/orgs/:orgId/chat`

RAG chat scoped to a single org's FAQ collection.

**Request:**
```json
{ "message": "Do you ship internationally?" }
```

**Response:**
```json
{
  "answer": "Yes, we ship to 12 countries...",
  "answerFound": true,
  "confidence": 0.76,
  "sources": [
    { "id": "...", "question": "Do you ship internationally?", "category": "Services", "score": 0.76 }
  ]
}
```

---

### New Database Collections

#### `organisations`

```
{
  _id:         ObjectId,
  name:        String (required),
  description: String (required),
  domain:      String (required),
  tone:        String (enum: friendly | formal | technical | casual),
  createdAt:   Date,
  updatedAt:   Date
}
```

#### `orgfaqs`

```
{
  _id:       ObjectId,
  orgId:     ObjectId  → organisations._id  (indexed),
  question:  String (required),
  answer:    String (required),
  category:  String (default: "General"),
  tags:      [String],
  embedding: [Number]  (384-dim BGE vector),
  isActive:  Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

The existing `faqs` collection is not touched.

---

### Frontend Views

Navigation between views is managed via React state — no router library is added.

| State | URL | What the user sees |
|-------|-----|-------------------|
| `home` | `site.com/` | Existing FAQ chat — unchanged. ✨ Create FAQ Bot button in header. |
| `create` | `site.com/` | Org details form (name, domain, description, tone picker). |
| `review` | `site.com/` | Editable FAQ cards — inline edit, category dropdown, delete, add. |
| `share` | `site.com/` | Success screen with shareable link and one-click copy. |
| `orgChat` | `site.com/?org=<id>` | Branded chat UI — org name/domain in header, RAG answers from org FAQs only. |

The `?org=<id>` query param is read on mount. If present, the app starts directly in `orgChat` view — so the shared link works without any server-side routing.

---

### Design Decisions

**Why separate `orgfaqs` collection instead of adding `orgId` to `faqs`?**
Keeps the existing global RAG pipeline fully isolated. Org retrieval only scores against its own vectors — no risk of cross-contamination, and the existing pipeline needs zero changes.

**Why batch-embed all FAQs in one Python call?**
`embedTexts([...])` — the existing batch embedding function — processes all texts in a single subprocess invocation. For 15 FAQs this is ~10x faster than calling the embedder per FAQ.

**Why in-memory cache per org?**
`orgRagService.js` mirrors the pattern in `ragService.js` — load FAQ vectors once, cache in a `Map` keyed by `orgId`, invalidate on new FAQ insert. Each org only loads its own vectors, so memory usage scales per active org, not total FAQ count.

**Why not add `orgId` to the existing `/api/chat` route?**
Keeping them as separate routes (`/api/chat` vs `/api/orgs/:orgId/chat`) makes the code easier to read, test, and maintain independently. It also means the existing chat route stays a single-line handler with zero added complexity.

**Why no router library?**
The existing codebase has no router. Adding one just for this feature would be a larger change than necessary. The `?org=` query param approach achieves deep-linking with a single `URLSearchParams` call on mount.

---

### Updated Component Table

#### Backend — `server/src/`

| File | Purpose |
|------|---------|
| `index.js` | *(updated)* Now also mounts `orgRouter` on `/api/orgs` |
| `models/Faq.js` | *(unchanged)* Global FAQ schema |
| `models/Organisation.js` | *(new)* Org name, domain, description, tone |
| `models/OrgFaq.js` | *(new)* Per-org FAQ with `orgId` ref and embedding |
| `routes/chatRoutes.js` | *(unchanged)* `POST /api/chat` |
| `routes/faqRoutes.js` | *(unchanged)* `GET/POST /api/faqs` |
| `routes/orgRoutes.js` | *(new)* 4 org routes — generate, save, profile, chat |
| `services/ragService.js` | *(unchanged)* Global RAG pipeline |
| `services/orgRagService.js` | *(new)* Per-org RAG pipeline with org-scoped retrieval |
| `services/embeddingService.js` | *(unchanged)* BGE embedder — reused as-is |
| `services/ollamaService.js` | *(unchanged)* Ollama caller — reused as-is |

#### Frontend — `client/src/`

| File | Purpose |
|------|---------|
| `main.jsx` | *(updated)* All existing code kept; `CreateOrgView`, `OrgChatView`, `ShareView` added as new view-state components |
| `styles.css` | *(updated)* All original styles kept; new classes appended under `/* Org FAQ feature additions */` |

---

### Updated Limitations

| Limitation | Detail |
|------------|--------|
| Local only | All infrastructure (MongoDB, Ollama, BGE) runs on the developer's machine |
| No auth | Any visitor can create an org FAQ bot — no login required |
| No edit after publish | Once published, org FAQs cannot be edited. A future endpoint could support this. |
| No org FAQ count limit | No cap on FAQs per org or number of orgs. Rate limiting not implemented. |
| Static org knowledge base | If the org's info changes, a new bot must be created. No update flow yet. |
| Memory constraint | `gemma3:4b` requires ~4GB RAM. Larger models need more memory. |
