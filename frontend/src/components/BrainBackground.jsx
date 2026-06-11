import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

const PALETTE = ['#9b5dff', '#00f0cc', '#ff44dd', '#4488ff'];

function generateNodes(count) {
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const r = i % 5 === 0 ? 0.6 + Math.random() * 0.3 : 0.82 + Math.random() * 0.18;

    let x = r * 2.6 * Math.sin(phi) * Math.cos(theta);
    let y = r * 1.9 * Math.cos(phi);
    let z = r * 2.1 * Math.sin(phi) * Math.sin(theta);

    // Sulci-like noise
    x += Math.sin(y * 2.8 + z) * 0.18;
    z += Math.cos(x * 2.1 + y) * 0.14;
    y += Math.sin(x * 1.5) * 0.1;

    nodes.push({ pos: [x, y, z], color: PALETTE[i % PALETTE.length], radius: 0.055 + Math.random() * 0.045 });
  }
  return nodes;
}

function buildConnections(nodes, threshold = 1.55, maxPerNode = 4) {
  const count = new Array(nodes.length).fill(0);
  const pairs = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (count[i] >= maxPerNode || count[j] >= maxPerNode) continue;
      const [ax, ay, az] = nodes[i].pos;
      const [bx, by, bz] = nodes[j].pos;
      if (Math.hypot(ax - bx, ay - by, az - bz) < threshold) {
        pairs.push([i, j]);
        count[i]++;
        count[j]++;
      }
    }
  }
  return pairs;
}

function BrainScene({ opacity }) {
  const groupRef = useRef();
  const nodeRefs = useRef([]);
  const lineMat = useRef();
  const pulsePhase = useRef(0);
  const clock = useRef(0);

  const nodes = useMemo(() => generateNodes(58), []);
  const connections = useMemo(() => buildConnections(nodes), [nodes]);

  const lineGeo = useMemo(() => {
    const pts = [];
    for (const [i, j] of connections) {
      pts.push(new THREE.Vector3(...nodes[i].pos));
      pts.push(new THREE.Vector3(...nodes[j].pos));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [nodes, connections]);

  // Listen to the global pulse event fired by CourseFlow on chapter completion
  useEffect(() => {
    const onPulse = () => { pulsePhase.current = 1; };
    window.addEventListener('brain-pulse', onPulse);
    return () => window.removeEventListener('brain-pulse', onPulse);
  }, []);

  useFrame((_, delta) => {
    clock.current += delta;

    if (groupRef.current) {
      groupRef.current.rotation.y = clock.current * 0.07;
      groupRef.current.rotation.x = Math.sin(clock.current * 0.04) * 0.08;
    }

    if (pulsePhase.current > 0) pulsePhase.current = Math.max(0, pulsePhase.current - delta * 0.75);
    const boost = pulsePhase.current > 0 ? 1 + Math.sin(pulsePhase.current * Math.PI) * 2.8 : 1;

    nodeRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      mesh.position.y = nodes[i].pos[1] + Math.sin(clock.current * 0.6 + i * 0.4) * 0.04;
      mesh.scale.setScalar(boost);
      if (mesh.material) mesh.material.emissiveIntensity = 1.3 * boost;
    });

    if (lineMat.current) {
      lineMat.current.opacity = (0.25 + pulsePhase.current * 0.5) * opacity;
    }
  });

  return (
    <group ref={groupRef}>
      <lineSegments geometry={lineGeo}>
        <lineBasicMaterial ref={lineMat} color="#8855ff" transparent opacity={0.25 * opacity} />
      </lineSegments>

      {nodes.map((node, i) => (
        <mesh key={i} position={node.pos} ref={el => { nodeRefs.current[i] = el; }}>
          <sphereGeometry args={[node.radius, 7, 7]} />
          <meshStandardMaterial
            color={node.color}
            emissive={node.color}
            emissiveIntensity={1.3}
            transparent
            opacity={opacity}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function CameraRig() {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useFrame(() => {
    camera.position.x += (mouse.current.x * 0.5 - camera.position.x) * 0.04;
    camera.position.y += (-mouse.current.y * 0.3 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/**
 * Drop-in global background replacement.
 * Renders a fixed full-screen 3D neon brain behind all app content.
 */
const BrainBackground = () => {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: -10,
      background: '#000005',
      pointerEvents: 'none',
    }}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 8.5], fov: 50 }}
        gl={{ antialias: false, alpha: false }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.1} />
        <pointLight position={[4, 4, 4]} intensity={0.5} color="#9b5dff" />
        <pointLight position={[-4, -3, -4]} intensity={0.35} color="#00f0cc" />

        <CameraRig />
        <BrainScene opacity={0.7} />

        <EffectComposer>
          <Bloom intensity={1.6} luminanceThreshold={0.05} luminanceSmoothing={0.85} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default BrainBackground;
