import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, BookOpen, Activity, RefreshCw, Shield,
  UserCheck, UserX, Brain, LogOut, BarChart3,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://kenapse-production.up.railway.app';

// ── Data fetch ────────────────────────────────────────────────────────────────
async function fetchAllData() {
  const [profilesRes, matsRes, chapsRes, quizzesRes] = await Promise.all([
    supabase.from('profiles').select('*').order('updated_at', { ascending: false }),
    supabase.from('study_materials').select('id, file_name, user_id, created_at').order('created_at', { ascending: false }),
    supabase.from('chapters').select('id, material_id, status'),
    supabase.from('quizzes').select('id'),
  ]);

  const queryErrors = [profilesRes, matsRes, chapsRes, quizzesRes].filter(r => r.error).map(r => r.error.message);
  if (queryErrors.length) throw new Error(queryErrors.join(' | '));

  const profiles  = profilesRes.data  || [];
  const materials = matsRes.data      || [];
  const chapters  = chapsRes.data     || [];

  const matCountByUser = {};
  const matToUser      = {};
  for (const m of materials) {
    matCountByUser[m.user_id] = (matCountByUser[m.user_id] || 0) + 1;
    matToUser[m.id] = m.user_id;
  }
  const completedByUser = {};
  for (const c of chapters) {
    if (c.status === 'completed') {
      const uid = matToUser[c.material_id];
      if (uid) completedByUser[uid] = (completedByUser[uid] || 0) + 1;
    }
  }
  const statsByMat = {};
  for (const c of chapters) {
    if (!statsByMat[c.material_id]) statsByMat[c.material_id] = { total: 0, completed: 0 };
    statsByMat[c.material_id].total += 1;
    if (c.status === 'completed') statsByMat[c.material_id].completed += 1;
  }

  const users = profiles.map(p => ({
    id: p.id, email: p.email || '—', name: p.name || '—', role: p.role || 'user',
    course_count: matCountByUser[p.id] || 0,
    completed_chapters: completedByUser[p.id] || 0,
    created_at: p.created_at,
  }));

  const content = materials.map(m => {
    const s = statsByMat[m.id] || { total: 0, completed: 0 };
    return {
      id: m.id, file_name: m.file_name, user_id: m.user_id, created_at: m.created_at,
      total_chapters: s.total, completed_chapters: s.completed,
      progress: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
    };
  });

  return {
    metrics: {
      total_users: profiles.length, total_materials: materials.length,
      total_chapters: chapters.length, total_quizzes: (quizzesRes.data || []).length,
    },
    users, content,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name) {
  return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function RoleBadge({ role }) {
  const isAdmin = role === 'admin';
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
      fontFamily: 'var(--font-body)',
      background: isAdmin ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)',
      color: isAdmin ? '#a5b4fc' : '#64748b',
      border: `1px solid ${isAdmin ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
    }}>
      {isAdmin ? '⬡ Admin' : 'User'}
    </span>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function MetricCards({ metrics, loading }) {
  const cards = [
    { label: 'Total Users',    value: metrics?.total_users,     color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.25)', icon: Users     },
    { label: 'Total Courses',  value: metrics?.total_materials,  color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', icon: BookOpen  },
    { label: 'Total Chapters', value: metrics?.total_chapters,   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', icon: Activity  },
    { label: 'Total Quizzes',  value: metrics?.total_quizzes,    color: '#e879f9', bg: 'rgba(232,121,249,0.1)', border: 'rgba(232,121,249,0.25)', icon: Shield  },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
      {cards.map(c => {
        const Icon = c.icon;
        return (
          <div key={c.label} style={{
            background: 'rgba(10,10,16,0.85)', border: `1px solid ${c.border}`,
            borderRadius: '16px', padding: '1.5rem',
            boxShadow: `0 0 24px ${c.bg}`,
            transition: 'transform 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
          >
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Icon size={18} color={c.color} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f8fafc', lineHeight: 1, marginBottom: '5px', fontFamily: 'var(--font-main)', letterSpacing: '1px' }}>
              {loading ? '—' : (c.value ?? '—')}
            </div>
            <div style={{ fontSize: '0.79rem', color: '#64748b', fontFamily: 'var(--font-body)' }}>{c.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function UsersTable({ users, loading, onRoleChange }) {
  const { user: currentUser } = useAuth();
  const [updating, setUpdating] = useState(null);

  if (loading) return <LoadingRow />;
  if (!users?.length) return <EmptyRow msg="No users found." />;

  const handleRoleToggle = async (u) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    setUpdating(u.id);
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', u.id);
      if (error) throw error;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch(`${API_BASE_URL}/admin/users/${u.id}/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ role: newRole }),
          });
        }
      } catch { /* best-effort */ }
      onRoleChange();
      alert(`Done! ${u.name || u.email} is now "${newRole}". They need to sign out and back in for the change to take effect.`);
    } catch (err) {
      alert('Failed to update role: ' + err.message);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {['User', 'Email', 'Role', 'Courses', 'Chapters', 'Joined', ''].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '0.74rem', color: '#475569', fontFamily: 'var(--font-body)', letterSpacing: '1.5px', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => {
            const isSelf    = u.id === currentUser?.id;
            const isUpdating = updating === u.id;
            return (
              <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'rgba(255,255,255,0.012)' : 'transparent', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'rgba(255,255,255,0.012)' : 'transparent'}
              >
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-body)' }}>
                      {initials(u.name)}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: '#f1f5f9', fontFamily: 'var(--font-body)', fontWeight: 500 }}>
                        {u.name}{isSelf && <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: '#64748b' }}>(you)</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 14px', fontSize: '0.85rem', color: '#64748b', fontFamily: 'var(--font-body)' }}>{u.email}</td>
                <td style={{ padding: '12px 14px' }}><RoleBadge role={u.role} /></td>
                <td style={{ padding: '12px 14px', fontSize: '0.88rem', color: '#94a3b8', fontFamily: 'var(--font-body)' }}>{u.course_count}</td>
                <td style={{ padding: '12px 14px', fontSize: '0.88rem', color: '#94a3b8', fontFamily: 'var(--font-body)' }}>{u.completed_chapters}</td>
                <td style={{ padding: '12px 14px', fontSize: '0.83rem', color: '#64748b', fontFamily: 'var(--font-body)' }}>
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  {isSelf ? (
                    <span style={{ fontSize: '0.78rem', color: '#475569' }}>—</span>
                  ) : (
                    <button
                      onClick={() => handleRoleToggle(u)}
                      disabled={isUpdating}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: isUpdating ? 'wait' : 'pointer',
                        fontSize: '0.8rem', fontFamily: 'var(--font-body)', fontWeight: 600,
                        background: u.role === 'admin' ? 'rgba(244,63,94,0.1)' : 'rgba(99,102,241,0.12)',
                        color: u.role === 'admin' ? '#f87171' : '#818cf8',
                        border: `1px solid ${u.role === 'admin' ? 'rgba(244,63,94,0.25)' : 'rgba(99,102,241,0.25)'}`,
                        opacity: isUpdating ? 0.5 : 1, transition: 'all 0.18s',
                      }}
                    >
                      {isUpdating ? 'Saving…' : u.role === 'admin'
                        ? <><UserX size={13} /> Demote</>
                        : <><UserCheck size={13} /> Promote</>}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ContentTable({ content, loading }) {
  if (loading) return <LoadingRow />;
  if (!content?.length) return <EmptyRow msg="No content found." />;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {['Course', 'Chapters', 'Done', 'Progress', 'Created'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '0.74rem', color: '#475569', fontFamily: 'var(--font-body)', letterSpacing: '1.5px', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {content.map((m, i) => (
            <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'rgba(255,255,255,0.012)' : 'transparent', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'rgba(255,255,255,0.012)' : 'transparent'}
            >
              <td style={{ padding: '12px 14px', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.88rem', color: '#f1f5f9', fontFamily: 'var(--font-body)' }}>{m.file_name}</td>
              <td style={{ padding: '12px 14px', fontSize: '0.88rem', color: '#94a3b8', fontFamily: 'var(--font-body)' }}>{m.total_chapters}</td>
              <td style={{ padding: '12px 14px', fontSize: '0.88rem', color: '#94a3b8', fontFamily: 'var(--font-body)' }}>{m.completed_chapters}</td>
              <td style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', minWidth: '70px' }}>
                    <div style={{ width: `${m.progress}%`, height: '100%', borderRadius: '3px', background: m.progress === 100 ? 'linear-gradient(90deg,#059669,#10b981)' : 'linear-gradient(90deg,#6366f1,#8b5cf6)', transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', color: m.progress === 100 ? '#34d399' : '#818cf8', fontFamily: 'var(--font-body)', flexShrink: 0, fontWeight: 600 }}>{m.progress}%</span>
                </div>
              </td>
              <td style={{ padding: '12px 14px', fontSize: '0.83rem', color: '#64748b', fontFamily: 'var(--font-body)' }}>
                {m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoadingRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '2rem', color: '#64748b', fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>
      <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      Loading...
    </div>
  );
}

function EmptyRow({ msg }) {
  return <p style={{ color: '#64748b', fontFamily: 'var(--font-body)', padding: '2rem', fontSize: '0.9rem' }}>{msg}</p>;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics,   setMetrics]   = useState(null);
  const [users,     setUsers]     = useState([]);
  const [content,   setContent]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const displayName = user?.user_metadata?.name || user?.user_metadata?.full_name || 'Admin';
  const inits       = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await fetchAllData();
      setMetrics(data.metrics);
      setUsers(data.users);
      setContent(data.content);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const TABS = [
    { key: 'overview', label: 'Overview',      icon: BarChart3 },
    { key: 'users',    label: 'Users',          icon: Users     },
    { key: 'content',  label: 'Content',        icon: BookOpen  },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      {/* Ambient */}
      <div style={{ position: 'fixed', top: '-10%', right: '5%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* ── Sidebar ── */}
      <aside style={{ width: '230px', flexShrink: 0, background: 'rgba(6,6,10,0.97)', borderRight: '1px solid rgba(255,255,255,0.055)', display: 'flex', flexDirection: 'column', padding: '1.75rem 1.1rem', position: 'sticky', top: 0, height: '100vh', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2.25rem', padding: '0 4px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px rgba(99,102,241,0.55)' }}>
            <Brain size={18} color="white" />
          </div>
          <span style={{ fontFamily: 'var(--font-main)', fontSize: '1.25rem', letterSpacing: '4px', color: '#fff' }}>KENAPSE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: '1.75rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #f43f5e, #e11d48)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-body)' }}>{inits}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-body)' }}>{displayName}</div>
            <div style={{ fontSize: '0.71rem', color: '#f87171', fontFamily: 'var(--font-body)', marginTop: '1px' }}>⬡ Admin</div>
          </div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
          {[
            { label: 'Dashboard', path: '/dashboard', icon: Activity },
            { label: 'Admin Panel', path: '/admin', icon: Shield, active: true, accent: '#f43f5e' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button key={item.label} onClick={() => navigate(item.path)} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 13px', borderRadius: '10px', width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.87rem', fontFamily: 'var(--font-body)', background: item.active ? 'rgba(244,63,94,0.1)' : 'transparent', color: item.accent || '#94a3b8', borderLeft: `2px solid ${item.active ? '#f43f5e' : 'transparent'}`, transition: 'all 0.18s' }}>
                <Icon size={16} /> {item.label}
              </button>
            );
          })}
        </nav>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '1rem 0' }} />
        <button onClick={async () => { await signOut(); navigate('/'); }} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 13px', borderRadius: '10px', width: '100%', border: 'none', cursor: 'pointer', fontSize: '0.87rem', fontFamily: 'var(--font-body)', background: 'transparent', color: '#64748b', transition: 'all 0.18s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(244,63,94,0.07)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'transparent'; }}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </aside>

      {/* ── Main ── */}
      <main className="animate-fade-in" style={{ flex: 1, padding: '2.75rem', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.72rem', color: '#f87171', letterSpacing: '2px', fontFamily: 'var(--font-body)', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', padding: '3px 10px', borderRadius: '20px' }}>
                ADMIN ACCESS
              </span>
            </div>
            <h1 style={{ fontSize: '2.5rem', letterSpacing: '3px', lineHeight: 1.1 }}>Control Panel</h1>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px', borderRadius: '10px', cursor: 'pointer',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#94a3b8', fontFamily: 'var(--font-body)', fontSize: '0.88rem',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#f1f5f9'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            <RefreshCw size={15} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', color: '#f87171', fontSize: '0.9rem', fontFamily: 'var(--font-body)', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {/* Metric cards */}
        <MetricCards metrics={metrics} loading={loading} />

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0' }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '11px 18px', background: 'none', border: 'none', cursor: 'pointer',
                color: active ? '#c7d2fe' : '#64748b',
                borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
                fontSize: '0.88rem', fontFamily: 'var(--font-body)', marginBottom: '-1px',
                transition: 'color 0.18s',
              }}>
                <Icon size={14} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div style={{ background: 'rgba(10,10,16,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', padding: '0', overflow: 'hidden' }}>

          {activeTab === 'overview' && (
            <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              {[
                { label: 'Avg Chapters / Course', value: metrics?.total_materials > 0 ? (metrics.total_chapters / metrics.total_materials).toFixed(1) : '—', color: '#818cf8' },
                { label: 'Quiz Coverage',         value: metrics?.total_chapters > 0 ? `${Math.round((metrics.total_quizzes / metrics.total_chapters) * 100)}%` : '—', color: '#34d399' },
                { label: 'Courses / User',        value: metrics?.total_users > 0 ? (metrics.total_materials / metrics.total_users).toFixed(1) : '—', color: '#fcd34d' },
                { label: 'Chapters / User',       value: metrics?.total_users > 0 ? (metrics.total_chapters / metrics.total_users).toFixed(1) : '—', color: '#f9a8d4' },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1.5rem' }}>
                  <p style={{ fontSize: '0.77rem', color: '#64748b', fontFamily: 'var(--font-body)', letterSpacing: '1px', marginBottom: '8px' }}>{stat.label.toUpperCase()}</p>
                  <p style={{ fontSize: '1.8rem', fontWeight: 700, color: stat.color, fontFamily: 'var(--font-main)', letterSpacing: '1px' }}>
                    {loading ? '—' : stat.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'users'   && <UsersTable   users={users}     loading={loading} onRoleChange={() => load(true)} />}
          {activeTab === 'content' && <ContentTable content={content} loading={loading} />}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
