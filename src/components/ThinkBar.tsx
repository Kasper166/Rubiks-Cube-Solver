/**
 * ThinkBar — The 20-second "Wow Factor" solving orchestration UI.
 * 
 * Displays a cinematic progress sequence across 3 phases:
 *   Phase 1: Symmetry validation with animated checkmarks
 *   Phase 2: Parallel Kociemba optimization with live counter
 *   Phase 3: Ghost solve preview animation
 */

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Zap, 
  Ghost, 
  Check, 
  X as XIcon, 
  ChevronRight,
  Cpu 
} from 'lucide-react';
import { orchestrateThinkBar, type ThinkBarProgress } from '../engine/ThinkBarOrchestrator';
import { Haptic } from '../services/HapticService';
import type { ThreeCube } from '../engine/ThreeCube';
import type { CubeState } from '../lib/cubeUtils';

interface ThinkBarProps {
  cubeState: CubeState;
  threeCube: ThreeCube | null;
  onComplete: (solution: string[]) => void;
  onError: (message: string) => void;
}

const PHASE_CONFIG = [
  { icon: Shield, label: 'Symmetry Validator', color: '#8b5cf6', bg: 'bg-violet-500/10' },
  { icon: Zap,    label: 'Path Optimization',  color: '#3b82f6', bg: 'bg-blue-500/10' },
  { icon: Ghost,  label: 'Ghost Solve',        color: '#06b6d4', bg: 'bg-cyan-500/10' },
];

export default function ThinkBar({ cubeState, threeCube, onComplete, onError }: ThinkBarProps) {
  const [progress, setProgress] = useState<ThinkBarProgress>({
    phase: 1,
    phaseLabel: 'Initializing...',
    progress: 0,
    detail: 'Preparing validation engine...',
  });
  const [isRunning, setIsRunning] = useState(true);
  const lastPhase = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const result = await orchestrateThinkBar(
        cubeState,
        threeCube,
        (prog) => {
          if (cancelled) return;
          setProgress(prog);

          // Haptic feedback on phase transition
          if (prog.phase !== lastPhase.current) {
            lastPhase.current = prog.phase;
            Haptic.phaseTransition();
          }
        },
        8 // num solver orientations
      );

      if (cancelled) return;
      setIsRunning(false);

      if (!result.isValid) {
        Haptic.error();
        onError('Cube state validation failed.');
      } else if (result.solution.length === 0) {
        Haptic.error();
        onError('Could not find a solution. Please verify the cube state.');
      } else {
        Haptic.success();
        onComplete(result.solution);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [cubeState, threeCube, onComplete, onError]);

  const currentPhaseConfig = PHASE_CONFIG[progress.phase - 1] || PHASE_CONFIG[0];
  const PhaseIcon = currentPhaseConfig.icon;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      {/* Phase Indicator Steps */}
      <div className="flex items-center justify-center gap-3">
        {PHASE_CONFIG.map((phase, i) => {
          const Icon = phase.icon;
          const isActive = progress.phase === i + 1;
          const isDone = progress.phase > i + 1;
          return (
            <React.Fragment key={i}>
              <motion.div
                className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-500 ${
                  isActive
                    ? 'border-white/30 bg-white/10 scale-105 shadow-lg'
                    : isDone
                    ? 'border-white/10 bg-white/5 opacity-60'
                    : 'border-white/5 bg-white/[0.02] opacity-30'
                }`}
                animate={{ scale: isActive ? 1.05 : 1 }}
              >
                {isDone ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Icon className="w-4 h-4" style={{ color: isActive ? phase.color : '#71717a' }} />
                )}
                <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-zinc-500'}`}>
                  {phase.label}
                </span>
              </motion.div>
              {i < 2 && (
                <ChevronRight className={`w-4 h-4 ${progress.phase > i + 1 ? 'text-white/30' : 'text-white/10'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Main Progress Card */}
      <motion.div
        className="glass-card relative overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Animated glow border */}
        <div
          className="absolute inset-0 rounded-3xl opacity-20 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, ${currentPhaseConfig.color}22, transparent 60%)`,
          }}
        />

        <div className="relative z-10 space-y-6">
          {/* Phase icon + label */}
          <div className="flex items-center gap-4">
            <motion.div
              key={progress.phase}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: `${currentPhaseConfig.color}20` }}
            >
              <PhaseIcon className="w-7 h-7" style={{ color: currentPhaseConfig.color }} />
            </motion.div>
            <div>
              <h3 className="text-xl font-heading font-extrabold tracking-tight">
                {progress.phaseLabel}
              </h3>
              <p className="text-sm text-zinc-400">{progress.detail}</p>
            </div>
            <div className="ml-auto text-right">
              <span className="text-2xl font-mono font-bold" style={{ color: currentPhaseConfig.color }}>
                {Math.round(progress.progress * 100)}%
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${currentPhaseConfig.color}, ${currentPhaseConfig.color}aa)`,
                boxShadow: `0 0 20px ${currentPhaseConfig.color}40`,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${progress.progress * 100}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>

          {/* Phase-specific content */}
          <AnimatePresence mode="wait">
            {progress.phase === 1 && progress.checks && (
              <motion.div
                key="checks"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-2 gap-2"
              >
                {progress.checks.map((check, i) => (
                  <motion.div
                    key={check.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/5"
                  >
                    {check.passed ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XIcon className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span className="text-xs font-medium text-zinc-300">{check.name}</span>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {progress.phase === 2 && (
              <motion.div
                key="solver"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <Cpu className="w-5 h-5 text-blue-400 animate-pulse" />
                  <div>
                    <p className="text-sm font-bold">
                      {progress.orientationsTested ?? 0} / {progress.totalOrientations ?? '...'} orientations
                    </p>
                    <p className="text-xs text-zinc-500">
                      Running {Math.min(4, navigator.hardwareConcurrency || 2)} parallel workers
                    </p>
                  </div>
                </div>
                {progress.bestMoveCount !== undefined && (
                  <div className="text-right">
                    <p className="text-2xl font-mono font-bold text-white">{progress.bestMoveCount}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Best Moves</p>
                  </div>
                )}
              </motion.div>
            )}

            {progress.phase === 3 && (
              <motion.div
                key="ghost"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-2"
              >
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">
                  Ghost Solve Preview — 5× Speed
                </p>
                <div className="flex justify-center gap-1">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-6 rounded-full"
                      animate={{
                        backgroundColor: i / 20 < progress.progress ? '#06b6d4' : '#27272a',
                        scaleY: i / 20 < progress.progress ? 1.2 : 0.6,
                      }}
                      transition={{ duration: 0.2 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
