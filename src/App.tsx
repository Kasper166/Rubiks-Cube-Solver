/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Scanner from './components/Scanner';
import Verifier from './components/Verifier';
import Solver from './components/Solver';
import { CubeState, INITIAL_CUBE_STATE } from './lib/cubeUtils';

type Phase = 'scan' | 'verify' | 'solve';

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

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-white selection:text-black">
      <AnimatePresence mode="wait">
        {phase === 'scan' && (
          <motion.div
            key="scan"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <Scanner onComplete={handleScanComplete} />
          </motion.div>
        )}

        {phase === 'verify' && (
          <motion.div
            key="verify"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <Solver cubeState={cubeState} onReset={handleReset} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global CSS for custom scrollbar */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}} />
    </div>
  );
}
