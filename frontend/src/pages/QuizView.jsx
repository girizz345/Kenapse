import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Lightbulb, Brain, BookOpen, Target, RefreshCw } from 'lucide-react';
import { getQuiz, generateQuiz, submitFeedback, getChapters, updateChapterStatus } from '../services/api';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Chatbot from '../components/Chatbot';

const QuizView = () => {
  const { materialId, chapterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState(null);
  const [chapterMeta, setChapterMeta] = useState({ topic: 'General Knowledge', level: 'intermediate' });
  const [isLoading, setIsLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [returningToPath, setReturningToPath] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const fetchQuizData = async () => {
      try {
        const data = await getQuiz(chapterId);
        setQuiz(data);
      } catch {
        try {
          let chapters;
          try {
            chapters = await getChapters(materialId);
          } catch {
            const { data } = await supabase
              .from('chapters')
              .select('*')
              .eq('material_id', materialId)
              .order('order_index');
            chapters = data || [];
          }
          const chapter = chapters.find(c => String(c.id) === String(chapterId));
          const topic = chapter?.topics?.[0] || chapter?.title || 'General Knowledge';
          const level = 'intermediate';
          setChapterMeta({ topic, level });
          const generated = await generateQuiz(topic, level, chapterId, user?.id ?? null);
          setQuiz(generated);
        } catch (err) {
          console.error(err);
          alert('Failed to load quiz. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuizData();
  }, [chapterId, materialId]);

  const handleOptionSelect = (option) => {
    if (isAnswered) return;
    setSelectedOption(option);
  };

  const handleCheckAnswer = () => {
    if (!selectedOption) return;
    setIsAnswered(true);
    const q = quiz.questions[currentQuestion];
    if (selectedOption === q.answer) {
      setScore(s => s + 1);
    } else {
      setWrongAnswers(prev => [...prev, {
        question: q.question,
        selected: selectedOption,
        correct: q.answer,
      }]);
    }
  };

  const handleNext = async () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(c => c + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setShowHint(false);
    } else {
      const isLastCorrect = selectedOption === quiz.questions[currentQuestion].answer;
      const finalScore = score + (isLastCorrect ? 1 : 0);
      const finalWrong = isLastCorrect ? wrongAnswers : [...wrongAnswers, {
        question: quiz.questions[currentQuestion].question,
        selected: selectedOption,
        correct: quiz.questions[currentQuestion].answer,
      }];
      const finalScorePercentage = (finalScore / quiz.questions.length) * 100;

      setIsSaving(true);
      try {
        let chapters;
        try {
          chapters = await getChapters(materialId);
        } catch {
          const { data } = await supabase
            .from('chapters')
            .select('*')
            .eq('material_id', materialId)
            .order('order_index');
          chapters = data || [];
        }

        const currentIdx = chapters.findIndex(c => String(c.id) === String(chapterId));

        if (currentIdx !== -1) {
          const setStatus = async (id, status) => {
            try {
              await updateChapterStatus(id, status);
            } catch {
              const { error } = await supabase.from('chapters').update({ status }).eq('id', id);
              if (error) console.error('Supabase chapter update failed:', error);
            }
          };
          await setStatus(chapterId, 'completed');
          if (currentIdx + 1 < chapters.length) {
            await setStatus(chapters[currentIdx + 1].id, 'active');
          }
          sessionStorage.setItem('animateImpulseFrom', currentIdx.toString());
        }

        const existing = JSON.parse(localStorage.getItem('quiz_scores') || '[]');
        existing.push(Math.round(finalScorePercentage));
        localStorage.setItem('quiz_scores', JSON.stringify(existing));

        try {
          const result = await submitFeedback(
            chapterId,
            finalScorePercentage,
            1,
            chapterMeta.topic,
            chapterMeta.level,
            finalWrong,
            user?.id ?? null,
          );
          setFeedback(result);
        } catch {
          // feedback is non-critical
        }
      } catch (e) {
        console.error("Failed to update progress", e);
      } finally {
        setIsSaving(false);
        setIsFinished(true);
      }
    }
  };

  if (isLoading) return (
    <div className="page-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
      Generating your quiz...
    </div>
  );
  if (!quiz) return null;

  if (isFinished) {
    const displayScore = Math.round((score / quiz.questions.length) * 100);
    const analysis = feedback?.analysis;

    return (
      <div className="page-container" style={{ alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="glass-panel animate-fade-in" style={{ textAlign: 'center', padding: '3rem', maxWidth: '560px', width: '100%' }}>
          <h2 style={{ marginBottom: '1rem' }}>Quiz Completed!</h2>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--accent-color)', marginBottom: '0.5rem' }}>
            {displayScore}%
          </div>
          <p style={{ marginBottom: '2rem', color: 'var(--text-muted)' }}>
            You scored {score} out of {quiz.questions.length}.
          </p>

          {/* Agent Analysis Panel */}
          {analysis && (
            <div style={{ textAlign: 'left', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Encouragement */}
              {analysis.encouragement && (
                <div style={{
                  background: 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: '10px',
                  padding: '1rem 1.2rem',
                  display: 'flex', gap: '10px', alignItems: 'flex-start',
                }}>
                  <Brain size={18} color="#818cf8" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{analysis.encouragement}</p>
                </div>
              )}

              {/* Remediation */}
              {analysis.remediation && wrongAnswers.length > 0 && (
                <div style={{
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: '10px',
                  padding: '1rem 1.2rem',
                  display: 'flex', gap: '10px', alignItems: 'flex-start',
                }}>
                  <BookOpen size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f59e0b', marginBottom: '4px' }}>
                      Tutor's Note
                    </p>
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{analysis.remediation}</p>
                  </div>
                </div>
              )}

              {/* Focus topics */}
              {analysis.focus_topics?.length > 0 && (
                <div style={{
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  borderRadius: '10px',
                  padding: '1rem 1.2rem',
                  display: 'flex', gap: '10px', alignItems: 'flex-start',
                }}>
                  <Target size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#10b981', marginBottom: '6px' }}>
                      Review before continuing
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {analysis.focus_topics.map((t, i) => (
                        <span key={i} style={{
                          background: 'rgba(16,185,129,0.12)',
                          border: '1px solid rgba(16,185,129,0.3)',
                          borderRadius: '20px',
                          padding: '3px 10px',
                          fontSize: '0.8rem',
                        }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              disabled={returningToPath}
              onClick={() => {
                setReturningToPath(true);
                setTimeout(() => navigate(`/course/${materialId}`), 500);
              }}
            >
              {returningToPath ? 'Returning...' : 'Return to Path'}
            </button>
            <button
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px', padding: '10px 20px',
                cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem',
              }}
              onClick={() => {
                setIsFinished(false);
                setCurrentQuestion(0);
                setScore(0);
                setWrongAnswers([]);
                setSelectedOption(null);
                setIsAnswered(false);
                setShowHint(false);
                setFeedback(null);
              }}
            >
              <RefreshCw size={15} /> Retry Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = quiz.questions[currentQuestion];

  return (
    <div className="page-container" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
        <span>Question {currentQuestion + 1} of {quiz.questions.length}</span>
        <span>Score: {score}</span>
      </div>

      <div className="glass-panel animate-fade-in" style={{ padding: '3rem' }}>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '2rem', lineHeight: '1.6' }}>{q.question}</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {q.options.map((opt, idx) => {
            let bgColor = 'rgba(255,255,255,0.05)';
            let borderColor = 'var(--glass-border)';

            if (isAnswered) {
              if (opt === q.answer) {
                bgColor = 'rgba(16, 185, 129, 0.2)';
                borderColor = '#10b981';
              } else if (opt === selectedOption) {
                bgColor = 'rgba(239, 68, 68, 0.2)';
                borderColor = '#ef4444';
              }
            } else if (opt === selectedOption) {
              borderColor = 'var(--accent-color)';
              bgColor = 'rgba(99, 102, 241, 0.1)';
            }

            return (
              <div
                key={idx}
                onClick={() => handleOptionSelect(opt)}
                style={{
                  padding: '1rem 1.5rem',
                  borderRadius: '12px',
                  background: bgColor,
                  border: `1px solid ${borderColor}`,
                  cursor: isAnswered ? 'default' : 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <span>{opt}</span>
                {isAnswered && opt === q.answer && <CheckCircle color="#10b981" size={20} />}
                {isAnswered && opt === selectedOption && opt !== q.answer && <XCircle color="#ef4444" size={20} />}
              </div>
            );
          })}
        </div>

        {/* Hint */}
        {!isAnswered && (
          <div style={{ marginTop: '1.5rem' }}>
            {showHint ? (
              <div style={{
                display: 'flex', gap: '10px', alignItems: 'flex-start',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: '10px', padding: '0.9rem 1.1rem',
              }}>
                <Lightbulb size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
                  {q.hint || 'Think carefully about each option and eliminate the ones that are clearly wrong.'}
                </p>
              </div>
            ) : (
              <button
                onClick={() => setShowHint(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: 'transparent', border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: '8px', padding: '6px 14px', cursor: 'pointer',
                  color: '#f59e0b', fontSize: '0.82rem',
                }}
              >
                <Lightbulb size={14} /> Get Hint
              </button>
            )}
          </div>
        )}

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
          {!isAnswered ? (
            <button className="btn btn-primary" onClick={handleCheckAnswer} disabled={!selectedOption}>
              Check Answer
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleNext} disabled={isSaving}>
              {isSaving ? 'Saving...' : currentQuestion < quiz.questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
            </button>
          )}
        </div>
      </div>

      <Chatbot
        userContext={{
          current_topic: chapterMeta.topic,
          level: chapterMeta.level,
          weak_areas: isAnswered && selectedOption !== q.answer ? [q.question] : [],
        }}
        chapterId={chapterId}
      />
    </div>
  );
};

export default QuizView;
