import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, RefreshCw, CheckCircle, MessageSquare, TrendingUp, AlertTriangle, BarChart2, Inbox } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="statCard">
      <div className={`statIcon statIcon--${color}`}>{icon}</div>
      <div className="statBody">
        <div className="statValue">{value}</div>
        <div className="statLabel">{label}</div>
        {sub && <div className="statSub">{sub}</div>}
      </div>
    </div>
  );
}

function EscalationRow({ e, onAnswered }) {
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function submit() {
    if (!answer.trim()) return;
    setSubmitting(true);
    await fetch(`${API_URL}/api/admin/escalations/${e._id}/answer`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer })
    });
    setSubmitting(false);
    onAnswered(e._id);
  }

  return (
    <tr>
      <td className="questionCell">
        <button className="expandBtn" onClick={() => setExpanded(!expanded)}>
          {e.question}
        </button>
        {expanded && (
          <div className="answerBox">
            <textarea
              className="answerInput"
              placeholder="Type your answer here..."
              value={answer}
              onChange={(ev) => setAnswer(ev.target.value)}
              rows={3}
            />
            <button
              className="resolveBtn"
              onClick={submit}
              disabled={submitting || !answer.trim()}
            >
              <CheckCircle size={14} />
              {submitting ? 'Sending...' : 'Answer & Notify User'}
            </button>
          </div>
        )}
      </td>
      <td><span className="confBadge confLow">{Math.round(e.confidence * 100)}%</span></td>
      <td className="timeCell">{new Date(e.createdAt).toLocaleString()}</td>
    </tr>
  );
}

export default function AdminDashboard({ onBack }) {
  const [stats, setStats] = useState(null);
  const [escalations, setEscalations] = useState([]);
  const [topQuestions, setTopQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('escalations');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, escRes, topRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`),
        fetch(`${API_URL}/api/admin/escalations`),
        fetch(`${API_URL}/api/admin/top-questions`)
      ]);
      const [s, e, t] = await Promise.all([statsRes.json(), escRes.json(), topRes.json()]);
      setStats(s);
      setEscalations(e);
      setTopQuestions(t);
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function handleAnswered(id) {
    setEscalations((prev) => prev.filter((e) => e._id !== id));
    setStats((prev) => prev ? {
      ...prev,
      escalatedOpen: Math.max(0, prev.escalatedOpen - 1),
      escalatedResolved: prev.escalatedResolved + 1
    } : prev);
  }

  return (
    <section className="adminShell">
      <header className="adminHeader">
        <button className="backBtn" onClick={onBack}>
          <ArrowLeft size={18} /> Back to chat
        </button>
        <div className="adminTitle">
          <BarChart2 size={22} />
          <h1>Admin Dashboard</h1>
        </div>
        <button className="refreshBtn" onClick={fetchAll} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </header>

      {stats && (
        <div className="statsGrid">
          <StatCard icon={<MessageSquare size={20} />} label="Total queries" value={stats.totalQueries} color="blue" />
          <StatCard icon={<TrendingUp size={20} />} label="Answer rate" value={`${stats.answerRate}%`} sub={`${stats.answeredQueries} answered`} color="green" />
          <StatCard icon={<AlertTriangle size={20} />} label="Open escalations" value={stats.escalatedOpen} sub={`${stats.escalatedResolved} resolved`} color="orange" />
          <StatCard icon={<BarChart2 size={20} />} label="Avg confidence" value={`${Math.round(stats.avgConfidence * 100)}%`} sub={`${stats.fallbackQueries} fallbacks`} color="purple" />
        </div>
      )}

      <div className="adminTabs">
        <button className={`adminTab ${activeTab === 'escalations' ? 'adminTabActive' : ''}`} onClick={() => setActiveTab('escalations')}>
          <AlertTriangle size={15} />
          Escalations
          {stats?.escalatedOpen > 0 && <span className="tabBadge">{stats.escalatedOpen}</span>}
        </button>
        <button className={`adminTab ${activeTab === 'top' ? 'adminTabActive' : ''}`} onClick={() => setActiveTab('top')}>
          <TrendingUp size={15} />
          Most Asked
        </button>
      </div>

      <div className="adminContent">
        {activeTab === 'escalations' && (
          <div className="tableWrap">
            {escalations.length === 0 ? (
              <div className="emptyState">
                <Inbox size={40} />
                <p>No open escalations</p>
              </div>
            ) : (
              <table className="adminTable">
                <thead>
                  <tr>
                    <th>Question (click to expand &amp; answer)</th>
                    <th>Confidence</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {escalations.map((e) => (
                    <EscalationRow key={e._id} e={e} onAnswered={handleAnswered} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'top' && (
          <div className="tableWrap">
            {topQuestions.length === 0 ? (
              <div className="emptyState">
                <Inbox size={40} />
                <p>No queries logged yet</p>
              </div>
            ) : (
              <table className="adminTable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Question</th>
                    <th>Asked</th>
                    <th>Avg confidence</th>
                    <th>Answered</th>
                  </tr>
                </thead>
                <tbody>
                  {topQuestions.map((q, i) => (
                    <tr key={q._id}>
                      <td className="rankCell">{i + 1}</td>
                      <td className="questionCell">{q.question}</td>
                      <td><span className="countBadge">{q.count}×</span></td>
                      <td>
                        <span className={`confBadge ${q.avgConfidence >= 0.65 ? 'confHigh' : 'confLow'}`}>
                          {Math.round(q.avgConfidence * 100)}%
                        </span>
                      </td>
                      <td className="answeredCell">{q.answerFoundCount}/{q.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
