import express from 'express';
import { env } from '../config/env.js';
import { Organisation } from '../models/Organisation.js';
import { OrgFaq } from '../models/OrgFaq.js';
import { embedTexts, buildFaqText } from '../services/embeddingService.js';
import { invalidateOrgRetriever, answerOrgQuestion } from '../services/orgRagService.js';

export const orgRouter = express.Router();

// ── POST /api/orgs/generate ──────────────────────────────────────────────────
// Calls Ollama to generate a draft FAQ list from org details.
// Returns the list for the creator to review — nothing is saved yet.
orgRouter.post('/generate', async (req, res, next) => {
  try {
    const { name, description, domain, tone = 'friendly' } = req.body;

    if (!name?.trim() || !description?.trim() || !domain?.trim()) {
      return res.status(400).json({ message: 'name, description and domain are required.' });
    }

    const toneMap = {
      friendly:  'friendly and approachable',
      formal:    'professional and formal',
      technical: 'technical and precise',
      casual:    'casual and conversational',
    };
    const toneLabel = toneMap[tone] || 'friendly and approachable';

    const prompt = `You are an FAQ generator. Given the following organisation details, generate exactly 15 frequently asked questions (FAQs) and their answers.

Organisation name: ${name}
Domain / industry: ${domain}
Description: ${description}
Tone: ${toneLabel}

Rules:
- Cover onboarding, key services, contact info, policies, and common concerns.
- Write answers in a ${toneLabel} tone. Each answer must be 2-4 sentences.
- Return ONLY a valid JSON array, with no markdown, no extra text, no explanation.
- Format exactly: [{"question":"...","answer":"...","category":"..."}]
- Allowed category values: General, Services, Policies, Support, Contact`;

    const response = await fetch(`${env.ollamaBaseUrl}/api/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        model:  env.ollamaModel,
        prompt,
        stream: false,
        options: { temperature: 0.3, num_ctx: 4096 },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama request failed: ${response.status} ${body}`);
    }

    const data = await response.json();
    const raw  = String(data.response || '').trim();

    // Strip accidental markdown fences
    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

    let faqs;
    try {
      faqs = JSON.parse(jsonStr);
    } catch {
      const match = jsonStr.match(/\[[\s\S]*\]/);
      if (!match) {
        return res.status(500).json({ message: 'LLM did not return valid JSON. Please try again.' });
      }
      faqs = JSON.parse(match[0]);
    }

    if (!Array.isArray(faqs) || faqs.length === 0) {
      return res.status(500).json({ message: 'LLM returned an empty FAQ list. Please try again.' });
    }

    return res.json({ faqs });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/orgs ───────────────────────────────────────────────────────────
// Saves the organisation + approved FAQs to MongoDB and computes embeddings.
orgRouter.post('/', async (req, res, next) => {
  try {
    const { name, description, domain, tone = 'friendly', faqs } = req.body;

    if (!name?.trim() || !description?.trim() || !domain?.trim()) {
      return res.status(400).json({ message: 'name, description and domain are required.' });
    }
    if (!Array.isArray(faqs) || faqs.length === 0) {
      return res.status(400).json({ message: 'At least one FAQ is required.' });
    }

    // Save org first
    const org = await Organisation.create({ name: name.trim(), description: description.trim(), domain: domain.trim(), tone });

    // Embed all FAQ texts in a single Python call (batch) — same pattern as embeddingService
    const faqObjects = faqs.map((f) => ({
      orgId:    org._id,
      question: String(f.question || '').trim(),
      answer:   String(f.answer   || '').trim(),
      category: String(f.category || 'General').trim(),
      tags:     Array.isArray(f.tags) ? f.tags : [],
    }));

    const texts = faqObjects.map((f) => buildFaqText(f));
    const embeddings = await embedTexts(texts);

    const faqDocs = faqObjects.map((f, i) => ({ ...f, embedding: embeddings[i] || [] }));
    await OrgFaq.insertMany(faqDocs);

    return res.status(201).json({ orgId: org._id, name: org.name, faqCount: faqDocs.length });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/orgs/:orgId ─────────────────────────────────────────────────────
// Returns org profile for the shared chat page.
orgRouter.get('/:orgId', async (req, res, next) => {
  try {
    const org = await Organisation.findById(req.params.orgId).lean();
    if (!org) return res.status(404).json({ message: 'Organisation not found.' });
    return res.json({ org });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/orgs/:orgId/chat ───────────────────────────────────────────────
// RAG chat scoped to a specific organisation's FAQ collection.
orgRouter.post('/:orgId/chat', async (req, res, next) => {
  try {
    const result = await answerOrgQuestion(req.params.orgId, req.body?.message);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
