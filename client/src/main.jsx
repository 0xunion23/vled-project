import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Bot, Circle, Database, Loader2, MessageSquare, Send, UserRound, ArrowLeft, Copy, Check, Trash2, Plus } from 'lucide-react';
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

// ── Shared components ─────────────────────────────────────────────────────────

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
      <div className="messageAvatar"><UserRound size={18} /></div>
      <div className="bubble">
        <div className="messageHeader">
          <strong>{isUser ? 'You' : 'Assistant'}</strong>
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

// ── View: default chat (existing behaviour, unchanged) ────────────────────────

function DefaultChat({ onCreateOrg }) {
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

    setMessages((c) => [...c, { id: crypto.randomUUID(), role: 'user', text }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
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
        { id: crypto.randomUUID(), role: 'assistant', text: 'The chatbot API is not reachable. Check that Express, MongoDB, and Ollama are running.', answerFound: false, confidence: 0, sources: [] }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="appShell">
      <section className="chatPanel" aria-label="RAG chatbot">
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="statusPill"><Circle size={10} fill="currentColor" />Escalation off</div>
            <button className="orgCreateBtn" onClick={onCreateOrg}>✨ Create FAQ Bot</button>
          </div>
        </header>

        <div className="messages">
          {messages.map((m) => <Message key={m.id} message={m} />)}
          {isLoading && (
            <article className="message botMessage">
              <div className="messageAvatar"><UserRound size={18} /></div>
              <div className="bubble loadingBubble"><Loader2 size={18} className="spin" />Retrieving context</div>
            </article>
          )}
        </div>

        <div className="quickPrompts" aria-label="Suggested questions">
          {QUICK_PROMPTS.map((p) => (
            <button key={p} type="button" onClick={() => setInput(p)}>{p}</button>
          ))}
        </div>

        <form className="composer" onSubmit={sendMessage}>
          <div className="inputShell">
            <MessageSquare size={21} />
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question..." aria-label="Question" />
            <button type="submit" disabled={isLoading || !input.trim()} aria-label="Send message"><Send size={18} /></button>
          </div>
          <p>Press Enter to send · Shift+Enter for new line</p>
        </form>
      </section>
    </main>
  );
}

// ── View: create org form ─────────────────────────────────────────────────────

function CreateOrgView({ onBack, onPublished }) {
  const [step, setStep]               = useState('form'); // 'form' | 'review'
  const [form, setForm]               = useState({ name: '', description: '', domain: '', tone: 'friendly' });
  const [faqs, setFaqs]               = useState([]);
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
        <section className="chatPanel">
          <header className="topBar">
            <button className="backBtn" onClick={() => setStep('form')}><ArrowLeft size={16} /> Back</button>
            <h2 style={{ margin: 0, fontSize: '1rem' }}>Review & edit FAQs</h2>
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
      <section className="chatPanel">
        <header className="topBar">
          <button className="backBtn" onClick={onBack}><ArrowLeft size={16} /> Back</button>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>Create your FAQ bot</h2>
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

// ── View: org chat (shareable link experience) ────────────────────────────────

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
          <div className="brandBlock">
            <div className="brandIcon" style={{ background: '#4f46e5' }}>{org.name[0].toUpperCase()}</div>
            <div>
              <div className="titleRow"><h1>{org.name}</h1></div>
              <p>{org.domain}</p>
            </div>
          </div>
          <div className="statusPill"><Circle size={10} fill="currentColor" />FAQ bot</div>
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

// ── View: success / share link ────────────────────────────────────────────────

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

// ── Root App — view router via state ──────────────────────────────────────────

function App() {
  // Check for ?org=<id> in URL to deep-link directly to an org chat
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
