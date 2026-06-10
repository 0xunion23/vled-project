import Conversation from '../models/Conversation.js';

const MAX_STORED_MESSAGES = 50;
const MEMORY_QUERY_LIMIT = 3;

function userIdOf(user) {
  return user?._id || user?.id || user;
}

export async function getActiveConversation(user) {
  const userId = userIdOf(user);
  let conversation = await Conversation.findOne({ userId, status: 'active' }).sort({ updatedAt: -1 });

  if (!conversation) {
    conversation = await Conversation.create({ userId, messages: [] });
  }

  return conversation;
}

export async function getConversationHistory(user) {
  const conversation = await getActiveConversation(user);

  return conversation.messages.map((message) => ({
    id: String(message._id),
    role: message.role,
    text: message.text,
    answerFound: message.answerFound,
    confidence: message.confidence,
    sources: message.sources || [],
    createdAt: message.createdAt
  }));
}

export async function getRecentMemoryQueries(user) {
  const conversation = await getActiveConversation(user);

  return conversation.messages
    .filter((message) => message.role === 'user' && message.memoryEligible)
    .slice(-MEMORY_QUERY_LIMIT)
    .map((message) => message.text);
}

export async function appendConversationTurn(user, { query, result, memoryEligible }) {
  const conversation = await getActiveConversation(user);

  conversation.messages.push({
    role: 'user',
    text: query,
    memoryEligible
  });

  conversation.messages.push({
    role: 'assistant',
    text: result.answer,
    answerFound: result.answerFound,
    confidence: result.confidence,
    sources: result.sources || []
  });

  if (conversation.messages.length > MAX_STORED_MESSAGES) {
    conversation.messages = conversation.messages.slice(-MAX_STORED_MESSAGES);
  }

  await conversation.save();
}

export async function resetConversation(user) {
  const userId = userIdOf(user);

  await Conversation.updateMany(
    { userId, status: 'active' },
    {
      $set: {
        status: 'archived',
        archivedAt: new Date()
      }
    }
  );
}
