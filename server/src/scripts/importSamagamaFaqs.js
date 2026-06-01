import { connectMongo } from '../db/mongoose.js';
import { Faq } from '../models/Faq.js';
import { buildFaqText, embedTexts } from '../services/embeddingService.js';

const FAQ_URL = 'https://samagama.in/internship/faq';

function decodeHtml(value) {
  return String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));
}

function stripTags(value) {
  return decodeHtml(
    String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '- ')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function removeNumberPrefix(value) {
  return value.replace(/^\d+(?:\.\d+)*\s+/, '').trim();
}

function parseSections(html) {
  const sections = [];
  const sectionRegex = /<h2\b[^>]*id="(s-\d+)"[^>]*>([\s\S]*?)<\/h2>/gi;
  let match;

  while ((match = sectionRegex.exec(html)) !== null) {
    sections.push({
      id: match[1],
      index: match.index,
      title: removeNumberPrefix(stripTags(match[2]))
    });
  }

  return sections;
}

function sectionForIndex(sections, index) {
  let current = 'Vicharanashala Internship';

  for (const section of sections) {
    if (section.index > index) break;
    current = section.title;
  }

  return current;
}

function parseFaqs(html) {
  const sections = parseSections(html);
  const faqRegex =
    /<details\b[^>]*class="[^"]*\bfaq-q\b[^"]*"[^>]*id="([^"]+)"[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi;
  const faqs = [];
  let match;

  while ((match = faqRegex.exec(html)) !== null) {
    const sourceId = match[1];
    const rawQuestion = stripTags(match[2]);
    const question = removeNumberPrefix(rawQuestion);
    const answer = stripTags(match[3]);
    const category = sectionForIndex(sections, match.index);

    if (!question || !answer) continue;

    faqs.push({
      question,
      answer,
      category,
      sourceId,
      sourceUrl: `${FAQ_URL}#${sourceId}`,
      tags: ['samagama', 'vicharanashala', 'internship', category.toLowerCase()]
    });
  }

  return faqs;
}

const response = await fetch(FAQ_URL);

if (!response.ok) {
  throw new Error(`Failed to fetch ${FAQ_URL}: ${response.status}`);
}

const html = await response.text();
const faqs = parseFaqs(html);

if (faqs.length === 0) {
  throw new Error('No FAQ records were parsed from the Samagama page.');
}

await connectMongo();

const embeddings = await embedTexts(faqs.map(buildFaqText));
let upserted = 0;
let modified = 0;

for (const [index, faq] of faqs.entries()) {
  const result = await Faq.updateOne(
    { sourceId: faq.sourceId },
    {
      $set: {
        ...faq,
        embedding: embeddings[index],
        isActive: true
      }
    },
    { upsert: true }
  );

  upserted += result.upsertedCount || 0;
  modified += result.modifiedCount || 0;
}

console.log(`Imported ${faqs.length} Samagama FAQ records.`);
console.log(`Inserted: ${upserted}, updated: ${modified}.`);
process.exit(0);
