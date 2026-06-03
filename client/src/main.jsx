import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';
import { 
  Bot, Circle, Database, Loader2, MessageSquare, Send, UserRound, 
  ThumbsUp, ThumbsDown, RefreshCw, RotateCcw, Copy, Check, Pencil, ArrowDown 
} from 'lucide-react';
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

function Message({ message, isLatestBotMessage, onRegenerate, onEditPrompt }) {
  const isUser = message.role === 'user';
  const [vote, setVote] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className={`message ${isUser ? 'userMessage' : 'botMessage'}`}>
      <div className="messageAvatar">{isUser ? <UserRound size={18} /> : <Bot size={18} />}</div>
      <div className="bubble">
        <div className="messageHeader" style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <strong>{isUser ? 'You' : 'OxEngine'}</strong>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{message.timestamp}</span>
          {!isUser && message.confidence !== undefined && (
            <ConfidenceBadge found={message.answerFound} confidence={message.confidence} />
          )}
        </div>
        
        {isUser && isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', marginTop: '6px' }}>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              style={{
                width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1',
                fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                background: 'var(--input-bg, #ffffff)', color: 'var(--text-color, #000000)'
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button 
                type="button"
                onClick={() => { setIsEditing(false); setEditText(message.text); }}
                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontSize: '12px', color: '#334155' }}
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => {
                  if (editText.trim() && editText.trim() !== message.text) {
                    onEditPrompt(message.id, editText.trim());
                  }
                  setIsEditing(false);
                }}
                style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontSize: '12px' }}
              >
                Save & Submit
              </button>
            </div>
          </div>
        ) : (
          <p>{message.text}</p>
        )}
        
        {isUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
            <button 
              onClick={handleCopy}
              title="Copy prompt"
              style={{ 
                background: 'none', border: 'none', cursor: 'pointer', 
                color: copied ? '#22c55e' : '#6b7280' 
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
            
            {!isEditing && (
              <button 
                onClick={() => { setIsEditing(true); setEditText(message.text); }}
                title="Edit prompt"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
              >
                <Pencil size={15} />
              </button>
            )}
          </div>
        ) : (
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
  const [mostAskedQuestions, setMostAskedQuestions] = useState([]);
  
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'auto');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [analyticsData, setAnalyticsData] = useState([]);

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
    const root = document.documentElement;
    localStorage.setItem('theme', theme);

    if (theme === 'auto') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.setAttribute('data-theme', systemTheme);
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  async function fetchMostAskedQuestions() {
  try {
    const response = await fetch(`${API_URL}/api/most-asked`);

    if (!response.ok) {
      throw new Error('Failed to fetch questions');
    }

    const data = await response.json();

    setMostAskedQuestions(data);
  } catch (error) {
    console.error('Failed to load most asked questions:', error);
  }
}

useEffect(() => {
  fetchMostAskedQuestions();
}, []);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);
  useEffect(() => {
  fetch('http://localhost:5000/api/analytics/daily-searches')
    .then((res) => res.json())
    .then((data) => setAnalyticsData(data))
    .catch((err) => console.error(err));
}, []);

  function handleScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 400;
    setShowScrollButton(isScrolledUp);
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

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

  async function handleEditPrompt(id, newText) {
    if (isLoading) return;

    const targetIndex = messages.findIndex(m => m.id === id);
    if (targetIndex === -1) return;

    const truncatedHistory = messages.slice(0, targetIndex + 1);
    truncatedHistory[targetIndex].text = newText;
    truncatedHistory[targetIndex].timestamp = getTime();

    setMessages(truncatedHistory);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newText })
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
      
      await fetchMostAskedQuestions();
      
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
      
      await fetchMostAskedQuestions();
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
      
      await fetchMostAskedQuestions();
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
      <section className="chatPanel" aria-label="RAG chatbot" style={{ position: 'relative' }}>
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
            
            <select 
              value={theme} 
              onChange={(e) => setTheme(e.target.value)}
              title="Change color theme"
              style={{
                padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0',
                background: 'white', cursor: 'pointer', color: '#64748b', fontSize: '13px',
                fontWeight: '500', outline: 'none'
              }}
            >
              <option value="auto">💻 Auto</option>
              <option value="light">☀️ Light</option>
              <option value="dark">🌙 Dark</option>
            </select>

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

        <div className="messages" onScroll={handleScroll}>
          {messages.map((message, index) => {
            const isLatestBotMessage = message.role === 'assistant' && index === messages.length - 1;
            
            return (
              <Message 
                key={message.id} 
                message={message} 
                isLatestBotMessage={isLatestBotMessage}
                onRegenerate={handleRegenerate}
                onEditPrompt={handleEditPrompt} 
              />
            );
          })}
          {isLoading && (
            <article className="message botMessage">
              <div className="messageAvatar">
                <Bot size={18} />
              </div>
              <div className="bubble loadingBubble">
                <Loader2 size={18} className="spin" />
                Retrieving context
              </div>
            </article>
          )}
          <div ref={messagesEndRef} />
        </div>

        <button 
          onClick={scrollToBottom}
          title="Scroll to latest message"
          style={{
            position: 'absolute',
            bottom: '230px',
            left: '50%',
            opacity: showScrollButton ? 1 : 0,
            transform: showScrollButton ? 'translate(-50%, 0)' : 'translate(-50%, 20px)',
            pointerEvents: showScrollButton ? 'auto' : 'none',
            transition: 'opacity 0.3s ease, transform 0.3s ease',
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: '#345df7',
            color: 'white',
            border: 'none',
            boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10
          }}
        >
          <ArrowDown size={22} />
        </button>

        {mostAskedQuestions.length > 0 && (
<div className="mostAskedSection" aria-label="Most Asked Questions">
    <h3
      style={{
        width: '100%',
        margin: '0 0 10px 0',
        color: '#64748b',
        fontSize: '14px',
        fontWeight: '700'
      }}
    >
      Most Asked Questions (Top 20)
    </h3>

    {mostAskedQuestions.map((question) => (
      <button
        key={question._id || question.normalizedQuestion}
        type="button"
        onClick={() => useQuickPrompt(question.displayQuestion)}
      >
        {question.displayQuestion} ({question.count})
      </button>
    ))}
  </div>
)}

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

<div style={{ marginTop: '30px', padding: '20px' }}>
  <h2>📈 Daily Search Analytics</h2>

  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={analyticsData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="_id.date" />
      <YAxis />
      <Tooltip />
      <Line
        type="monotone"
        dataKey="count"
        stroke="#2563eb"
        strokeWidth={3}
      />
    </LineChart>
  </ResponsiveContainer>

  <p style={{ marginTop: '10px' }}>
    Total Searches:
    {' '}
    {analyticsData.reduce((sum, item) => sum + item.count, 0)}
  </p>
</div>

</section>
</main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
