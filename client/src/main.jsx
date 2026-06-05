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
  ThumbsUp, ThumbsDown, RefreshCw, RotateCcw, Copy, Check, Pencil, ArrowDown,
  ArrowLeft, Trash2, Plus, Volume2, Download
} from 'lucide-react';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const QUICK_PROMPTS = [
  'Who can sign the NOC?',
  'Is there a stipend?',
  'How long is the internship?',
  'How do I log in to ViBe?'
];

const TONE_OPTIONS = [
  { value: 'friendly',  label: 'Friendly' },
  { value: 'formal',    label: 'Formal' },
  { value: 'technical', label: 'Technical' },
  { value: 'casual',    label: 'Casual' },
];
const getTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const getDynamicGreeting = () => {
  const hour = new Date().getHours();
  let greeting = "Hi there";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 18) greeting = "Good afternoon";
  else greeting = "Good evening";
  return `${greeting}! I'm OxEngine, your FAQ assistant. Ask me anything and I'll find the best answer for you.`;
};

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

function DefaultChat({ onCreateOrg }) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const [mostAskedQuestions, setMostAskedQuestions] = useState([]);
  
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'auto');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [analyticsData, setAnalyticsData] = useState([]);

  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chat_memory');
    return saved ? JSON.parse(saved) : [{
      id: crypto.randomUUID(),
      role: 'assistant',
      text: getDynamicGreeting(),
      answerFound: true,
      confidence: 1,
      sources: [],
      timestamp: getTime()
    }];
  });

  useEffect(() => {
    localStorage.setItem('chat_memory', JSON.stringify(messages));
  }, [messages]);

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

  useEffect(() => {
    fetch(`${API_URL}/api/analytics/daily-searches`)
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
    setMessages([{
        id: crypto.randomUUID(),
        role: 'assistant',
        text: getDynamicGreeting(),
        answerFound: true,
        confidence: 1,
        sources: [],
        timestamp: getTime()
      }]);
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
    if (event) event.preventDefault();
    const text = input.trim();
    if (!text || isLoading || input.length > 500) return;

    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text, timestamp: getTime() }]);
    setInput('');
    setIsLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

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
    textareaRef.current?.focus();
  }

  return (
    <main className="appShell">
      <section className="chatPanel" aria-label="RAG chatbot" style={{ position: 'relative' }}>
        <header className="topBar">
          <div className="brandBlock" style={{ flex: 1 }}>
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
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'nowrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <select 
                value={theme} 
                onChange={(e) => setTheme(e.target.value)}
                title="Change color theme"
                style={{
                  padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0',
                  background: 'white', cursor: 'pointer', color: '#64748b', fontSize: '12px',
                  fontWeight: '500', outline: 'none', whiteSpace: 'nowrap', width: '100%'
                }}
              >
                <option value="auto">💻 Auto</option>
                <option value="light">☀️ Light</option>
                <option value="dark">🌙 Dark</option>
              </select>

              <button 
                onClick={exportChatTranscript}
                title="Export chat transcript"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-start',
                  padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0',
                  background: 'white', cursor: 'pointer', color: '#64748b', fontSize: '12px',
                  fontWeight: '500', whiteSpace: 'nowrap', width: '100%'
                }}
              >
                <Download size={12} /> Export Chat
              </button>

              <button 
                onClick={handleRefresh}
                title="Clear conversation"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-start',
                  padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0',
                  background: 'white', cursor: 'pointer', color: '#64748b', fontSize: '12px',
                  fontWeight: '500', whiteSpace: 'nowrap', width: '100%'
                }}
              >
                <RefreshCw size={12} /> Refresh Chat
              </button>
            </div>

            <div className="statusPill" style={{ whiteSpace: 'nowrap' }}>
              <Circle size={10} fill="currentColor" />
              Escalation off
            </div>
            <button className="orgCreateBtn" onClick={onCreateOrg} style={{ whiteSpace: 'nowrap' }}>✨ Create FAQ Bot</button>
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
          <div className="inputShell" style={{ alignItems: 'center' }}>
            <MessageSquare size={21} color="#64748b" />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
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

  function handlePublished(orgId, orgName) {
    setActiveOrgId(orgId);
    setActiveOrgName(orgName);
    setView('share');
  }

  if (view === 'home')    return <DefaultChat onCreateOrg={() => setView('create')} />;
  if (view === 'create')  return <CreateOrgView onBack={() => setView('home')} onPublished={handlePublished} />;
  if (view === 'share')   return <ShareView orgId={activeOrgId} orgName={activeOrgName} onBack={() => setView('home')} onViewBot={() => setView('orgChat')} />;
  if (view === 'orgChat') return <OrgChatView orgId={activeOrgId} onBack={() => setView('home')} />;
}

createRoot(document.getElementById('root')).render(<App />);