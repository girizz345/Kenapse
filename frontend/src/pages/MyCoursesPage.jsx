import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Play, CheckCircle, PlusCircle,
  Trash2, Activity, User, Settings, Shield, LogOut, Brain,
} from 'lucide-react';
import { getUserCourses, deleteCourse } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CARD_GRADIENTS = [
  'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
  'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
  'linear-gradient(135deg, #431407 0%, #7c2d12 100%)',
  'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)',
  'linear-gradient(135deg, #3b0764 0%, #581c87 100%)',
  'linear-gradient(135deg, #134e4a 0%, #0f766e 100%)',
];

const MyCoursesPage = () => {
  const navigate  = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const [courses,    setCourses]    = useState([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [error,      setError]      = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmId,  setConfirmId]  = useState(null);

  const displayName = user?.user_metadata?.name || user?.user_metadata?.full_name || 'Student';
  const initials    = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const data = await getUserCourses(user.id);
        setCourses(data.map(m => ({
          id:                m.id,
          title:             m.file_name.replace(/\.[^/.]+$/, ''),
          status:            m.progress === 100 ? 'completed' : 'in_progress',
          progress:          m.progress ?? 0,
          totalChapters:     m.total_chapters ?? 0,
          completedChapters: m.completed_chapters ?? 0,
          createdAt:         m.created_at,
        })));
      } catch (err) {
        setError('Failed to load your courses. Please try again.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user?.id]);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteCourse(id);
      setCourses(prev => prev.filter(c => c.id !== id));
    } catch {
      setError('Failed to delete course. Please try again.');
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  const navItems = [
    { label: 'Dashboard',  icon: Activity,  path: '/dashboard' },
    { label: 'My Courses', icon: BookOpen,  path: '/courses', active: true },
    { label: 'Profile',    icon: User,      path: '/profile' },
    { label: 'Settings',   icon: Settings,  path: '/settings' },
  ];
  if (isAdmin) navItems.push({ label: 'Admin Panel', icon: Shield, path: '/admin', accent: '#f43f5e' });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      {/* Ambient blobs */}
      <div style={{ position: 'fixed', top: '-10%', right: '5%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '5%', left: '20%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* ── Sidebar ── */}
      <aside style={{
        width: '230px', flexShrink: 0,
        background: 'rgba(6,6,10,0.97)',
        borderRight: '1px solid rgba(255,255,255,0.055)',
        display: 'flex', flexDirection: 'column',
        padding: '1.75rem 1.1rem',
        position: 'sticky', top: 0, height: '100vh', zIndex: 10,
      }}
        className="courses-sidebar"
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2.25rem', padding: '0 4px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px rgba(99,102,241,0.55)' }}>
            <Brain size={18} color="white" />
          </div>
          <span style={{ fontFamily: 'var(--font-main)', fontSize: '1.25rem', letterSpacing: '4px', color: '#fff' }}>KENAPSE</span>
        </div>

        {/* User chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: '1.75rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 700, color: 'white', fontFamily: 'var(--font-body)' }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-body)' }}>{displayName}</div>
            <div style={{ fontSize: '0.71rem', color: isAdmin ? '#f87171' : '#818cf8', fontFamily: 'var(--font-body)', marginTop: '1px' }}>{isAdmin ? '⬡ Admin' : '◈ Student'}</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.label} onClick={() => navigate(item.path)} style={{
                display: 'flex', alignItems: 'center', gap: '11px',
                padding: '10px 13px', borderRadius: '10px', width: '100%',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                fontSize: '0.87rem', fontFamily: 'var(--font-body)',
                background: item.active ? 'rgba(99,102,241,0.13)' : 'transparent',
                color: item.accent || (item.active ? '#c7d2fe' : '#94a3b8'),
                borderLeft: `2px solid ${item.active ? '#6366f1' : item.accent || 'transparent'}`,
                transition: 'all 0.18s',
              }}>
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
      <main className="animate-fade-in" style={{ flex: 1, padding: '2.75rem 2.75rem 4rem', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p style={{ fontSize: '0.76rem', color: '#475569', letterSpacing: '2px', fontFamily: 'var(--font-body)', marginBottom: '6px' }}>LIBRARY</p>
            <h1 style={{ fontSize: '2.5rem', letterSpacing: '3px', lineHeight: 1.1 }}>My Courses</h1>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '11px 20px', borderRadius: '11px', cursor: 'pointer',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none', color: '#fff',
              fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 600,
              boxShadow: '0 0 22px rgba(99,102,241,0.35)',
            }}
          >
            <PlusCircle size={16} /> New Course
          </button>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', color: '#f87171', fontSize: '0.9rem', fontFamily: 'var(--font-body)', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ color: '#64748b', fontFamily: 'var(--font-body)', marginTop: '1rem', fontSize: '0.9rem' }}>Loading your courses...</p>
            </div>
          </div>
        ) : courses.length === 0 ? (
          /* Empty state */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: '50vh', textAlign: 'center',
          }}>
            <div style={{
              width: '90px', height: '90px', borderRadius: '24px', marginBottom: '2rem',
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BookOpen size={40} color="#6366f1" />
            </div>
            <h2 style={{ fontSize: '1.6rem', marginBottom: '0.75rem', letterSpacing: '2px' }}>No courses yet</h2>
            <p style={{ color: '#64748b', fontFamily: 'var(--font-body)', fontSize: '0.95rem', marginBottom: '2rem', maxWidth: '380px', lineHeight: 1.7 }}>
              Generate a course from any topic, or upload your study materials from the dashboard to get started.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '13px 28px', borderRadius: '12px', cursor: 'pointer',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none', color: '#fff',
                fontFamily: 'var(--font-body)', fontSize: '0.95rem', fontWeight: 600,
                boxShadow: '0 0 24px rgba(99,102,241,0.4)',
              }}
            >
              <PlusCircle size={17} /> Go to Dashboard
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {courses.map((course, idx) => (
              <div
                key={course.id}
                style={{
                  background: 'rgba(10,10,16,0.9)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '18px', overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                {/* Card banner */}
                <div style={{
                  height: '110px', position: 'relative',
                  background: CARD_GRADIENTS[idx % CARD_GRADIENTS.length],
                }}>
                  <div style={{ position: 'absolute', inset: 0, opacity: 0.3, backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />
                  <div style={{ position: 'absolute', top: '50%', left: '1.5rem', transform: 'translateY(-50%)', width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BookOpen size={22} color="rgba(255,255,255,0.9)" />
                  </div>
                  {course.status === 'completed' && (
                    <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(16,185,129,0.25)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399', fontSize: '0.76rem', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
                      <CheckCircle size={12} /> Done
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: '12px', right: '12px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', fontFamily: 'var(--font-body)' }}>
                    {course.totalChapters} chapter{course.totalChapters !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding: '1.4rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '1.05rem', marginBottom: '0.5rem', lineHeight: 1.35, color: '#f1f5f9' }}>
                    {course.title}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.1rem', fontFamily: 'var(--font-body)' }}>
                    {course.completedChapters} of {course.totalChapters} chapters completed
                  </p>

                  {/* Progress bar */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginBottom: '6px', fontFamily: 'var(--font-body)' }}>
                      <span>Progress</span>
                      <span style={{ color: course.status === 'completed' ? '#34d399' : '#818cf8', fontWeight: 600 }}>
                        {course.progress}%
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${course.progress}%`, height: '100%', borderRadius: '3px',
                        background: course.status === 'completed'
                          ? 'linear-gradient(90deg, #059669, #10b981)'
                          : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>

                  {/* Actions */}
                  {confirmId === course.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ fontSize: '0.83rem', color: '#f87171', textAlign: 'center', margin: 0, fontFamily: 'var(--font-body)' }}>
                        Delete this course? This cannot be undone.
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          disabled={deletingId === course.id}
                          onClick={() => handleDelete(course.id)}
                          style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', cursor: 'pointer', background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', color: '#f87171', fontSize: '0.85rem', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <Trash2 size={13} /> {deletingId === course.id ? 'Deleting...' : 'Confirm'}
                        </button>
                        <button
                          disabled={deletingId === course.id}
                          onClick={() => setConfirmId(null)}
                          style={{ flex: 1, padding: '9px', borderRadius: '9px', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.85rem', fontFamily: 'var(--font-body)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      <button
                        onClick={() => navigate(`/course/${course.id}`)}
                        style={{
                          flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                          background: course.status === 'completed'
                            ? 'rgba(255,255,255,0.07)'
                            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                          color: '#fff',
                          fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                          boxShadow: course.status === 'completed' ? 'none' : '0 0 16px rgba(99,102,241,0.3)',
                        }}
                      >
                        {course.status === 'completed' ? 'Review' : <><Play size={14} /> Continue</>}
                      </button>
                      <button
                        onClick={() => setConfirmId(course.id)}
                        title="Delete course"
                        style={{
                          padding: '10px 13px', borderRadius: '10px', cursor: 'pointer',
                          background: 'rgba(244,63,94,0.07)',
                          border: '1px solid rgba(244,63,94,0.2)',
                          color: '#f87171', display: 'flex', alignItems: 'center',
                          transition: 'all 0.18s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.15)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.07)'; }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <style>{`
        @media (max-width: 768px) { .courses-sidebar { display: none !important; } }
      `}</style>
    </div>
  );
};

export default MyCoursesPage;
