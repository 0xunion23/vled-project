import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { 
  Bot, Circle, Database, Loader2, MessageSquare, Send, UserRound,
  ThumbsUp, ThumbsDown, RefreshCw, RotateCcw, Copy, Check, Pencil, ArrowDown,
  ArrowLeft, Trash2, Plus, Volume2, Download, X, ShieldAlert, LogOut, Mail, Lock, ChevronDown
} from 'lucide-react';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const TONE_OPTIONS = [
  { value: 'friendly',  label: 'Friendly' },
  { value: 'formal',    label: 'Formal' },
  { value: 'technical', label: 'Technical' },
  { value: 'casual',    label: 'Casual' },
];
const getTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function makeGreetingMessage() {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    text: getDynamicGreeting(),
    answerFound: true,
    confidence: 1,
    sources: [],
    timestamp: getTime()
  };
}

function formatHistoryTime(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return getTime();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const getDynamicGreeting = () => {
  const hour = new Date().getHours();
  let greeting = "Hi there";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 18) greeting = "Good afternoon";
  else greeting = "Good evening";
  return `${greeting}! I'm OxEngine, your FAQ assistant. Ask me anything and I'll find the best answer for you.`;
};

function AuthView({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed.');
      }

      onAuthenticated(data);
    } catch (authError) {
      setError(authError.message || 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
  }

  return (
    <main className="appShell authShell">
      <section className="authCard" aria-label="Account access">
        <div className="authBrand">
          <div className="brandIcon">
            <Bot size={24} />
          </div>
          <div>
            <h1>FAQ OxEngine</h1>
            <p>Sign in to chat with the FAQ assistant.</p>
          </div>
        </div>

        <div className="authTabs" role="tablist" aria-label="Authentication mode">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>
            Login
          </button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>
            Register
          </button>
        </div>

        <form className="authForm" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label className="authField">
              <span>Name</span>
              <div>
                <UserRound size={18} />
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  required
                />
              </div>
            </label>
          )}

          <label className="authField">
            <span>Email</span>
            <div>
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
          </label>

          <label className="authField">
            <span>Password</span>
            <div>
              <Lock size={18} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 6 characters"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={6}
                required
              />
            </div>
          </label>

          {error && <p className="authError">{error}</p>}

          <button type="submit" className="authSubmit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 size={18} className="spin" /> : null}
            {mode === 'register' ? 'Create account' : 'Login'}
          </button>
        </form>
      </section>
    </main>
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

  const handleReadAloud = () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    } else {
      const utterance = new SpeechSynthesisUtterance(message.text);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <article className={`message ${isUser ? 'userMessage' : 'botMessage'}`}>
      <div className="messageAvatar">{isUser ? <UserRound size={18} /> : <Bot size={18} />}</div>
      <div className="bubble">
        <div className="messageHeader" style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <strong>{isUser ? 'You' : 'OxEngine'}</strong>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{message.timestamp}</span>
        </div>

        {!isUser && message.answerFound === false && (
          <div className="escalationNotice">
            Query escalated for review
          </div>
        )}
        
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
          <p style={{ whiteSpace: 'pre-wrap' }}>{message.text}</p>
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

            <button 
              onClick={handleReadAloud}
              title="Read aloud"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
            >
              <Volume2 size={16} />
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

      </div>
    </article>
  );
}

