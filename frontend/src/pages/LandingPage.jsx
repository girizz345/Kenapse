import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Upload, Zap, BarChart3, MessageSquare, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';

const FEATURES = [
  {
    icon: <Upload size={28} />,
    title: 'Upload Any Document',
    desc: 'PDF, notes, textbooks — drop your file and Kenapse turns it into a structured course in under 60 seconds.',
  },
  {
    icon: <Brain size={28} />,
    title: 'AI-Generated Curriculum',
    desc: 'Chapters, lessons, and quizzes are generated from your exact content — not generic internet data.',
  },
  {
    icon: <BarChart3 size={28} />,
    title: 'Track Every Chapter',
    desc: 'Visual progress map shows completed chapters, quiz scores, and what to study next.',
  },
  {
    icon: <MessageSquare size={28} />,
    title: 'Built-in AI Tutor',
    desc: 'Ask questions about the lesson content at any point. Kenapse explains, corrects, and adapts.',
  },
  {
    icon: <Zap size={28} />,
    title: 'Adaptive Difficulty',
    desc: 'Quiz performance automatically adjusts lesson depth — easier when you struggle, harder when you excel.',
  },
  {
    icon: <Sparkles size={28} />,
    title: 'Generate From Any Topic',
    desc: 'No document? No problem. Type any topic and get a full course generated from scratch in seconds.',
  },
];

