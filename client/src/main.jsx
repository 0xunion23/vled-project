import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Bot, Circle, Database, Loader2, MessageSquare, Send, UserRound, ThumbsUp, ThumbsDown, RefreshCw, RotateCcw, Copy, Check } from 'lucide-react';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const QUICK_PROMPTS = [
  'Who can sign the NOC?',
  'Is there a stipend?',
  'How long is the internship?',
  'How do I log in to ViBe?'
];

const getTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function ConfidenceBadge({ found, confidence }) {
  return (
    <span className={found ? 'badge badgeFound' : 'badge badgeLow'}>
      <Circle size={8} fill="currentColor" />
      {found ? `${Math.round(confidence * 100)}% match` : 'Low confidence'}
    </span>
  );
}

function Message({ message, isLatestBotMessage, onRegenerate }) {
  const isUser = message.role === 'user';
  const [vote, setVote] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className={`message ${isUser ? 'userMessage' : 'botMessage'}`}>
      <div className="messageAvatar">{isUser ? <UserRound size={18} /> : <UserRound size={18} />}</div>
      <div className="bubble">
        <div className="messageHeader" style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <strong>{isUser ? 'You' : 'OxEngine'}</strong>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{message.timestamp}</span>
          {!isUser && message.confidence !== undefined && (
            <ConfidenceBadge found={message.answerFound} confidence={message.confidence} />
          )}
        </div>
        <p>{message.text}</p>
        
        {!isUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
            <button 
              onClick={() => setVote('up')}
              title="Helpful"
              style={{ 
                background: 'none', border: 'none', cursor: 'pointer', 
                color: vote === 'up' ? '#22c55e' : '#6b7280' 
              }}
            >
              <ThumbsUp size={16} />
            </button>
            
            <button 
              onClick={() => setVote('down')}
              title="Not helpful"
              style={{ 
                background: 'none', border: 'none', cursor: 'pointer', 
                color: vote === 'down' ? '#ef4444' : '#6b7280' 
              }}
            >
              <ThumbsDown size={16} />
            </button>

            <button 
              onClick={handleCopy}
              title="Copy answer"
              style={{ 
                background: 'none', border: 'none', cursor: 'pointer', 
                color: copied ? '#22c55e' : '#6b7280' 
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>

            {isLatestBotMessage && (
              <button 
                onClick={onRegenerate}
                title="Regenerate response"
                style={{ 
                  background: 'none', border: 'none', cursor: 'pointer', 
                  color: '#6b7280', display: 'flex', alignItems: 'center', 
                  gap: '4px', fontSize: '13px', marginLeft: 'auto' 
                }}
              >
                <RotateCcw size={14} /> Regenerate
              </button>
            )}
          </div>
        )}

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
  const messagesEndRef = useRef(null);
  
  const [messages, setMessages] = useState([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: "Hi there! I'm OxEngine, your FAQ assistant. Ask me anything and I'll find the best answer for you.",
      answerFound: true,
      confidence: 1,
      sources: [],
      timestamp: getTime()
    }
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  function handleRefresh() {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: "Hi there! I'm OxEngine, your FAQ assistant. Ask me anything and I'll find the best answer for you.",
        answerFound: true,
        confidence: 1,
        sources: [],
        timestamp: getTime()
      }
    ]);
    setInput('');
    setIsLoading(false);
  }

  async function handleRegenerate() {
    if (isLoading) return;
    
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return; 
    const lastUserText = userMessages[userMessages.length - 1].text;

    const newMessages = [...messages];
    if (newMessages[newMessages.length - 1].role === 'assistant') {
      newMessages.pop();
    }
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: lastUserText })
      });

      if (!response.ok) throw new Error('Request failed');

      const data = await response.json();
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: data.answer,
          answerFound: data.answerFound,
          confidence: data.confidence,
          sources: data.sources,
          timestamp: getTime()
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
          sources: [],
          timestamp: getTime()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text, timestamp: getTime() }]);
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
          sources: data.sources,
          timestamp: getTime()
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
          sources: [],
          timestamp: getTime()
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={handleRefresh}
              title="Clear conversation"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0',
                background: 'white', cursor: 'pointer', color: '#64748b', fontSize: '13px',
                fontWeight: '500'
              }}
            >
              <RefreshCw size={14} /> Refresh Chat
            </button>

            <div className="statusPill">
              <Circle size={10} fill="currentColor" />
              Escalation off
            </div>
          </div>
        </header>

        <div className="messages">
          {messages.map((message, index) => {
            const isLatestBotMessage = message.role === 'assistant' && index === messages.length - 1;
            
            return (
              <Message 
                key={message.id} 
                message={message} 
                isLatestBotMessage={isLatestBotMessage}
                onRegenerate={handleRegenerate}
              />
            );
          })}
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
          <div ref={messagesEndRef} />
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