function DefaultChat({ onCreateOrg, authToken, authUser, onLogout }) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const [mostAskedQuestions, setMostAskedQuestions] = useState([]);
  const [showMostAsked, setShowMostAsked] = useState(false);
  
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'auto');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsData, setAnalyticsData] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  
  const [activeTab, setActiveTab] = useState('analytics');
  const [securityLogs, setSecurityLogs] = useState([]);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState('');

  const [messages, setMessages] = useState(() => [makeGreetingMessage()]);

  useEffect(() => {
    if (!authToken) return;

    let cancelled = false;

    async function loadConversationHistory() {
      try {
        const response = await fetch(`${API_URL}/api/chat/history`, {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        });

        if (response.status === 401) {
          onLogout();
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to load chat history');
        }

        const data = await response.json();
        const historyMessages = Array.isArray(data.messages) ? data.messages : [];

        if (cancelled) return;

        setMessages([
          makeGreetingMessage(),
          ...historyMessages.map((message) => ({
            id: message.id || crypto.randomUUID(),
            role: message.role,
            text: message.text,
            answerFound: message.answerFound,
            confidence: message.confidence,
            sources: message.sources || [],
            timestamp: formatHistoryTime(message.createdAt)
          }))
        ]);
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    }

    loadConversationHistory();

    return () => {
      cancelled = true;
    };
  }, [authToken, onLogout]);

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

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

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

  function handleScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 400;
    setShowScrollButton(isScrolledUp);
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function fetchSecurityLogs() {
    setSecurityLoading(true);
    setSecurityError('');
    try {
      const response = await fetch(`${API_URL}/api/analytics/security-logs`);
      if (!response.ok) {
        throw new Error('Failed to load security logs');
      }
      const data = await response.json();
      setSecurityLogs(data);
    } catch (error) {
      console.error(error);
      setSecurityError('Could not load security logs right now.');
    } finally {
      setSecurityLoading(false);
    }
  }

  async function clearSecurityLogs() {
    if (!window.confirm('Are you sure you want to clear all security logs?')) return;
    setSecurityLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/analytics/security-logs`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('Failed to clear security logs');
      }
      setSecurityLogs([]);
    } catch (error) {
      console.error(error);
      alert('Failed to clear security logs.');
    } finally {
      setSecurityLoading(false);
    }
  }

  async function openAnalytics() {
    setShowAnalytics(true);
    setAnalyticsLoading(true);
    setAnalyticsError('');
    setActiveTab('analytics');

    try {
      const response = await fetch(`${API_URL}/api/analytics/daily-searches`);
      if (!response.ok) {
        throw new Error('Failed to load analytics');
      }
      const data = await response.json();
      setAnalyticsData(data);
    } catch (error) {
      console.error(error);
      setAnalyticsError('Could not load analytics right now.');
    } finally {
      setAnalyticsLoading(false);
    }

    fetchSecurityLogs();
  }

  async function handleRefresh() {
    try {
      const response = await fetch(`${API_URL}/api/chat/reset`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      if (response.status === 401) {
        onLogout();
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to reset chat memory');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to reset chat memory. Please check the server and try again.');
      return;
    }

    setMessages([makeGreetingMessage()]);
    setInput('');
    setIsLoading(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function exportChatTranscript() {
    const transcript = messages.map(m => {
      const sender = m.role === 'user' ? 'You' : 'OxEngine';
      return `[${m.timestamp}] ${sender}:\n${m.text}\n`;
    }).join('\n');

    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `OxEngine_Transcript_${new Date().toISOString().slice(0, 10)}.txt`;
    downloadLink.click();
    URL.revokeObjectURL(url);
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage(event);
    }
  }

  const getCounterColor = () => {
    if (input.length >= 500) return '#ef4444';
    if (input.length >= 400) return '#f59e0b';
    return '#94a3b8';
  };

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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ message: newText })
      });

      if (response.status === 401) {
        onLogout();
        throw new Error('Session expired');
      }
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ message: lastUserText })
      });

      if (response.status === 401) {
        onLogout();
        throw new Error('Session expired');
      }
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

  async function fetchSuggestions(query) {
  if (!query.trim()) {
    setSuggestions([]);
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/api/suggestions?q=${encodeURIComponent(query)}`
    );

    const data = await response.json();

    setSuggestions(data);
  } catch (error) {
    console.error('Failed to fetch suggestions:', error);
  }
}
  
  async function sendMessage(event) {
    if (event) event.preventDefault();
    const text = input.trim();
    if (!text || isLoading || input.length > 500) return;

    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text, timestamp: getTime() }]);
    setInput('');
    setSuggestions([]);
    setIsLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ message: text })
      });

      if (response.status === 401) {
        onLogout();
        throw new Error('Session expired');
      }
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
    setSuggestions([]);
    textareaRef.current?.focus();
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
          
          <div className="topActions">
            <div className="utilityStack">
              <select 
                className="utilityAction themeSelect"
                value={theme} 
                onChange={(e) => setTheme(e.target.value)}
                title="Change color theme"
              >
                <option value="auto">💻 Auto</option>
                <option value="light">☀️ Light</option>
                <option value="dark">🌙 Dark</option>
              </select>

              <button 
                className="utilityAction"
                onClick={exportChatTranscript}
                title="Export chat transcript"
              >
                <Download size={12} /> Export Chat
              </button>

              <button 
                className="utilityAction"
                onClick={handleRefresh}
                title="Clear conversation"
              >
                <RefreshCw size={12} /> Refresh Chat
              </button>
            </div>

            <div className="statusPill">
              <Circle size={10} fill="currentColor" />
              Escalation off
            </div>
            <button className="analyticsToggleBtn" type="button" onClick={openAnalytics}>
              <ShieldAlert size={16} />
              Admin Panel
            </button>
            <button className="orgCreateBtn" onClick={onCreateOrg}>✨ Create FAQ Bot</button>
            <div className="userMenu">
              <span>{authUser?.name || 'User'}</span>
              <button type="button" onClick={onLogout} title="Log out">
                <LogOut size={15} />
              </button>
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
          <div className={`mostAskedSection ${showMostAsked ? 'isExpanded' : 'isCollapsed'}`} aria-label="Most Asked Questions">
            <div className="mostAskedHeader">
              <h3>Most Asked Questions</h3>
              <span>{mostAskedQuestions.length} tracked</span>
              <button
                className="mostAskedToggle"
                type="button"
                onClick={() => setShowMostAsked((current) => !current)}
                aria-expanded={showMostAsked}
              >
                {showMostAsked ? 'Hide' : 'Show'}
                <ChevronDown size={16} />
              </button>
            </div>

            {showMostAsked && (
              <div className="mostAskedList">
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
          </div>
        )}

        <form className="composer" onSubmit={sendMessage}>
         <div
            className="inputShell"
            style={{
              alignItems: 'center',
              position: 'relative'
            }}
          >
            <MessageSquare size={21} color="#64748b" />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => {
                const value = event.target.value;
              
                setInput(value);
              
                if (value.length >= 2) {
                  fetchSuggestions(value);
                } else {
                  setSuggestions([]);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              aria-label="Question"
              rows={1}
              style={{
                flex: 1,
                maxHeight: '140px',
                resize: 'none',
                border: 'none',
                outline: 'none',
                padding: '12px 0',
                margin: '0 8px',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                background: 'transparent',
                color: 'inherit',
                lineHeight: '1.5',
                display: 'block'
              }}
            />
                        {suggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  top: '55px',
                  left: 0,
                  zIndex: 1000,
                  background: '#111827',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: '12px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.35)'
                }}
              >
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setInput(suggestion);
                      setSuggestions([]);
                    }}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      color: '#e5e7eb',
                      borderBottom: '1px solid rgba(255,255,255,0.05)'
                    }}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
            <button type="submit" disabled={isLoading || !input.trim() || input.length > 500} aria-label="Send message">
              <Send size={18} />
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '4px', padding: '0 4px' }}>
            <p>Press Enter to send · Shift+Enter for new line</p>
            <span style={{ color: getCounterColor(), fontWeight: input.length >= 400 ? '600' : 'normal', transition: 'color 0.2s ease' }}>
              {input.length} / 500
            </span>
          </div>
        </form>

        {showAnalytics && (
          <div className="analyticsOverlay" role="dialog" aria-modal="true" aria-label="Admin and Analytics Panel">
            <section className="analyticsPanel adminPanelModal">
              <div className="analyticsHeader">
                <div>
                  <h2>Admin Dashboard</h2>
                  <p>Manage system security logs and view usage analytics</p>
                </div>
                <button type="button" className="analyticsCloseBtn" onClick={() => setShowAnalytics(false)} aria-label="Close admin dashboard">
                  <X size={20} />
                </button>
              </div>

              <div className="adminTabs">
                <button
                  type="button"
                  className={`adminTabBtn ${activeTab === 'analytics' ? 'active' : ''}`}
                  onClick={() => setActiveTab('analytics')}
                >
                  <Database size={14} />
                  Search Analytics
                </button>
                <button
                  type="button"
                  className={`adminTabBtn ${activeTab === 'security' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('security');
                    fetchSecurityLogs();
                  }}
                >
                  <ShieldAlert size={14} />
                  Security Logs
                </button>
              </div>

              <div className="adminTabContent" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {activeTab === 'analytics' ? (
                  analyticsLoading ? (
                    <div className="analyticsState">
                      <Loader2 size={20} className="spin" />
                      Loading analytics
                    </div>
                  ) : analyticsError ? (
                    <div className="analyticsState analyticsError">{analyticsError}</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                      <div className="analyticsChart" style={{ flex: 1, minHeight: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analyticsData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="_id.date" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Line type="monotone" dataKey="count" stroke="#345df7" strokeWidth={3} dot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="analyticsSummary" style={{ marginTop: '12px' }}>
                        <span>Total Searches</span>
                        <strong>{analyticsData.reduce((sum, item) => sum + item.count, 0)}</strong>
                      </div>
                    </div>
                  )
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>
                        Showing latest prompt injection attempts detected by safetyScanner
                      </span>
                      {securityLogs.length > 0 && (
                        <button
                          type="button"
                          className="clearLogsBtn"
                          onClick={clearSecurityLogs}
                          disabled={securityLoading}
                        >
                          <Trash2 size={13} />
                          Clear Security Logs
                        </button>
                      )}
                    </div>

                    {securityLoading && securityLogs.length === 0 ? (
                      <div className="analyticsState">
                        <Loader2 size={20} className="spin" />
                        Loading security logs
                      </div>
                    ) : securityError ? (
                      <div className="analyticsState analyticsError">{securityError}</div>
                    ) : securityLogs.length === 0 ? (
                      <div className="analyticsState" style={{ minHeight: '240px' }}>
                        🛡️ No security incidents logged. The system is secure!
                      </div>
                    ) : (
                      <div className="securityLogsContainer" style={{ overflowY: 'auto', flex: 1, minHeight: 0, border: '1px solid var(--border-color, #e5ebf4)', borderRadius: '12px' }}>
                        <table className="securityLogsTable" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: 'var(--header-bg, #f8fafc)', borderBottom: '1px solid var(--border-color, #e5ebf4)', position: 'sticky', top: 0 }}>
                              <th style={{ padding: '12px 16px', color: 'var(--text-muted, #475569)', fontWeight: '700' }}>Time</th>
                              <th style={{ padding: '12px 16px', color: 'var(--text-muted, #475569)', fontWeight: '700' }}>Blocked Query (Payload)</th>
                              <th style={{ padding: '12px 16px', color: 'var(--text-muted, #475569)', fontWeight: '700' }}>Detected Pattern</th>
                              <th style={{ padding: '12px 16px', color: 'var(--text-muted, #475569)', fontWeight: '700' }}>Level</th>
                            </tr>
                          </thead>
                          <tbody>
                            {securityLogs.map((log) => (
                              <tr key={log._id} className="securityLogRow" style={{ borderBottom: '1px solid var(--row-border, #f1f5f9)' }}>
                                <td style={{ padding: '12px 16px', color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap' }}>
                                  {new Date(log.createdAt).toLocaleString()}
                                </td>
                                <td style={{ padding: '12px 16px', fontWeight: '500', color: 'var(--text-main, #0f172a)', wordBreak: 'break-all' }}>
                                  <code style={{ fontSize: '12px', background: 'rgba(0,0,0,0.03)', padding: '2px 4px', borderRadius: '4px' }}>{log.payload}</code>
                                </td>
                                <td style={{ padding: '12px 16px', color: 'var(--text-muted, #475569)' }}>
                                  <code style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', wordBreak: 'break-all' }}>
                                    {log.detectedPattern}
                                  </code>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span className="badge badgeLow" style={{ padding: '2px 8px', fontSize: '11px', minHeight: 'auto', background: '#ffe0d8', color: '#e35b45', border: '1px solid #ffe0d8' }}>
                                    {log.threatLevel}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

      </section>
    </main>
  );
}

function CreateOrgView({ onBack, onPublished }) {
  const [step, setStep]             = useState('form');
  const [form, setForm]             = useState({ name: '', description: '', domain: '', tone: 'friendly' });
  const [faqs, setFaqs]             = useState([]);
  const [generating, setGenerating]   = useState(false);
  const [publishing, setPublishing]   = useState(false);
  const [error, setError]             = useState('');

  function handleFormChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleGenerate(e) {
    e.preventDefault();
    setError('');
    setGenerating(true);
    try {
      const res  = await fetch(`${API_URL}/api/orgs/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Generation failed');
      setFaqs(data.faqs.map((f, i) => ({ ...f, _key: i })));
      setStep('review');
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  function updateFaq(key, field, value) {
    setFaqs((prev) => prev.map((f) => f._key === key ? { ...f, [field]: value } : f));
  }
  function removeFaq(key) {
    setFaqs((prev) => prev.filter((f) => f._key !== key));
  }
  function addFaq() {
    setFaqs((prev) => [...prev, { _key: Date.now(), question: '', answer: '', category: 'General' }]);
  }

  async function handlePublish() {
    if (faqs.some((f) => !f.question.trim() || !f.answer.trim())) {
      setError('All FAQs must have a question and an answer.');
      return;
    }
    setError('');
    setPublishing(true);
    try {
      const res  = await fetch(`${API_URL}/api/orgs`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, faqs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Publish failed');
      onPublished(data.orgId, data.name);
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  }

  if (step === 'review') {
    return (
      <main className="appShell">
        <section className="chatPanel orgBuilderPanel">
          <header className="topBar orgBuilderTopBar">
            <button className="backBtn" onClick={() => setStep('form')}><ArrowLeft size={16} /> Back</button>
            <h2 className="orgBuilderTitle">Review & edit FAQs</h2>
            <button className="orgCreateBtn" onClick={handlePublish} disabled={publishing || faqs.length === 0}>
              {publishing ? 'Publishing…' : `Publish ${faqs.length} FAQs`}
            </button>
          </header>

          {error && <p className="formError">{error}</p>}

          <div className="faqReviewList">
            {faqs.map((faq) => (
              <div key={faq._key} className="faqReviewCard">
                <div className="faqReviewCardHeader">
                  <select value={faq.category} onChange={(e) => updateFaq(faq._key, 'category', e.target.value)} className="categorySelect">
                    {['General', 'Services', 'Policies', 'Support', 'Contact'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button className="removeFaqBtn" onClick={() => removeFaq(faq._key)} aria-label="Remove FAQ"><Trash2 size={14} /></button>
                </div>
                <input className="faqQInput" placeholder="Question" value={faq.question} onChange={(e) => updateFaq(faq._key, 'question', e.target.value)} />
                <textarea className="faqAInput" rows={3} placeholder="Answer" value={faq.answer} onChange={(e) => updateFaq(faq._key, 'answer', e.target.value)} />
              </div>
            ))}
            <button className="addFaqBtn" onClick={addFaq}><Plus size={14} /> Add FAQ</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="appShell">
      <section className="chatPanel orgBuilderPanel">
        <header className="topBar orgBuilderTopBar">
          <button className="backBtn" onClick={onBack}><ArrowLeft size={16} /> Back</button>
          <h2 className="orgBuilderTitle">Create your FAQ bot</h2>
          <div />
        </header>

        {error && <p className="formError">{error}</p>}

        <form className="orgForm" onSubmit={handleGenerate}>
          <div className="formGroup">
            <label>Organisation name *</label>
            <input name="name" required placeholder="e.g. Acme Corp" value={form.name} onChange={handleFormChange} className="formInput" />
          </div>
          <div className="formGroup">
            <label>Domain / industry *</label>
            <input name="domain" required placeholder="e.g. Healthcare, SaaS, E-commerce" value={form.domain} onChange={handleFormChange} className="formInput" />
          </div>
          <div className="formGroup">
            <label>Description *</label>
            <textarea name="description" required rows={4} placeholder="Describe what your organisation does, who it serves, and any key details..." value={form.description} onChange={handleFormChange} className="formInput" style={{ resize: 'vertical' }} />
          </div>
          <div className="formGroup">
            <label>Tone</label>
            <div className="toneGrid">
              {TONE_OPTIONS.map((t) => (
                <button key={t.value} type="button"
                  className={`toneBtn ${form.tone === t.value ? 'toneBtnActive' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, tone: t.value }))}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="orgCreateBtn orgCreateBtnLarge" disabled={generating}>
            {generating ? 'Generating FAQs…' : '✨ Generate FAQs'}
          </button>
        </form>
      </section>
    </main>
  );
}

function OrgChatView({ orgId, onBack }) {
  const [org, setOrg]       = useState(null);
  const [orgError, setOrgError] = useState('');
  const [input, setInput]   = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages]   = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetch(`${API_URL}/api/orgs/${orgId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.message) { setOrgError(data.message); return; }
        setOrg(data.org);
        setMessages([{
          id: crypto.randomUUID(),
          role: 'assistant',
          text: `Hi! I'm the FAQ assistant for ${data.org.name}. Ask me anything about us.`,
          answerFound: true, confidence: 1, sources: []
        }]);
      })
      .catch(() => setOrgError('Failed to load organisation.'));
  }, [orgId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    setMessages((c) => [...c, { id: crypto.randomUUID(), role: 'user', text }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/orgs/${orgId}/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text }),
      });
      if (!response.ok) throw new Error('Request failed');
      const data = await response.json();
      setMessages((c) => [
        ...c,
        { id: crypto.randomUUID(), role: 'assistant', text: data.answer, answerFound: data.answerFound, confidence: data.confidence, sources: data.sources }
      ]);
    } catch {
      setMessages((c) => [
        ...c,
        { id: crypto.randomUUID(), role: 'assistant', text: 'Something went wrong. Please try again.', answerFound: false, confidence: 0, sources: [] }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  if (orgError) {
    return (
      <main className="appShell">
        <section className="chatPanel">
          <header className="topBar">
            <button className="backBtn" onClick={onBack}><ArrowLeft size={16} /> Back</button>
          </header>
          <p style={{ padding: '24px', color: '#c0392b' }}>⚠️ {orgError}</p>
        </section>
      </main>
    );
  }

  if (!org) {
    return <main className="appShell"><section className="chatPanel" style={{ alignItems: 'center', justifyContent: 'center' }}><Loader2 className="spin" size={28} /></section></main>;
  }

  return (
    <main className="appShell">
      <section className="chatPanel" aria-label={`${org.name} FAQ chatbot`}>
        <header className="topBar">
          <div className="brandBlock" style={{ flex: 1 }}>
            <div className="brandIcon" style={{ background: '#4f46e5' }}>{org.name[0].toUpperCase()}</div>
            <div>
              <div className="titleRow"><h1>{org.name}</h1></div>
              <p>{org.domain}</p>
            </div>
          </div>
          <div className="statusPill" style={{ whiteSpace: 'nowrap' }}><Circle size={10} fill="currentColor" />FAQ bot</div>
        </header>

        <div className="messages">
          {messages.map((m) => <Message key={m.id} message={m} />)}
          {isLoading && (
            <article className="message botMessage">
              <div className="messageAvatar"><UserRound size={18} /></div>
              <div className="bubble loadingBubble"><Loader2 size={18} className="spin" />Retrieving context</div>
            </article>
          )}
          <div ref={bottomRef} />
        </div>

        <form className="composer" onSubmit={sendMessage}>
          <div className="inputShell">
            <MessageSquare size={21} />
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask ${org.name} anything…`} aria-label="Question" />
            <button type="submit" disabled={isLoading || !input.trim()} aria-label="Send"><Send size={18} /></button>
          </div>
          <p>Press Enter to send</p>
        </form>
      </section>
    </main>
  );
}

function ShareView({ orgId, orgName, onBack, onViewBot }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/?org=${orgId}`;

  function copyLink() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="appShell">
      <section className="chatPanel">
        <header className="topBar">
          <button className="backBtn" onClick={onBack}><ArrowLeft size={16} /> Home</button>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>Your FAQ bot is live!</h2>
          <div />
        </header>
        <div className="shareView">
          <div className="shareSuccess">✅</div>
          <h2 className="shareTitle">{orgName} FAQ bot is ready</h2>
          <p className="shareSubtitle">Share this link with anyone to let them chat with your FAQ bot:</p>
          <div className="shareLinkBox">
            <span className="shareLinkText">{link}</span>
            <button className="shareCopyBtn" onClick={copyLink}>
              {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>
          <button className="orgCreateBtn orgCreateBtnLarge" onClick={onViewBot}>
            Preview bot →
          </button>
        </div>
      </section>
    </main>
  );
}

function App() {
  const params  = new URLSearchParams(window.location.search);
  const urlOrg  = params.get('org');

  const [view, setView]         = useState(urlOrg ? 'orgChat' : 'home');
  const [activeOrgId, setActiveOrgId] = useState(urlOrg || null);
  const [activeOrgName, setActiveOrgName] = useState('');
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('auth_token') || '');
  const [authUser, setAuthUser] = useState(() => {
    const savedUser = localStorage.getItem('auth_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  function handlePublished(orgId, orgName) {
    setActiveOrgId(orgId);
    setActiveOrgName(orgName);
    setView('share');
  }

  function handleAuthenticated({ token, user }) {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    setAuthToken(token);
    setAuthUser(user);
  }

  async function handleLogout() {
    if (authToken) {
      fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }).catch(() => {});
    }

    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setAuthToken('');
    setAuthUser(null);
    setView(urlOrg ? 'orgChat' : 'home');
  }

  if (!urlOrg && !authToken) return <AuthView onAuthenticated={handleAuthenticated} />;

  if (view === 'home')    return <DefaultChat onCreateOrg={() => setView('create')} authToken={authToken} authUser={authUser} onLogout={handleLogout} />;
  if (view === 'create')  return <CreateOrgView onBack={() => setView('home')} onPublished={handlePublished} />;
  if (view === 'share')   return <ShareView orgId={activeOrgId} orgName={activeOrgName} onBack={() => setView('home')} onViewBot={() => setView('orgChat')} />;
  if (view === 'orgChat') return <OrgChatView orgId={activeOrgId} onBack={() => setView('home')} />;
}

createRoot(document.getElementById('root')).render(<App />);
