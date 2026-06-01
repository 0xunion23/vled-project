import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bot, Circle, Database, Loader2, MessageSquare, Send, UserRound } from 'lucide-react';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const QUICK_PROMPTS = [
  'Who can sign the NOC?',
  'Is there a stipend?',
  'How long is the internship?',
  'How do I log in to ViBe?'
];

function ConfidenceBadge({ found, confidence }) {
  return (
    <span className={found ? 'badge badgeFound' : 'badge badgeLow'}>
      <Circle size={8} fill="currentColor" />
      {found ? `${Math.round(confidence * 100)}% match` : 'Low confidence'}
    </span>
  );
}

function Message({ message }) {
  const isUser = message.role === 'user';

  return (
    <article className={`message ${isUser ? 'userMessage' : 'botMessage'}`}>
      <div className="messageAvatar">{isUser ? <UserRound size={18} /> : <UserRound size={18} />}</div>
      <div className="bubble">
        <div className="messageHeader">
          <strong>{isUser ? 'You' : 'OxEngine'}</strong>
          {!isUser && message.confidence !== undefined && (
            <ConfidenceBadge found={message.answerFound} confidence={message.confidence} />
          )}
        </div>
        <p>{message.text}</p>
        {!isUser && message.sources?.length > 0 && (
          <div className="sources">
            {message.sources.map((source) => (
              <span key={source.id}>
                <Database size={13} />
                {source.category}: {source.question}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function App() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: "Hi there! I'm OxEngine, your FAQ assistant. Ask me anything and I'll find the best answer for you.",
      answerFound: true,
      confidence: 1,
      sources: []
    }
  ]);

  async function sendMessage(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      if (!response.ok) {
        throw new Error('Request failed');
      }

      const data = await response.json();
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: data.answer,
          answerFound: data.answerFound,
          confidence: data.confidence,
          sources: data.sources
        }
      ]);
    } catch (_error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'The chatbot API is not reachable. Check that Express, MongoDB, and Ollama are running.',
          answerFound: false,
          confidence: 0,
          sources: []
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function useQuickPrompt(prompt) {
    setInput(prompt);
  }

  return (
    <main className="appShell">
      <section className="chatPanel" aria-label="RAG chatbot">
        <header className="topBar">
          <div className="brandBlock">
            <div className="brandIcon">
              <Bot size={22} />
            </div>
            <div>
              <div className="titleRow">
                <h1>FAQ OxEngine</h1>
                <span className="versionTag">v2.1</span>
              </div>
              <p>Answers from the FAQ knowledge base</p>
            </div>
          </div>
          <div className="statusPill">
            <Circle size={10} fill="currentColor" />
            Escalation off
          </div>
        </header>

        <div className="messages">
          {messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
          {isLoading && (
            <article className="message botMessage">
              <div className="messageAvatar">
                <UserRound size={18} />
              </div>
              <div className="bubble loadingBubble">
                <Loader2 size={18} className="spin" />
                Retrieving context
              </div>
            </article>
          )}
        </div>

        <div className="quickPrompts" aria-label="Suggested questions">
          {QUICK_PROMPTS.map((prompt) => (
            <button key={prompt} type="button" onClick={() => useQuickPrompt(prompt)}>
              {prompt}
            </button>
          ))}
        </div>

        <form className="composer" onSubmit={sendMessage}>
          <div className="inputShell">
            <MessageSquare size={21} />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask a question..."
              aria-label="Question"
            />
            <button type="submit" disabled={isLoading || !input.trim()} aria-label="Send message">
              <Send size={18} />
            </button>
          </div>
          <p>Press Enter to send · Shift+Enter for new line</p>
        </form>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
