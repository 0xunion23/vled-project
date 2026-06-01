import { connectMongo } from '../db/mongoose.js';
import { Faq } from '../models/Faq.js';
import { seedFaqs } from '../data/seedFaqs.js';
import { embedTexts, buildFaqText } from '../services/embeddingService.js';

await connectMongo();

await Faq.deleteMany({});

const embeddings = await embedTexts(seedFaqs.map(buildFaqText));
const records = seedFaqs.map((faq, index) => ({
  ...faq,
  embedding: embeddings[index]
}));

await Faq.insertMany(records);

console.log(`Seeded and embedded ${seedFaqs.length} FAQ records.`);
process.exit(0);
