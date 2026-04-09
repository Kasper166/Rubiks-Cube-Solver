/**
 * Verifier — Phase 2: Review, validate & manually correct the scanned cube state.
 *
 * Layout:
 *   Left:   Validation results + piece-count dashboard
 *   Center: Interactive Three.js 3D cube
 *   Right:  Color palette + per-face 2D editor (CanvasOverlay)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  AlertCircle,
  Palette,
  RotateCcw,
  ArrowRight,
  Edit3,
  Box,
  AlertTriangle,
} from 'lucide-react';
import {
  CubeState,
  CubeColor,
  COLOR_MAP,
  validateCubeState,
  ValidationResult,
  FACE_LABELS,
  FACE_ORDER,
  FaceName,
} from '../lib/cubeUtils';
import { Haptic } from '../services/HapticService';
import CubeRenderer from './CubeRenderer';

interface VerifierProps {
  initialState: CubeState;
  onConfirm: (state: CubeState) => void;
  onBack: () => void;
}

const ALL_COLORS: CubeColor[] = ['white', 'red', 'green', 'yellow', 'orange', 'blue'];

export default function Verifier({ initialState, onConfirm, onBack }: VerifierProps) {
  const [state, setState] = useState<CubeState>(() => JSON.parse(JSON.stringify(initialState)));
  const [selectedColor, setSelectedColor] = useState<CubeColor>('white');
  const [isEditing, setIsEditing] = useState(false);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: false, errors: [] });
  const [editingFace, setEditingFace] = useState<FaceName>('U');

  // Run validation on every state change
  useEffect(() => {
    const result = validateCubeState(state);
    setValidation(result);
  }, [state]);

  // Derive hex colors for 3D renderer
  const cubeColors = useMemo(() => {
    const result: Record<string, (string | null)[][]> = {};
    for (const face of FACE_ORDER) {
      result[face] = state[face].map((row: CubeColor[]) =>
        row.map((c: CubeColor) => COLOR_MAP[c] ?? null)
      );
    }
    return result;
  }, [state]);

  const handleStickerClick = (face: string, stickerIndex: number) => {
    if (!isEditing) return;
    Haptic.light();
    const r = Math.floor(stickerIndex / 3);
    const c = stickerIndex % 3;

    const newState = JSON.parse(JSON.stringify(state));
    newState[face][r][c] = selectedColor;
    setState(newState);
  };

  const handleConfirm = () => {
    Haptic.success();
    onConfirm(state);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-6rem)] p-6 max-w-7xl mx-auto gap-8">
      {/* ─── Header ──────────────────────────────── */}
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-heading font-extrabold tracking-tight">Review State</h2>
          <p className="text-zinc-400">Validate and fine-tune your cube's digital twin</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onBack} className="btn-secondary flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Rescan
          </button>
          <button
            disabled={!validation.isValid}
            onClick={handleConfirm}
            className="btn-primary flex items-center gap-2 bg-white text-black"
          >
            Solve Cube <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ─── 3-Column Layout ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        {/* Left Panel: Validation & Piece Count */}
        <aside className="lg:col-span-3 space-y-6">
          {/* Validation */}
          <section className="glass-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="font-bold">Validation</h3>
            </div>
            {validation.isValid ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm flex items-start gap-3">
                <Check className="w-5 h-5 shrink-0 mt-0.5" />
                <p>Everything looks perfect! Ready for the solver.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {validation.errors.map((error, i) => (
                  <div
                    key={i}
                    className="p-3 bg-red-400/10 border border-red-400/20 rounded-xl text-red-400 text-xs flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Piece Count */}
          <section className="glass-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <Box className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold">Piece Count</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_COLORS.map(color => {
                const count = Object.values(state).flat(2).filter(c => c === color).length;
                return (
                  <div
                    key={color}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 text-xs"
                  >
                    <div
                      className="w-3 h-3 rounded-full shadow-inner"
                      style={{ backgroundColor: COLOR_MAP[color] }}
                    />
                    <span className={count === 9 ? 'text-zinc-400' : 'text-amber-400 font-bold'}>
                      {count}/9
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>

        {/* Center Panel: 3D Cube */}
        <main className="lg:col-span-6 relative group">
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-[3rem] -z-10" />
          <div className="h-full min-h-[500px] flex items-center justify-center relative">
            <CubeRenderer colors={cubeColors} autoRotate={!isEditing} />

            {/* Bottom control bar */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 glass rounded-full shadow-2xl">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                Interactive Review
              </p>
              <div className="w-px h-4 bg-white/10" />
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-2 text-sm font-bold transition-all px-4 py-2 rounded-xl ${
                  isEditing ? 'bg-white text-black scale-105' : 'hover:text-white'
                }`}
              >
                <Edit3 className="w-4 h-4" /> {isEditing ? 'Done' : 'Manual Edit'}
              </button>
            </div>
          </div>
        </main>

        {/* Right Panel: Editor or Info */}
        <aside className="lg:col-span-3 space-y-6">
          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.section
                key="edit-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass-card h-full flex flex-col"
              >
                {/* Color Palette */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <Palette className="w-5 h-5 text-amber-400" />
                  </div>
                  <h3 className="font-bold">Palette</h3>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {ALL_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                        selectedColor === color
                          ? 'bg-white/10 border-white/40 ring-1 ring-white/20'
                          : 'border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div
                        className="w-5 h-5 rounded-md shadow-lg"
                        style={{ backgroundColor: COLOR_MAP[color] }}
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wider">{color}</span>
                    </button>
                  ))}
                </div>

                {/* Face Tabs */}
                <div className="flex gap-1 mb-4 overflow-x-auto">
                  {FACE_ORDER.map(face => (
                    <button
                      key={face}
                      onClick={() => setEditingFace(face)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        editingFace === face
                          ? 'bg-white text-black'
                          : 'bg-white/5 text-zinc-500 hover:bg-white/10'
                      }`}
                    >
                      {face}
                    </button>
                  ))}
                </div>

                {/* 2D Face Editor */}
                <p className="text-[10px] text-zinc-500 font-bold uppercase text-center mb-3 tracking-widest">
                  {FACE_LABELS[editingFace]}
                </p>
                <div className="flex justify-center mb-4">
                  <div className="grid grid-cols-3 gap-1.5">
                    {state[editingFace].flat().map((color: CubeColor, i: number) => (
                      <button
                        key={i}
                        onClick={() => handleStickerClick(editingFace, i)}
                        style={{ backgroundColor: COLOR_MAP[color] }}
                        className="w-10 h-10 rounded-lg border border-black/20 shadow-inner active:scale-90 transition-transform hover:ring-2 hover:ring-white/30"
                      />
                    ))}
                  </div>
                </div>

                {/* All faces mini-view */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6 pb-4 border-t border-white/5 pt-4">
                  {FACE_ORDER.filter(f => f !== editingFace).map(face => (
                    <div key={face} className="space-y-2">
                      <button
                        onClick={() => setEditingFace(face)}
                        className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest text-center w-full hover:text-zinc-300 transition-colors"
                      >
                        {FACE_LABELS[face]} →
                      </button>
                      <div className="flex justify-center">
                        <div className="grid grid-cols-3 gap-0.5">
                          {state[face].flat().map((color: CubeColor, i: number) => (
                            <div
                              key={i}
                              style={{ backgroundColor: COLOR_MAP[color] }}
                              className="w-5 h-5 rounded-sm border border-black/20"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.section>
            ) : (
              <motion.section
                key="info-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass-card h-full flex flex-col"
              >
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-6">
                  <div className="w-16 h-16 rounded-[2rem] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Box className="w-8 h-8 text-blue-400" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-heading font-extrabold">
                      {validation.isValid ? 'State Verified' : 'Needs Correction'}
                    </h3>
                    <p className="text-sm text-zinc-400">
                      {validation.isValid
                        ? 'The 3D model represents your scanned cube. Ready to solve!'
                        : `Found ${validation.errors.length} issue${validation.errors.length > 1 ? 's' : ''}. Use Edit Mode to fix.`}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs font-bold text-white/40 hover:text-white transition-colors underline underline-offset-4"
                  >
                    Enter manual correction
                  </button>
                </div>

                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 text-center">
                    Reference
                  </p>
                  <p className="text-xs text-center text-zinc-400">
                    Front Center should be <span className="font-bold text-emerald-400">Green</span>
                  </p>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}
