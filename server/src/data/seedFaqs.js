export const seedFaqs = [
  {
    question: 'What is the purpose of the RAG chatbot?',
    answer:
      'The RAG chatbot answers user questions by retrieving relevant FAQ context from the knowledge base and generating a grounded response from that context.',
    category: 'Architecture',
    tags: ['rag', 'chatbot', 'overview']
  },
  {
    question: 'How does the chatbot decide whether an answer was found?',
    answer:
      'The chatbot compares the user question with retrieved FAQ context and returns an answer only when the confidence score meets the configured MIN_CONFIDENCE threshold.',
    category: 'Confidence',
    tags: ['confidence', 'threshold']
  },
  {
    question: 'What happens when confidence is low?',
    answer:
      'For the current build, low-confidence questions return a clear fallback message. The escalation system is intentionally not implemented yet.',
    category: 'Fallback',
    tags: ['low confidence', 'fallback', 'escalation']
  },
  {
    question: 'Where is FAQ data stored?',
    answer:
      'FAQ data is stored in MongoDB. The Express server saves FlagEmbedding vectors on FAQ records and retrieves relevant answers with cosine similarity.',
    category: 'Storage',
    tags: ['mongodb', 'retriever', 'vector store']
  },
  {
    question: 'Which local model generates chatbot answers?',
    answer:
      'The chatbot uses a local Ollama chat model to generate final answers from retrieved FAQ context. No external API key is required.',
    category: 'Models',
    tags: ['ollama', 'local model', 'llm']
  },
  {
    question: 'Which embedding model does retrieval use?',
    answer:
      'Retrieval uses the FlagEmbedding package with a BGE embedding model. FAQ embeddings are stored in MongoDB and query embeddings are compared against them with cosine similarity.',
    category: 'Models',
    tags: ['flagembedding', 'bge', 'retrieval']
  }
];
