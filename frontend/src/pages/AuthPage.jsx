import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Brain, Zap, BookOpen, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const FEATURES = [
  { icon: Zap,      text: 'AI-generated courses on any topic in seconds' },
  { icon: BookOpen, text: 'Smart lessons grounded in your own materials' },
  { icon: Trophy,   text: 'Adaptive quizzes that evolve with your progress' },
];

const AuthPage = () => {
  const [mode,         setMode]         = useState('login');
  const [name,         setName]         = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg,     setErrorMsg]     = useState('');
  const [successMsg,   setSuccessMsg]   = useState('');
  const [isLoading,    setIsLoading]    = useState(false);
  const navigate = useNavigate();

  const reset = () => { setErrorMsg(''); setSuccessMsg(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    reset();
    setIsLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/dashboard');

      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name } },
        });
        if (error) throw error;
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id, role: 'user', email,
            name: name || email.split('@')[0],
          }, { onConflict: 'id' }).then(() => {}, () => {});
        }
        navigate('/dashboard');

      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        setSuccessMsg('Reset link sent! Check your inbox.');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (m) => { setMode(m); reset(); };

  const inputStyle = {
    width: '100%', padding: '14px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px', color: '#f1f5f9',
    fontFamily: 'var(--font-body)', fontSize: '0.97rem',
    outline: 'none', transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#050505' }}>

      {/* ── Left decorative panel (desktop only) ── */}
      <div style={{
        flex: '0 0 480px', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '4rem',
        background: 'linear-gradient(145deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.07) 50%, rgba(6,6,10,0.95) 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        position: 'relative', overflow: 'hidden',
        '@media(max-width:768px)': { display: 'none' },
      }}
        className="auth-left-panel"
      >
        {/* Background orbs */}
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '350px', height: '350px', background: 'radial-gradient(circle, rgba(139,92,246,0.09) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4rem' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(99,102,241,0.55)',
          }}>
            <Brain size={24} color="white" />
          </div>
          <span style={{ fontFamily: 'var(--font-main)', fontSize: '1.6rem', letterSpacing: '4px', color: '#fff' }}>
            KENAPSE
          </span>
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: '2.8rem', lineHeight: 1.15, marginBottom: '1.25rem', letterSpacing: '2px' }}>
          Learn anything.<br />
          <span style={{
            backgroundImage: 'linear-gradient(90deg, #a5b4fc, #c084fc)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Master everything.
          </span>
        </h1>
        <p style={{ fontSize: '1rem', color: '#94a3b8', lineHeight: 1.75, marginBottom: '3rem', fontFamily: 'var(--font-body)' }}>
          Your AI-powered learning companion that builds personalised courses, lessons, and quizzes — from any topic or document you provide.
        </p>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {FEATURES.map(({ icon: Icon, text }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={16} color="#818cf8" />
              </div>
              <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>
                {text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem', minHeight: '100vh',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Ambient glow */}
        <div style={{ position: 'absolute', top: '20%', right: '15%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="animate-fade-in" style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>

          {/* Mobile logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2.5rem', justifyContent: 'center' }}
            className="auth-mobile-logo"
          >
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px rgba(99,102,241,0.5)' }}>
              <Brain size={20} color="white" />
            </div>
            <span style={{ fontFamily: 'var(--font-main)', fontSize: '1.3rem', letterSpacing: '3px' }}>KENAPSE</span>
          </div>

          {/* Card */}
          <div style={{
            background: 'rgba(10,10,16,0.92)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '22px', padding: '2.5rem',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
          }}>

            {/* Mode heading */}
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.9rem', letterSpacing: '2px', marginBottom: '6px' }}>
                {mode === 'login'    ? 'Welcome back'   :
                 mode === 'register' ? 'Create account' : 'Reset password'}
              </h2>
              <p style={{ fontSize: '0.88rem', color: '#64748b', fontFamily: 'var(--font-body)' }}>
                {mode === 'login'    ? 'Sign in to continue your learning journey.' :
                 mode === 'register' ? 'Join thousands of learners powered by AI.' :
                                      'We\'ll send a reset link to your email.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {mode === 'register' && (
                <input
                  type="text" placeholder="Full Name" required
                  value={name} onChange={e => setName(e.target.value)}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#6366f1'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              )}

              <input
                type="email" placeholder="Email address" required
                value={email} onChange={e => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />

              {mode !== 'forgot' && (
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password" required
                    value={password} onChange={e => setPassword(e.target.value)}
                    style={{ ...inputStyle, paddingRight: '3rem' }}
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                  <button
                    type="button" tabIndex={-1}
                    onClick={() => setShowPassword(v => !v)}
                    style={{
                      position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#64748b', padding: 0, display: 'flex', alignItems: 'center',
                      transition: 'color 0.2s',
                    }}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              )}

              {mode === 'login' && (
                <div style={{ textAlign: 'right', marginTop: '-4px' }}>
                  <span
                    onClick={() => switchMode('forgot')}
                    style={{ fontSize: '0.84rem', color: '#818cf8', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                  >
                    Forgot password?
                  </span>
                </div>
              )}

              {/* Error / success */}
              {errorMsg && (
                <div style={{
                  padding: '11px 14px', borderRadius: '10px',
                  background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)',
                  color: '#f87171', fontSize: '0.87rem', fontFamily: 'var(--font-body)',
                }}>
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div style={{
                  padding: '11px 14px', borderRadius: '10px',
                  background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                  color: '#34d399', fontSize: '0.87rem', fontFamily: 'var(--font-body)',
                }}>
                  {successMsg}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit" disabled={isLoading}
                style={{
                  marginTop: '0.5rem',
                  width: '100%', padding: '14px',
                  borderRadius: '12px', border: 'none',
                  cursor: isLoading ? 'wait' : 'pointer',
                  background: isLoading
                    ? 'rgba(99,102,241,0.35)'
                    : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: '#fff', fontSize: '0.97rem',
                  fontFamily: 'var(--font-body)', fontWeight: 600,
                  boxShadow: isLoading ? 'none' : '0 0 28px rgba(99,102,241,0.4)',
                  transition: 'all 0.25s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                }}
              >
                {isLoading ? (
                  <>
                    <span style={{ display: 'inline-block', width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Please wait...
                  </>
                ) : (
                  mode === 'login'    ? 'Sign In'         :
                  mode === 'register' ? 'Create Account'  : 'Send Reset Link'
                )}
              </button>
            </form>

            {/* Mode switch */}
            <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.88rem', color: '#64748b', fontFamily: 'var(--font-body)' }}>
              {mode === 'login' && (
                <>Don't have an account?{' '}
                  <span onClick={() => switchMode('register')} style={{ color: '#818cf8', cursor: 'pointer', fontWeight: 600 }}>
                    Sign Up
                  </span>
                </>
              )}
              {mode === 'register' && (
                <>Already have an account?{' '}
                  <span onClick={() => switchMode('login')} style={{ color: '#818cf8', cursor: 'pointer', fontWeight: 600 }}>
                    Sign In
                  </span>
                </>
              )}
              {mode === 'forgot' && (
                <span onClick={() => switchMode('login')} style={{ color: '#818cf8', cursor: 'pointer', fontWeight: 600 }}>
                  ← Back to Sign In
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .auth-left-panel { display: none !important; }
        }
        @media (min-width: 769px) {
          .auth-mobile-logo { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default AuthPage;
