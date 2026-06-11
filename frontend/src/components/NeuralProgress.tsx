import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Lock, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Chapter = {
  chapter_id: string | number;
  title: string;
  objective?: string;
  status?: 'completed' | 'active' | 'locked' | string;
};

interface NeuralProgressProps {
  chapters: Chapter[];
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getPosition = (index: number, total: number) => {
  const presetPositions = [
    { x: 20, y: 18 },
    { x: 80, y: 14 },
    { x: 14, y: 42 },
    { x: 86, y: 40 },
    { x: 50, y: 58 },
    { x: 22, y: 78 },
    { x: 78, y: 82 },
    { x: 40, y: 28 },
    { x: 60, y: 72 },
  ];

  if (total <= presetPositions.length) {
    return presetPositions[index] ?? { x: 50, y: 18 + index * 12 };
  }

  const column = index % 3;
  const row = Math.floor(index / 3);
  const xBase = [18, 50, 82][column];
  const yBase = 18 + row * 18;
  const xOffset = (column - 1) * (row % 2 === 0 ? 5 : -5);
  return {
    x: clamp(xBase + xOffset, 12, 88),
    y: clamp(yBase + (index % 2 === 0 ? 0 : 4), 12, 92),
  };
};

const createPath = (
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  width: number,
  height: number
) => {
  const startX = (p1.x / 100) * width;
  const startY = (p1.y / 100) * height;
  const endX = (p2.x / 100) * width;
  const endY = (p2.y / 100) * height;
  const controlY = Math.min(height, Math.max(startY, endY) - 30);
  const controlX = (startX + endX) / 2;

  return `M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}`;
};

const NeuralProgress: React.FC<NeuralProgressProps> = ({ chapters }) => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 720 });
  const [impulsePath, setImpulsePath] = useState<{ from: number; to: number } | null>(null);

  const normalizedChapters = useMemo(
    () =>
      chapters.map((chapter, index) => ({
        ...chapter,
        status: chapter.status ?? (index === 0 ? 'active' : 'locked'),
      })),
    [chapters]
  );

  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth;
      const height = Math.max(720, chapters.length * 120 + 120);
      setDimensions({ width, height });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [chapters.length]);

  useEffect(() => {
    const animateFrom = sessionStorage.getItem('animateImpulseFrom');
    if (!animateFrom) return;

    const fromIdx = Number(animateFrom);
    if (!Number.isNaN(fromIdx) && fromIdx + 1 < chapters.length) {
      setImpulsePath({ from: fromIdx, to: fromIdx + 1 });
    }

    sessionStorage.removeItem('animateImpulseFrom');
  }, [chapters.length]);

  if (!chapters || chapters.length === 0) {
    return (
      <div className="glass-panel" style={{ minHeight: '320px' }}>
        <h3>No neurons to display yet.</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          Complete course generation to unlock the neural roadmap.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full" style={{ minHeight: `${dimensions.height}px`, marginTop: '2rem' }}>
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 1000 ${dimensions.height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ pointerEvents: 'none' }}
      >
        {normalizedChapters.map((chapter, index) => {
          if (index === normalizedChapters.length - 1) return null;

          const current = chapter;
          const next = normalizedChapters[index + 1];
          const p1 = getPosition(index, normalizedChapters.length);
          const p2 = getPosition(index + 1, normalizedChapters.length);
          const path = createPath(p1, p2, 1000, dimensions.height);
          const isLit = current.status === 'completed' || next.status === 'active';
          const isAnimating = impulsePath?.from === index;

          return (
            <g key={`connector-${current.chapter_id}`}> 
              <path
                d={path}
                fill="none"
                stroke={isLit ? 'var(--accent-color)' : 'rgba(255,255,255,0.16)'}
                strokeWidth={isLit ? 4 : 2}
                strokeOpacity={isLit ? 0.65 : 0.22}
                strokeLinecap="round"
              />

              {isAnimating && (
                <motion.path
                  d={path}
                  fill="none"
                  stroke="rgba(255,255,255,0.95)"
                  strokeWidth={8}
                  strokeLinecap="round"
                  style={{ filter: 'drop-shadow(0 0 18px rgba(255,255,255,0.7))' }}
                  initial={{ pathLength: 0, opacity: 1 }}
                  animate={{ pathLength: 1, opacity: [1, 1, 0] }}
                  transition={{ duration: 1.4, ease: 'easeInOut', times: [0, 0.85, 1] }}
                  onAnimationComplete={() => setImpulsePath(null)}
                />
              )}
            </g>
          );
        })}
      </svg>

      {normalizedChapters.map((chapter, index) => {
        const status = chapter.status as 'completed' | 'active' | 'locked';
        const pos = getPosition(index, normalizedChapters.length);
        const isCompleted = status === 'completed';
        const isActive = status === 'active';
        const isLocked = status === 'locked';

        const nodeBackground = isCompleted ? 'var(--accent-color)' : 'rgba(15, 23, 42, 0.95)';
        const nodeBorder = isCompleted ? 'rgba(99, 102, 241, 0.9)' : isActive ? 'rgba(99, 102, 241, 0.8)' : 'rgba(255,255,255,0.12)';
        const nodeShadow = isCompleted
          ? '0 0 30px rgba(99, 102, 241, 0.45)'
          : isActive
          ? '0 0 22px rgba(99, 102, 241, 0.25)'
          : 'none';
        const textAlign = pos.x < 50 ? 'right' : 'left';

        return (
          <div
            key={chapter.chapter_id}
            style={{
              position: 'absolute',
              top: `${pos.y}%`,
              left: `${pos.x}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 2,
              display: 'flex',
              flexDirection: pos.x < 50 ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: '18px',
              width: '88%',
              pointerEvents: 'none',
            }}
          >
            <motion.div
              className="neuron-node rounded-full border-4"
              whileHover={isLocked ? {} : { scale: 1.08 }}
              style={{
                width: '70px',
                height: '70px',
                borderRadius: '50%',
                background: nodeBackground,
                border: `4px solid ${nodeBorder}`,
                boxShadow: nodeShadow,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isLocked ? 0.45 : 1,
                pointerEvents: 'auto',
                cursor: isLocked ? 'default' : 'pointer',
              }}
              onClick={() => {
                if (!isLocked) {
                  navigate(`/lesson/${chapter.chapter_id}`);
                }
              }}
            >
              {isCompleted && <CheckCircle size={26} color="white" />}
              {isActive && !isCompleted && (
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                >
                  <Play size={26} color="white" fill="white" />
                </motion.div>
              )}
              {isLocked && !isCompleted && <Lock size={26} color="rgba(255,255,255,0.6)" />}
            </motion.div>

            <div
              className="glass-panel neural-node-card"
              style={{
                width: '100%',
                maxWidth: '420px',
                opacity: isLocked ? 0.65 : 1,
                textAlign,
                pointerEvents: 'auto',
              }}
            >
              <h3 style={{ marginBottom: '0.75rem', color: 'white' }}>{chapter.title}</h3>
              <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', minHeight: '46px' }}>{chapter.objective || 'Tap to open this lesson and explore its key outcome.'}</p>
              {!isLocked && (
                <button
                  className="btn btn-primary"
                  style={{ padding: '0.85rem 1.25rem', fontSize: '0.95rem' }}
                  onClick={() => navigate(`/lesson/${chapter.chapter_id}`)}
                >
                  {isCompleted ? 'Review Chapter' : 'Continue'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default NeuralProgress;
