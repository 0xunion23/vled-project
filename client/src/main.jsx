import { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bot, Bell, Circle, Database, Loader2, MessageSquare, Send, UserRound,
  ThumbsUp, ThumbsDown, RefreshCw, RotateCcw, Copy, Check, Pencil,
  ArrowDown, AlertTriangle, LayoutDashboard, CheckCircle
} from 'lucide-react';
import './styles.css';
import AdminDashboard from './AdminDashboard.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const QUICK_PROMPTS = [
  'Who can sign the NOC?',
  'Is there a stipend?',
  'How long is the internship?',
  'How do I log in to ViBe?'
];

const getTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ── Confidence badge ──────────────────────────────────────────
function ConfidenceBadge({ found, confidence, escalated }) {
  if (escalated) {
    return (
      <span className="badge badgeEscalated">
        <AlertTriangle size={8} />
        Escalated
      </span>
    );
  }
  if (!found) {
    return (
      <span className="badge badgeLow">
        <Circle size={8} fill="currentColor" />
        Off-topic
      </span>
    );
  }
  return (
    <span className="badge badgeFound">
      <Circle size={8} fill="currentColor" />
      {Math.round(confidence * 100)}% match
    </span>
  );
}

// ── Message component ─────────────────────────────────────────
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
    <article className={`message ${isUser ? 'userMessage' : 'botMessage'} ${message.isNotification ? 'notificationMessage' : ''}`}>
      <div className="messageAvatar">{isUser ? <UserRound size={18} /> : <Bot size={18} />}</div>
      <div className="bubble">
        <div className="messageHeader" style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <strong>{isUser ? 'You' : 'OxEngine'}</strong>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{message.timestamp}</span>
          {!isUser && message.confidence !== undefined && (
            <ConfidenceBadge found={message.answerFound} confidence={message.confidence} escalated={message.escalated} />
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
              <button type="button" onClick={() => { setIsEditing(false); setEditText(message.text); }}
                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontSize: '12px', color: '#334155' }}>
                Cancel
              </button>
              <button type="button"
                onClick={() => { if (editText.trim() && editText.trim() !== message.text) onEditPrompt(message.id, editText.trim()); setIsEditing(false); }}
                style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontSize: '12px' }}>
                Save & Submit
              </button>
            </div>
          </div>
        ) : (
          <p>{message.text}</p>
        )}

        {isUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
            <button onClick={handleCopy} title="Copy prompt"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#22c55e' : '#6b7280' }}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
            {!isEditing && (
              <button onClick={() => { setIsEditing(true); setEditText(message.text); }} title="Edit prompt"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                <Pencil size={15} />
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
            <button onClick={() => setVote('up')} title="Helpful"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: vote === 'up' ? '#22c55e' : '#6b7280' }}>
              <ThumbsUp size={16} />
            </button>
            <button onClick={() => setVote('down')} title="Not helpful"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: vote === 'down' ? '#ef4444' : '#6b7280' }}>
              <ThumbsDown size={16} />
            </button>
            <button onClick={handleCopy} title="Copy answer"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#22c55e' : '#6b7280' }}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
            {isLatestBotMessage && (
              <button onClick={onRegenerate} title="Regenerate response"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', marginLeft: 'auto' }}>
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

// ── App ───────────────────────────────────────────────────────
function App() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState('chat');
  const messagesEndRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [mostAskedQuestions, setMostAskedQuestions] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'auto');

  // Session ID for escalation notifications
  const [sessionId] = useState(() => {
    const stored = sessionStorage.getItem('oxengine_session');
    if (stored) return stored;
    const id = crypto.randomUUID();
    sessionStorage.setItem('oxengine_session', id);
    return id;
  });
  const [notifiedIds, setNotifiedIds] = useState(new Set());
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

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

  // Theme
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

  // Most asked questions
  useEffect(() => {
    async function fetchMostAsked() {
      try {
        const res = await fetch(`${API_URL}/api/most-asked`);
        if (!res.ok) return;
        setMostAskedQuestions(await res.json());
      } catch (_) {}
    }
    fetchMostAsked();
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Poll for admin notifications every 8s
  useEffect(() => {
    if (page !== 'chat') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/chat/notifications/${sessionId}`);
        if (!res.ok) return;
        const answered = await res.json();
        const newOnes = answered.filter((e) => !notifiedIds.has(e._id));
        if (newOnes.length === 0) return;
        setNotifiedIds((prev) => {
          const next = new Set(prev);
          newOnes.forEach((e) => next.add(e._id));
          return next;
        });
        newOnes.forEach((e) => {
          setNotifications((prev) => [{
            id: e._id, question: e.question, answer: e.adminAnswer, time: e.resolvedAt, read: false
          }, ...prev]);
          setMessages((current) => [...current, {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: `Your escalated question has been answered by the team:\n\n"${e.adminAnswer}"`,
            answerFound: true,
            escalated: false,
            confidence: 1,
            sources: [],
            isNotification: true,
            timestamp: getTime()
          }]);
        });
      } catch (_) {}
    }, 8000);
    return () => clearInterval(interval);
  }, [page, sessionId, notifiedIds]);

  function handleScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 400);
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleRefresh() {
    setMessages([{
      id: crypto.randomUUID(), role: 'assistant',
      text: "Hi there! I'm OxEngine, your FAQ assistant. Ask me anything and I'll find the best answer for you.",
      answerFound: true, confidence: 1, sources: [], timestamp: getTime()
    }]);
    setInput('');
    setIsLoading(false);
  }

  async function callChat(text) {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, sessionId })
    });
    if (!response.ok) throw new Error('Request failed');
    return response.json();
  }

  async function handleEditPrompt(id, newText) {
    if (isLoading) return;
    const targetIndex = messages.findIndex(m => m.id === id);
    if (targetIndex === -1) return;
    const truncated = messages.slice(0, targetIndex + 1);
    truncated[targetIndex] = { ...truncated[targetIndex], text: newText, timestamp: getTime() };
    setMessages(truncated);
    setIsLoading(true);
    try {
      const data = await callChat(newText);
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: 'assistant', text: data.answer,
        answerFound: data.answerFound, escalated: data.escalated || false,
        confidence: data.confidence, sources: data.sources, timestamp: getTime()
      }]);
    } catch (_) {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: 'assistant',
        text: 'The chatbot API is not reachable.',
        answerFound: false, confidence: 0, sources: [], timestamp: getTime()
      }]);
    } finally { setIsLoading(false); }
  }

  async function handleRegenerate() {
    if (isLoading) return;
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return;
    const lastUserText = userMessages[userMessages.length - 1].text;
    const newMessages = [...messages];
    if (newMessages[newMessages.length - 1].role === 'assistant') newMessages.pop();
    setMessages(newMessages);
    setIsLoading(true);
    try {
      const data = await callChat(lastUserText);
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: 'assistant', text: data.answer,
        answerFound: data.answerFound, escalated: data.escalated || false,
        confidence: data.confidence, sources: data.sources, timestamp: getTime()
      }]);
    } catch (_) {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: 'assistant',
        text: 'The chatbot API is not reachable.',
        answerFound: false, confidence: 0, sources: [], timestamp: getTime()
      }]);
    } finally { setIsLoading(false); }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text, timestamp: getTime() }]);
    setInput('');
    setIsLoading(true);
    try {
      const data = await callChat(text);
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: 'assistant', text: data.answer,
        answerFound: data.answerFound, escalated: data.escalated || false,
        confidence: data.confidence, sources: data.sources, timestamp: getTime()
      }]);
    } catch (_) {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: 'assistant',
        text: 'The chatbot API is not reachable. Check that Express, MongoDB, and Ollama are running.',
        answerFound: false, confidence: 0, sources: [], timestamp: getTime()
      }]);
    } finally { setIsLoading(false); }
  }

  function useQuickPrompt(prompt) { setInput(prompt); }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <main className="appShell">
      {page === 'admin' ? (
        <AdminDashboard onBack={() => setPage('chat')} />
      ) : (
        <section className="chatPanel" aria-label="RAG chatbot" style={{ position: 'relative' }}>
          <header className="topBar">
            <div className="brandBlock">
              <div className="brandIcon"><Bot size={22} /></div>
              <div>
                <div className="titleRow">
                  <h1>FAQ OxEngine</h1>
                  <span className="versionTag">v2.1</span>
                </div>
                <p>Answers from the FAQ knowledge base</p>
              </div>
            </div>

            <div className="topBarActions">
              {/* Theme selector */}
              <select value={theme} onChange={(e) => setTheme(e.target.value)} title="Change color theme"
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#64748b', fontSize: '13px', fontWeight: '500', outline: 'none' }}>
                <option value="auto">💻 Auto</option>
                <option value="light">☀️ Light</option>
                <option value="dark">🌙 Dark</option>
              </select>

              {/* Refresh */}
              <button onClick={handleRefresh} title="Clear conversation"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#64748b', fontSize: '13px', fontWeight: '500' }}>
                <RefreshCw size={14} /> Refresh
              </button>

              {/* Escalation status */}
              <div className="statusPill">
                <Circle size={10} fill="currentColor" className="statusGreen" />
                Escalation on
              </div>

              {/* Notification bell */}
              <div className="notifWrap">
                <button className="notifBtn" aria-label="Notifications"
                  onClick={() => {
                    setShowNotifications((v) => !v);
                    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                  }}>
                  <Bell size={18} />
                  {unreadCount > 0 && <span className="notifDot">{unreadCount}</span>}
                </button>
                {showNotifications && (
                  <div className="notifDropdown">
                    <div className="notifHeader">
                      <strong>Notifications</strong>
                      {notifications.length > 0 && (
                        <button className="clearNotif" onClick={() => setNotifications([])}>Clear all</button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="notifEmpty">No notifications yet</div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className={`notifItem ${n.read ? '' : 'notifUnread'}`}>
                          <div className="notifIcon"><CheckCircle size={16} /></div>
                          <div className="notifBody">
                            <p className="notifQuestion">"{n.question}"</p>
                            <p className="notifAnswer">{n.answer}</p>
                            <span className="notifTime">{new Date(n.time).toLocaleString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Admin button */}
              <button className="adminBtn" onClick={() => setPage('admin')} aria-label="Admin dashboard">
                <LayoutDashboard size={16} /> Admin
              </button>
            </div>
          </header>

          <div className="messages" onScroll={handleScroll}>
            {messages.map((message, index) => {
              const isLatestBotMessage = message.role === 'assistant' && index === messages.length - 1;
              return (
                <Message key={message.id} message={message}
                  isLatestBotMessage={isLatestBotMessage}
                  onRegenerate={handleRegenerate}
                  onEditPrompt={handleEditPrompt} />
              );
            })}
            {isLoading && (
              <article className="message botMessage">
                <div className="messageAvatar"><Bot size={18} /></div>
                <div className="bubble loadingBubble">
                  <Loader2 size={18} className="spin" />
                  Retrieving context
                </div>
              </article>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Scroll to bottom button */}
          <button onClick={scrollToBottom} title="Scroll to latest"
            style={{
              position: 'absolute', bottom: '230px', left: '50%',
              opacity: showScrollButton ? 1 : 0,
              transform: showScrollButton ? 'translate(-50%, 0)' : 'translate(-50%, 20px)',
              pointerEvents: showScrollButton ? 'auto' : 'none',
              transition: 'opacity 0.3s ease, transform 0.3s ease',
              width: '42px', height: '42px', borderRadius: '50%',
              backgroundColor: '#345df7', color: 'white', border: 'none',
              boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 10
            }}>
            <ArrowDown size={22} />
          </button>

          {/* Most asked questions */}
          {mostAskedQuestions.length > 0 && (
            <div className="mostAskedSection" aria-label="Most Asked Questions">
              <h3 style={{ width: '100%', margin: '0 0 10px 0', color: '#64748b', fontSize: '14px', fontWeight: '700' }}>
                Most Asked (Top 20)
              </h3>
              {mostAskedQuestions.map((q) => (
                <button key={q._id || q.normalizedQuestion} type="button" onClick={() => useQuickPrompt(q.displayQuestion)}>
                  {q.displayQuestion} ({q.count})
                </button>
              ))}
            </div>
          )}

          {/* Quick prompts */}
          <div className="quickPrompts" aria-label="Suggested questions">
            {QUICK_PROMPTS.map((prompt) => (
              <button key={prompt} type="button" onClick={() => useQuickPrompt(prompt)}>{prompt}</button>
            ))}
          </div>

          <form className="composer" onSubmit={sendMessage}>
            <div className="inputShell">
              <MessageSquare size={21} />
              <input value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..." aria-label="Question" />
              <button type="submit" disabled={isLoading || !input.trim()} aria-label="Send message">
                <Send size={18} />
              </button>
            </div>
            <p>Press Enter to send · Shift+Enter for new line</p>
          </form>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
