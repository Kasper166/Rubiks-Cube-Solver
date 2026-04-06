import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Scanner from './components/Scanner';
import Verifier from './components/Verifier';
import Solver from './components/Solver';
import { CubeState, INITIAL_CUBE_STATE } from './lib/cubeUtils';

type Phase = 'scan' | 'verify' | 'solve';

const PHASES: { id: Phase; label: string; emoji: string }[] = [
  { id: 'scan', label: 'Scan', emoji: '📷' },
  { id: 'verify', label: 'Verify', emoji: '✓' },
  { id: 'solve', label: 'Solve', emoji: '🧩' },
];

export default function App() {
  const [phase, setPhase] = useState<Phase>('scan');
  const [cubeState, setCubeState] = useState<CubeState>(INITIAL_CUBE_STATE);

  const handleScanComplete = (state: CubeState) => {
    setCubeState(state);
    setPhase('verify');
  };

  const handleVerifyConfirm = (state: CubeState) => {
    setCubeState(state);
    setPhase('solve');
  };

  const handleReset = () => {
    setPhase('scan');
    setCubeState(INITIAL_CUBE_STATE);
  };

  const currentPhaseIndex = PHASES.findIndex((p) => p.id === phase);

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-white selection:text-black overflow-x-hidden">
      {/* ─── Wizard Progress Bar ───────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 p-6 flex justify-center pointer-events-none">
        <div className="glass px-6 py-3 rounded-full flex items-center gap-8 pointer-events-auto">
          {PHASES.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3">
              <motion.div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                  i <= currentPhaseIndex
                    ? 'bg-white text-black scale-110 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                    : 'bg-zinc-800 text-zinc-500'
                }`}
                animate={{ scale: i === currentPhaseIndex ? 1.15 : i < currentPhaseIndex ? 1 : 0.9 }}
              >
                {i < currentPhaseIndex ? '✓' : i + 1}
              </motion.div>
              <span
                className={`text-sm font-semibold transition-all duration-500 ${
                  i <= currentPhaseIndex ? 'text-white' : 'text-zinc-600'
                }`}
              >
                {p.label}
              </span>
              {i < PHASES.length - 1 && (
                <div className={`w-8 h-[1px] ml-2 transition-all duration-500 ${
                  i < currentPhaseIndex ? 'bg-white/40' : 'bg-zinc-800'
                }`} />
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* ─── Phase Content ─────────────────────── */}
      <main className="relative pt-24 min-h-screen">
        <AnimatePresence mode="wait">
          {phase === 'scan' && (
            <motion.div
              key="scan"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <Scanner onComplete={handleScanComplete} />
            </motion.div>
          )}

          {phase === 'verify' && (
            <motion.div
              key="verify"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <Verifier
                initialState={cubeState}
                onConfirm={handleVerifyConfirm}
                onBack={() => setPhase('scan')}
              />
            </motion.div>
          )}

          {phase === 'solve' && (
            <motion.div
              key="solve"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <Solver cubeState={cubeState} onReset={handleReset} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ─── Footer Branding ───────────────────── */}
      <footer className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <p className="text-[10px] text-zinc-700 font-mono tracking-widest uppercase">
          Spectro-Cube • Parallel Processing Architecture
        </p>
      </footer>
    </div>
  );
}