const STEPS = [
  { num: '01', title: 'Upload or Choose a Topic', desc: 'Drop your PDF or type any subject you want to learn.' },
  { num: '02', title: 'Kenapse Builds Your Course', desc: 'AI structures chapters, writes lessons, and generates quizzes from your material.' },
  { num: '03', title: 'Learn, Quiz, Progress', desc: 'Work through lessons, test yourself, and track completion — all in one place.' },
];

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    highlight: false,
    features: [
      '3 AI-generated courses / month',
      '1 PDF upload / month',
      'Chapter quizzes',
      'Progress tracking',
      'AI tutor chat',
    ],
    cta: 'Get Started Free',
    ctaVariant: 'outline',
  },
  {
    name: 'Pro',
    price: '$9',
    period: 'per month',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Unlimited course generation',
      'Unlimited PDF uploads',
      'Advanced adaptive quizzes',
      'PDF lesson export',
      'Priority AI (faster responses)',
      'Full learning analytics',
    ],
    cta: 'Start Pro — $9/mo',
    ctaVariant: 'primary',
  },
];

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', color: 'var(--text-color)', fontFamily: 'var(--font-body)' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1.25rem 2.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(8px)',
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.4)',
      }}>
        <span style={{ fontSize: '1.4rem', fontFamily: 'var(--font-heading)', letterSpacing: '2px', color: 'var(--accent-color)' }}>
          KENAPSE
        </span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="btn btn-outline" style={{ padding: '8px 20px', fontSize: '0.9rem' }} onClick={() => navigate('/auth')}>
            Sign In
          </button>
          <button className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.9rem' }} onClick={() => navigate('/auth')}>
            Get Started
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section style={{ textAlign: 'center', padding: '7rem 2rem 5rem', maxWidth: '780px', margin: '0 auto' }}>
        <div style={{
          display: 'inline-block', padding: '6px 16px', borderRadius: '999px',
          background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
          fontSize: '0.82rem', color: 'var(--accent-color)', marginBottom: '2rem',
          letterSpacing: '0.5px',
        }}>
          AI-Powered Adaptive Learning
        </div>

        <h1 style={{
          fontSize: 'clamp(2.4rem, 5vw, 4rem)',
          lineHeight: 1.1,
          marginBottom: '1.5rem',
          fontFamily: 'var(--font-heading)',
          background: 'linear-gradient(135deg, #ffffff 30%, #a5b4fc 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Your Documents<br />Become Your Teacher
        </h1>

        <p style={{ fontSize: '1.15rem', color: 'var(--text-muted)', maxWidth: '560px', margin: '0 auto 3rem', lineHeight: 1.7 }}>
          Upload any PDF or type a topic. Kenapse generates a full course — chapters, lessons, and adaptive quizzes —
          in under 60 seconds. Then tracks your progress chapter by chapter.
        </p>

        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            style={{ fontSize: '1.05rem', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => navigate('/auth')}
          >
            Start Learning Free <ArrowRight size={18} />
          </button>
          <button
            className="btn btn-outline"
            style={{ fontSize: '1.05rem', padding: '14px 32px' }}
            onClick={() => document.getElementById('how-it-works').scrollIntoView({ behavior: 'smooth' })}
          >
            See How It Works
          </button>
        </div>

        <p style={{ marginTop: '1.5rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.3)' }}>
          No credit card required · Free tier always available
        </p>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section style={{ padding: '5rem 2rem', maxWidth: '1100px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2rem', fontFamily: 'var(--font-heading)', marginBottom: '0.75rem' }}>
          Everything you need to actually learn
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '3.5rem', fontSize: '1rem' }}>
          Not just AI chat — a complete learning system built around your material.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ color: 'var(--accent-color)' }}>{f.icon}</div>
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>{f.title}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: '5rem 2rem', maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2rem', fontFamily: 'var(--font-heading)', marginBottom: '0.75rem' }}>
          How it works
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '3.5rem' }}>Three steps from file to fluency.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {STEPS.map((s, i) => (
            <div key={i} className="glass-panel" style={{ padding: '2rem 2.5rem', display: 'flex', alignItems: 'flex-start', gap: '2rem' }}>
              <span style={{
                fontSize: '2.5rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-color)',
                opacity: 0.5, flexShrink: 0, lineHeight: 1,
              }}>{s.num}</span>
              <div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>{s.title}</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '5rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2rem', fontFamily: 'var(--font-heading)', marginBottom: '0.75rem' }}>
          Simple pricing
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '3.5rem' }}>
          Start free. Upgrade when you need more.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {PLANS.map((plan, i) => (
            <div
              key={i}
              className="glass-panel"
              style={{
                padding: '2.5rem',
                position: 'relative',
                border: plan.highlight ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--glass-border)',
                boxShadow: plan.highlight ? '0 0 40px rgba(99,102,241,0.15)' : 'none',
              }}
            >
              {plan.badge && (
                <div style={{
                  position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--accent-color)', color: 'white', padding: '4px 14px',
                  borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap',
                }}>
                  {plan.badge}
                </div>
              )}
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>{plan.name}</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '2.8rem', fontFamily: 'var(--font-heading)', color: plan.highlight ? 'var(--accent-color)' : '#fff' }}>
                  {plan.price}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{plan.period}</span>
              </div>
              <div style={{ height: '1px', background: 'var(--glass-border)', margin: '1.5rem 0' }} />
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {plan.features.map((feat, fi) => (
                  <li key={fi} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                    <CheckCircle size={16} color="#10b981" style={{ flexShrink: 0 }} />
                    {feat}
                  </li>
                ))}
              </ul>
              <button
                className={`btn btn-${plan.ctaVariant}`}
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => navigate('/auth')}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer CTA ──────────────────────────────────────────────────── */}
      <section style={{ textAlign: 'center', padding: '5rem 2rem 6rem' }}>
        <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto', padding: '4rem 3rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '1rem' }}>
            Ready to learn differently?
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1rem' }}>
            Join Kenapse and turn your study materials into interactive courses — free, forever.
          </p>
          <button
            className="btn btn-primary"
            style={{ fontSize: '1.05rem', padding: '14px 36px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            onClick={() => navigate('/auth')}
          >
            Get Started <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '1.5rem 2.5rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '1rem',
        color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem',
      }}>
        <span style={{ fontFamily: 'var(--font-heading)', letterSpacing: '2px', color: 'var(--accent-color)', opacity: 0.7 }}>KENAPSE</span>
        <span>© {new Date().getFullYear()} Kenapse. All rights reserved.</span>
      </footer>
    </div>
  );
};

export default LandingPage;
