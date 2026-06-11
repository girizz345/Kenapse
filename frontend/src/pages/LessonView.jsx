import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Download, ArrowRight, ArrowLeft,
  Volume2, VolumeX, Minus, Plus,
  BookOpen, CheckCircle2, Circle, Sparkles,
  RefreshCw, ImageIcon, Send, Maximize2, X,
} from 'lucide-react';
import { getLesson, exportPdf, getChapters } from '../services/api';
import { supabase } from '../lib/supabaseClient';
import Chatbot from '../components/Chatbot';
import MathRenderer from '../components/MathRenderer';
import { useAuth } from '../context/AuthContext';

// ── Deterministic gradient per topic (no network call needed) ─────────────────
const HERO_GRADIENTS = [
  'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e3a5f 100%)',
  'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #134e4a 100%)',
  'linear-gradient(135deg, #431407 0%, #7c2d12 50%, #451a03 100%)',
  'linear-gradient(135deg, #1e3a5f 0%, #1e40af 50%, #1e1b4b 100%)',
  'linear-gradient(135deg, #3b0764 0%, #581c87 50%, #2e1065 100%)',
  'linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0c4a6e 100%)',
  'linear-gradient(135deg, #14532d 0%, #166534 50%, #052e16 100%)',
  'linear-gradient(135deg, #4c0519 0%, #881337 50%, #4a0515 100%)',
];

