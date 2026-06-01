import { connectMongo } from '../db/mongoose.js';
import { reindexFaqs } from '../services/ragService.js';

await connectMongo();

const count = await reindexFaqs();
console.log(`Reindexed ${count} FAQ records with FlagEmbedding.`);
process.exit(0);
