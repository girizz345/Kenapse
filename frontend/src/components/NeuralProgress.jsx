import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Lock, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const NeuralProgress = ({ chapters }) => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [impulsePath, setImpulsePath] = useState(null);

  // Generate node positions based on index (organic zig-zag)
  const getPosition = (index, total) => {
    // vertical spacing
    const ySpacing = 200;
    const yOffset = 100; // top padding
    const y = yOffset + index * ySpacing;
    
    // horizontal organic distribution
    // 0: center, 1: left, 2: right, 3: center-left, etc.
    const xPositions = [50, 25, 75, 30, 70, 20, 80, 40, 60];
    const x = xPositions[index % xPositions.length];
    
    return { x, y };
  };

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: Math.max(800, (chapters.length + 1) * 200) // enough height for all nodes
      });
    }

    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: Math.max(800, (chapters.length + 1) * 200)
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [chapters]);

  useEffect(() => {
    // Check if an impulse animation needs to be triggered
    const animateFrom = sessionStorage.getItem('animateImpulseFrom');
    if (animateFrom !== null && chapters.length > 0) {
      const fromIdx = parseInt(animateFrom, 10);
      if (!isNaN(fromIdx) && fromIdx + 1 < chapters.length) {
        setImpulsePath({
          from: fromIdx,
          to: fromIdx + 1
        });
      }
      sessionStorage.removeItem('animateImpulseFrom');
    }
  }, [chapters]);

  // Generate SVG path strings between nodes
  const createPath = (p1, p2, w) => {
    const startX = (p1.x / 100) * w;
    const startY = p1.y;
    const endX = (p2.x / 100) * w;
    const endY = p2.y;
    // create a smooth bezier curve
    const controlY = startY + (endY - startY) / 2;
    return `M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}`;
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', minHeight: `${dimensions.height}px`, margin: '2rem 0' }}>
      
      {/* SVG Canvas for connective paths */}
      <svg 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}
      >
        {chapters.map((chapter, index) => {
          if (index === chapters.length - 1) return null;
          const status = chapter.status || (index === 0 ? 'active' : 'locked');
          const isCompleted = status === 'completed';
          
          const p1 = getPosition(index, chapters.length);
          const p2 = getPosition(index + 1, chapters.length);
          const pathD = createPath(p1, p2, dimensions.width || 800);
          
          // Is this path the one being animated right now?
          const isAnimatingImpulse = impulsePath && impulsePath.from === index;
          
          return (
            <g key={`path-${index}`}>
              {/* Base Path */}
              <path 
                d={pathD}
                fill="none"
                stroke={isCompleted ? "var(--accent-color)" : "var(--glass-border)"}
                strokeWidth={isCompleted ? "4" : "2"}
                strokeOpacity={isCompleted ? "0.6" : "0.3"}
                strokeLinecap="round"
              />
              
              {/* Impulse Animation Path */}
              {isAnimatingImpulse && (
                <motion.path
                  d={pathD}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="6"
                  strokeLinecap="round"
                  style={{ filter: 'drop-shadow(0 0 10px #fff)' }}
                  initial={{ pathLength: 0, opacity: 1 }}
                  animate={{ pathLength: 1, opacity: [1, 1, 0] }}
                  transition={{ 
                    duration: 1.5, 
                    ease: "easeInOut",
                    times: [0, 0.8, 1] // Keep visible during travel, then fade out
                  }}
                  onAnimationComplete={() => setImpulsePath(null)} // reset
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Nodes (Neurons) */}
      {chapters.map((chapter, index) => {
        const status = chapter.status || (index === 0 ? 'active' : 'locked');
        const pos = getPosition(index, chapters.length);
        
        let bgColor = 'var(--bg-color)';
        let borderColor = 'var(--glass-border)';
        let glow = 'none';
        let opacity = 1;

        if (status === 'completed') {
          bgColor = 'var(--accent-color)';
          borderColor = '#4f46e5';
          glow = '0 0 15px rgba(79, 70, 229, 0.5)';
        } else if (status === 'active') {
          bgColor = 'var(--bg-color)';
          borderColor = '#4f46e5';
          glow = '0 0 20px var(--accent-glow)';
        } else {
          opacity = 0.5;
        }

        const isLeft = pos.x < 50;
        
        return (
          <div 
            key={chapter.chapter_id} 
            style={{ 
              position: 'absolute', 
              top: `${pos.y}px`, 
              left: `${pos.x}%`, 
              transform: 'translate(-50%, -50%)',
              zIndex: 1,
              display: 'flex',
              flexDirection: isLeft ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: '20px',
              width: '80%',
              pointerEvents: 'none' // Let clicks pass through empty areas
            }}
          >
            {/* The Node itself */}
            <motion.div 
              className="neuron-node"
              whileHover={status !== 'locked' ? { scale: 1.1 } : {}}
              style={{ 
                width: '60px', 
                height: '60px', 
                borderRadius: '50%', 
                background: bgColor, 
                border: `4px solid ${borderColor}`, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                boxShadow: glow,
                opacity,
                pointerEvents: 'auto',
                cursor: status !== 'locked' ? 'pointer' : 'default',
                flexShrink: 0
              }}
              onClick={() => {
                if (status !== 'locked') navigate(`/lesson/${chapter.material_id}/${chapter.id}`);
              }}
            >
              {status === 'completed' && <CheckCircle size={24} color="white" />}
              {status === 'active' && (
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Play size={24} color="white" fill="white" />
                </motion.div>
              )}
              {status === 'locked' && <Lock size={24} color="var(--text-muted)" />}
            </motion.div>

            {/* Content Box */}
            <div 
              className="glass-panel" 
              style={{ 
                padding: '1.5rem', 
                opacity, 
                pointerEvents: 'auto',
                textAlign: isLeft ? 'right' : 'left',
                flexGrow: 1,
                maxWidth: '400px'
              }}
            >
              <h3 style={{ marginBottom: '0.5rem' }}>{chapter.title}</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: status === 'active' ? '1rem' : '0' }}>
                {chapter.objective}
              </p>
              {status === 'active' && (
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                  onClick={() => navigate(`/lesson/${chapter.material_id}/${chapter.id}`)}
                >
                  Start Chapter
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