function topicGradient(title) {
  const hash = (title || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return HERO_GRADIENTS[hash % HERO_GRADIENTS.length];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toParagraphs(text) {
  if (Array.isArray(text)) return text;
  if (!text) return [];
  const byNewline = text.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
  if (byNewline.length > 1) return byNewline;
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const out = [];
  for (let i = 0; i < sentences.length; i += 3) {
    out.push(sentences.slice(i, i + 3).join(' ').trim());
  }
  return out.filter(Boolean);
}

function readTime(text) {
  const words = (text || '').split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

// ── Component ─────────────────────────────────────────────────────────────────
const LessonView = () => {
  const { materialId, chapterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lesson,        setLesson]        = useState(null);
  const [isLoading,     setIsLoading]     = useState(true);
  const [pdfImages,     setPdfImages]     = useState([]);
  const [scrollProgress,setScrollProgress]= useState(0);
  const [fontSize,      setFontSize]      = useState(17);
  const [isSpeaking,    setIsSpeaking]    = useState(false);
  const [checkedPoints, setCheckedPoints] = useState({});
  const [isMobile,      setIsMobile]      = useState(window.innerWidth < 800);

  // AI Illustration state
  const [aiPrompt,       setAiPrompt]       = useState('');
  const [aiImageUrl,     setAiImageUrl]     = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError,        setAiError]        = useState('');
  const [aiLightbox,     setAiLightbox]     = useState(false);

  const containerRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 800);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(total > 0 ? (window.scrollY / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        let chaptersData;
        try {
          chaptersData = await getChapters(materialId);
        } catch {
          const { data, error } = await supabase
            .from('chapters').select('*')
            .eq('material_id', materialId).order('order_index');
          if (error) throw new Error(error.message);
          chaptersData = data || [];
        }

        const chapter = chaptersData.find(c => String(c.id) === String(chapterId));
        if (!chapter) throw new Error('Chapter not found');

        const data = await getLesson(
          chapter.id,
          chapter.topics?.[0] || chapter.title,
          'intermediate',
          chapter.content_text || '',
          user?.id ?? null,
        );
        setLesson(data);

        // Load PDF images extracted from the uploaded material (the only image source)
        const { data: matData } = await supabase
          .from('study_materials')
          .select('pdf_images')
          .eq('id', materialId)
          .single();
        setPdfImages(matData?.pdf_images || []);

        // Pre-fill AI illustration prompt with the lesson topic
        setAiPrompt(`Clear educational diagram explaining ${data.title}, labelled illustration, clean white background, simple and informative`);
      } catch (err) {
        console.error(err);
        alert('Failed to load lesson');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [materialId, chapterId]);

  // Generate AI illustration via Pollinations.ai (free, no API key)
  const handleGenerateAI = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAI(true);
    setAiError('');
    setAiImageUrl('');
    try {
      const encoded = encodeURIComponent(aiPrompt.trim());
      // Pollinations.ai: free image generation, ~10-20s per request
      const url = `https://image.pollinations.ai/prompt/${encoded}?width=900&height=500&nologo=true&model=flux&seed=${Date.now()}`;
      // Pre-load the image to detect errors before showing it
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = () => reject(new Error('Image generation failed'));
        img.src = url;
      });
      setAiImageUrl(url);
    } catch {
      setAiError('Generation failed — please try again or rephrase your prompt.');
    } finally {
      setIsGeneratingAI(false);
    }
  }, [aiPrompt]);

  // Download AI image as blob (required — direct <a download> blocked by CORS on external domain)
  const handleDownloadAI = useCallback(async () => {
    if (!aiImageUrl) return;
    try {
      const res = await fetch(aiImageUrl);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `ai-diagram-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      alert('Download failed — try right-clicking the image and saving manually.');
    }
  }, [aiImageUrl]);

  // Close lightbox on Escape key
  useEffect(() => {
    if (!aiLightbox) return;
    const onKey = (e) => { if (e.key === 'Escape') setAiLightbox(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aiLightbox]);

  const handleTTS = useCallback(() => {
    if (!lesson) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const text = [
      lesson.title, lesson.summary, lesson.explanation,
      'Example:', lesson.example,
      'Key points:', ...(lesson.key_points || []),
    ].filter(Boolean).join('. ');
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.92;
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utter);
    setIsSpeaking(true);
  }, [lesson, isSpeaking]);

  useEffect(() => () => window.speechSynthesis.cancel(), []);

  const handleExport = async () => {
    try { await exportPdf(lesson); }
    catch { alert('Failed to export PDF'); }
  };

  const togglePoint = (idx) =>
    setCheckedPoints(prev => ({ ...prev, [idx]: !prev[idx] }));

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
      <span style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>Loading lesson...</p>
    </div>
  );
  if (!lesson) return null;

  const paragraphs  = toParagraphs(lesson.explanation);
  const minutes     = readTime(lesson.explanation);
  const totalPoints = lesson.key_points?.length || 0;
  const checkedCount = Object.values(checkedPoints).filter(Boolean).length;
  const heroGradient = topicGradient(lesson.title);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ minHeight: '100vh', background: 'var(--bg-color)' }}>

      {/* Reading progress bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, height: '3px', zIndex: 1000,
        width: `${scrollProgress}%`, background: 'var(--accent-color)',
        boxShadow: '0 0 10px var(--accent-glow)', transition: 'width 0.1s linear',
      }} />

      {/* ── Sticky navbar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(5,5,5,0.9)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--glass-border)',
        padding: '0.65rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <button className="btn btn-outline" onClick={() => navigate(`/course/${materialId}`)}
          style={{ padding: '6px 14px', fontSize: '0.85rem', gap: '6px' }}>
          <ArrowLeft size={16} /> Back to Path
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Font size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '4px 8px' }}>
            <button onClick={() => setFontSize(f => Math.max(14, f - 1))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1, padding: '2px' }}>
              <Minus size={13} />
            </button>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0 4px' }}>Aa</span>
            <button onClick={() => setFontSize(f => Math.min(22, f + 1))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1, padding: '2px' }}>
              <Plus size={13} />
            </button>
          </div>

          {/* Listen */}
          <button onClick={handleTTS} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px',
            background: isSpeaking ? 'rgba(99,102,241,0.15)' : 'transparent',
            border: '1px solid var(--glass-border)', borderRadius: '8px',
            cursor: 'pointer', color: isSpeaking ? 'var(--accent-color)' : 'var(--text-muted)',
            fontSize: '0.85rem',
          }}>
            {isSpeaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
            {isSpeaking ? 'Stop' : 'Listen'}
          </button>

          {/* Export */}
          <button className="btn btn-outline" onClick={handleExport}
            style={{ padding: '6px 14px', fontSize: '0.85rem', gap: '6px' }}>
            <Download size={15} /> Export PDF
          </button>
        </div>
      </div>

      {/* ── Hero banner — gradient, no external images ── */}
      <div style={{
        position: 'relative', width: '100%',
        height: isMobile ? '200px' : '320px',
        background: heroGradient, overflow: 'hidden',
      }}>
        {/* Subtle noise texture overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.06) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.04) 0%, transparent 50%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(5,5,5,0) 0%, rgba(5,5,5,0.5) 70%, #050505 100%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '1.75rem',
          left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: '900px', padding: '0 2rem',
        }}>
          <div style={{ display: 'flex', gap: '1rem', color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', marginBottom: '0.65rem', fontFamily: 'var(--font-body)', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <BookOpen size={13} /> {minutes} min read
            </span>
            <span>{totalPoints} key points</span>
            {lesson.fun_fact && <span style={{ color: '#fcd34d' }}>✦ Fun fact</span>}
            {pdfImages.length > 0 && <span style={{ color: '#34d399' }}>✦ {pdfImages.length} figure{pdfImages.length > 1 ? 's' : ''} from your material</span>}
          </div>
          <h1 style={{ fontSize: isMobile ? '1.8rem' : '2.75rem', lineHeight: 1.15, letterSpacing: '2px' }}>
            {lesson.title}
          </h1>
        </div>
      </div>

      {/* ── Main content grid ── */}
      <div style={{
        maxWidth: '1140px', margin: '0 auto',
        padding: '2.5rem 2rem 6rem',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 300px',
        gap: isMobile ? '2rem' : '3rem',
        alignItems: 'start',
      }}>

        {/* ── Left: content ── */}
        <div>

          {/* TL;DR */}
          {lesson.summary && (
            <div style={{
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.25)',
              borderLeft: '4px solid var(--accent-color)',
              borderRadius: '0 12px 12px 0',
              padding: '1.2rem 1.5rem',
              marginBottom: '2.5rem',
            }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--accent-color)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.4rem', textTransform: 'uppercase' }}>TL;DR</p>
              <div style={{ fontSize: `${fontSize}px`, lineHeight: 1.75, color: 'rgba(255,255,255,0.9)' }}><MathRenderer text={lesson.summary} /></div>
            </div>
          )}

          {/* Visual Aid — only PDF images from the uploaded material */}
          {pdfImages.length > 0 && (
            <div style={{ marginBottom: '2.5rem' }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.9rem' }}>
                Visual Aid <span style={{ color: 'var(--accent-color)', marginLeft: '8px' }}>· from your material</span>
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'thin' }}>
                {pdfImages.map((url, idx) => (
                  <div key={idx} style={{
                    flexShrink: 0, borderRadius: '12px', overflow: 'hidden',
                    border: '1px solid var(--glass-border)',
                    width: pdfImages.length === 1 ? '100%' : '280px',
                  }}>
                    <img
                      src={url}
                      alt={`${lesson.title} — figure ${idx + 1}`}
                      style={{
                        width: '100%',
                        height: pdfImages.length === 1 ? 'auto' : '200px',
                        maxHeight: '420px',
                        objectFit: pdfImages.length === 1 ? 'contain' : 'cover',
                        display: 'block', background: '#111',
                      }}
                      onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
                    />
                    <div style={{ background: 'rgba(20,20,30,0.9)', padding: '0.5rem 0.8rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Figure {idx + 1} — from uploaded material
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Explanation paragraphs */}
          <div style={{ marginBottom: '2.5rem' }}>
            {paragraphs.map((para, idx) => (
              <div key={idx} style={{
                fontSize: `${fontSize}px`,
                lineHeight: 1.95,
                color: 'rgba(255,255,255,0.82)',
                marginBottom: '1.6rem',
              }}>
                <MathRenderer text={para} />
              </div>
            ))}
          </div>

          {/* Example — structured step-by-step rendering */}
          <div style={{
            background: 'rgba(16,185,129,0.05)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: '14px',
            padding: '1.6rem 1.8rem',
            marginBottom: '2rem',
          }}>
            <p style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, letterSpacing: '0.12em', marginBottom: '1.2rem', textTransform: 'uppercase' }}>
              Worked Example
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {(lesson.example_steps || []).map((step, i) => {
                if (step.type === 'header') {
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      marginTop: i === 0 ? 0 : '1.4rem', marginBottom: '0.55rem',
                    }}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
                        color: '#10b981', background: 'rgba(16,185,129,0.13)',
                        border: '1px solid rgba(16,185,129,0.35)',
                        borderRadius: '6px', padding: '3px 10px', whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}>
                        {step.text}
                      </span>
                      <span style={{ flex: 1, height: '1px', background: 'rgba(16,185,129,0.12)' }} />
                    </div>
                  );
                }

                if (step.type === 'formula') {
                  return (
                    <div key={i} style={{
                      margin: '0.5rem 0',
                      padding: '0.5rem 1rem',
                      overflowX: 'auto',
                      textAlign: 'center',
                      fontSize: `${fontSize + 1}px`,
                    }}>
                      <MathRenderer text={`$$${step.text}$$`} />
                    </div>
                  );
                }

                if (step.type === 'answer') {
                  return (
                    <div key={i} style={{
                      margin: '1rem 0 0.25rem',
                      padding: '0.75rem 1.2rem',
                      overflowX: 'auto',
                      textAlign: 'center',
                      background: 'rgba(16,185,129,0.1)',
                      border: '1px solid rgba(16,185,129,0.3)',
                      borderRadius: '10px',
                      fontSize: `${fontSize + 2}px`,
                    }}>
                      <MathRenderer text={`$$${step.text}$$`} />
                    </div>
                  );
                }

                // type === 'text' (default)
                return (
                  <div key={i} style={{
                    fontSize: `${fontSize}px`,
                    lineHeight: 1.85,
                    color: 'rgba(255,255,255,0.82)',
                    paddingLeft: '0.25rem',
                    marginBottom: '0.2rem',
                  }}>
                    <MathRenderer text={step.text} />
                  </div>
                );
              })}

              {/* Fallback: split prose into sentence-per-line when no structured steps */}
              {(!lesson.example_steps || lesson.example_steps.length === 0) && lesson.example && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {lesson.example
                    .replace(/\. ([A-Z])/g, '.\n$1')   // sentence → new line
                    .replace(/([=:]) /g, '$1\n')         // after = or : → new line
                    .split('\n')
                    .map(s => s.trim())
                    .filter(Boolean)
                    .map((sentence, i) => (
                      <div key={i} style={{
                        fontSize: `${fontSize}px`,
                        lineHeight: 1.85,
                        color: 'rgba(255,255,255,0.82)',
                        borderLeft: sentence.includes('=') ? '2px solid rgba(16,185,129,0.4)' : 'none',
                        paddingLeft: sentence.includes('=') ? '0.75rem' : '0.25rem',
                      }}>
                        <MathRenderer text={sentence} />
                      </div>
                    ))
                  }
                  <div style={{
                    marginTop: '0.75rem', padding: '0.5rem 0.9rem',
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                    borderRadius: '8px', fontSize: '0.75rem', color: '#f59e0b',
                  }}>
                    ⚠ Backend needs redeploy for full step-by-step LaTeX rendering
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fun fact */}
          {lesson.fun_fact && (
            <div style={{
              display: 'flex', gap: '1rem', alignItems: 'flex-start',
              background: 'rgba(245,158,11,0.07)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: '12px',
              padding: '1.2rem 1.5rem',
              marginBottom: '2.5rem',
            }}>
              <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>💡</span>
              <div>
                <p style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Fun Fact</p>
                <div style={{ fontSize: `${fontSize - 1}px`, lineHeight: 1.8, color: 'rgba(255,255,255,0.8)' }}><MathRenderer text={lesson.fun_fact} /></div>
              </div>
            </div>
          )}

          {/* CTA */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem' }}>
            <button
              className="btn btn-primary"
              style={{ padding: '14px 36px', fontSize: '1rem', gap: '8px' }}
              onClick={() => navigate(`/quiz/${materialId}/${chapterId}`)}
            >
              Take Quiz <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* ── Right: sidebar ── */}
        <div style={{ position: isMobile ? 'static' : 'sticky', top: '72px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Key points checklist */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
              <h3 style={{ fontSize: '0.9rem', letterSpacing: '1px' }}>Key Points</h3>
              <span style={{
                fontSize: '0.75rem', fontWeight: 700,
                color: checkedCount === totalPoints && totalPoints > 0 ? '#10b981' : 'var(--text-muted)',
              }}>
                {checkedCount}/{totalPoints}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {lesson.key_points?.map((point, idx) => (
                <div key={idx} onClick={() => togglePoint(idx)} style={{
                  display: 'flex', gap: '10px', alignItems: 'flex-start',
                  cursor: 'pointer',
                  opacity: checkedPoints[idx] ? 0.5 : 1,
                  transition: 'opacity 0.2s',
                }}>
                  {checkedPoints[idx]
                    ? <CheckCircle2 size={17} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                    : <Circle size={17} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />}
                  <div style={{
                    fontSize: '0.85rem', lineHeight: 1.65, color: 'var(--text-muted)',
                    textDecoration: checkedPoints[idx] ? 'line-through' : 'none',
                  }}><MathRenderer text={point} /></div>
                </div>
              ))}
            </div>

            {checkedCount === totalPoints && totalPoints > 0 && (
              <div style={{
                marginTop: '1rem', padding: '0.6rem', borderRadius: '8px',
                background: 'rgba(16,185,129,0.1)',
                textAlign: 'center', fontSize: '0.8rem', color: '#10b981',
              }}>
                All points reviewed — ready for the quiz!
              </div>
            )}
          </div>

          {/* AI Illustration generator */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
              <Sparkles size={16} color="var(--accent-color)" />
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-color)' }}>AI Illustration</p>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: '0.9rem' }}>
              Describe the diagram you want — or use the auto-generated prompt.
            </p>

            {/* Prompt textarea */}
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. Labelled diagram showing how shadows are formed by light sources..."
              style={{
                width: '100%', padding: '9px 11px', borderRadius: '9px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#e2e8f0', fontFamily: 'var(--font-body)',
                fontSize: '0.78rem', lineHeight: 1.55, resize: 'vertical',
                outline: 'none', transition: 'border-color 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = '#6366f1'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />

            {/* Generate button */}
            <button
              onClick={handleGenerateAI}
              disabled={isGeneratingAI || !aiPrompt.trim()}
              style={{
                width: '100%', marginTop: '0.65rem', padding: '9px',
                borderRadius: '9px', border: 'none',
                cursor: isGeneratingAI || !aiPrompt.trim() ? 'not-allowed' : 'pointer',
                background: isGeneratingAI
                  ? 'rgba(99,102,241,0.3)'
                  : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff', fontFamily: 'var(--font-body)',
                fontSize: '0.82rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                boxShadow: isGeneratingAI ? 'none' : '0 0 16px rgba(99,102,241,0.35)',
                transition: 'all 0.2s',
              }}
            >
              {isGeneratingAI ? (
                <>
                  <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                  Generating… (~15s)
                </>
              ) : (
                <><Send size={13} /> Generate Diagram</>
              )}
            </button>

            {/* Error */}
            {aiError && (
              <p style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.6rem', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>
                {aiError}
              </p>
            )}

            {/* Generated image */}
            {aiImageUrl && !isGeneratingAI && (
              <div style={{ marginTop: '0.9rem', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(99,102,241,0.25)' }}>
                <div style={{ position: 'relative', cursor: 'zoom-in' }} onClick={() => setAiLightbox(true)}>
                  <img
                    src={aiImageUrl}
                    alt="AI-generated diagram"
                    style={{ width: '100%', display: 'block', background: '#111' }}
                  />
                  <div style={{
                    position: 'absolute', top: '8px', right: '8px',
                    background: 'rgba(0,0,0,0.55)', borderRadius: '6px', padding: '4px 6px',
                    display: 'flex', alignItems: 'center', gap: '3px',
                    color: '#fff', fontSize: '0.68rem', fontFamily: 'var(--font-body)',
                    backdropFilter: 'blur(4px)',
                  }}>
                    <Maximize2 size={11} /> Enlarge
                  </div>
                </div>
                <div style={{ background: 'rgba(10,10,20,0.9)', padding: '0.45rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                    AI-generated · Pollinations.ai
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={handleDownloadAI}
                      title="Download image"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px', padding: 0, fontSize: '0.7rem', fontFamily: 'var(--font-body)' }}
                    >
                      <Download size={11} /> Save
                    </button>
                    <button
                      onClick={handleGenerateAI}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color)', fontSize: '0.7rem', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
                    >
                      <RefreshCw size={11} /> Regenerate
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Read time</span>
              <span style={{ color: 'var(--text-color)', fontWeight: 600 }}>{minutes} min</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Paragraphs</span>
              <span style={{ color: 'var(--text-color)', fontWeight: 600 }}>{paragraphs.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Figures</span>
              <span style={{ color: pdfImages.length > 0 ? '#34d399' : 'var(--text-muted)', fontWeight: 600 }}>
                {pdfImages.length > 0 ? pdfImages.length : 'None'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Progress</span>
              <span style={{ color: checkedCount === totalPoints && totalPoints > 0 ? '#10b981' : 'var(--accent-color)', fontWeight: 600 }}>
                {totalPoints > 0 ? Math.round((checkedCount / totalPoints) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <Chatbot
        userContext={{ current_topic: lesson.title, level: 'intermediate', weak_areas: [] }}
        chapterId={chapterId}
        userId={user?.id ?? null}
        materialId={materialId}
      />

      {/* ── AI Illustration Lightbox ── */}
      {aiLightbox && aiImageUrl && (
        <div
          onClick={() => setAiLightbox(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setAiLightbox(false)}
            style={{
              position: 'absolute', top: '1.25rem', right: '1.25rem',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '50%', width: '40px', height: '40px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff', backdropFilter: 'blur(4px)',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            <X size={18} />
          </button>

          {/* Image container — stop click from bubbling to overlay */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 'min(92vw, 1100px)', maxHeight: '90vh',
              borderRadius: '14px', overflow: 'hidden',
              boxShadow: '0 0 60px rgba(99,102,241,0.25), 0 25px 60px rgba(0,0,0,0.7)',
              border: '1px solid rgba(99,102,241,0.3)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <img
              src={aiImageUrl}
              alt="AI-generated diagram"
              style={{ width: '100%', display: 'block', maxHeight: 'calc(90vh - 52px)', objectFit: 'contain', background: '#0a0a14' }}
            />
            <div style={{
              background: 'rgba(10,10,20,0.97)', padding: '0.6rem 1rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderTop: '1px solid rgba(99,102,241,0.2)',
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                AI-generated · Pollinations.ai
              </span>
              <button
                onClick={handleDownloadAI}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px',
                  background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)',
                  borderRadius: '8px', cursor: 'pointer', color: '#34d399',
                  fontSize: '0.8rem', fontFamily: 'var(--font-body)', fontWeight: 600,
                }}
              >
                <Download size={14} /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonView;
