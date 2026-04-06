/**
 * CanvasOverlay — 2D Manual Override Interface
 * 
 * Renders a 3×3 grid overlay mapped 1:1 with the YOLO detection grid.
 * Implements "Tap-to-Correct" functionality for manual color assignment.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pipette } from 'lucide-react';

const COLOR_OPTIONS: { label: string; hex: string }[] = [
  { label: 'white',  hex: '#FFFFFF' },
  { label: 'red',    hex: '#B7121F' },
  { label: 'green',  hex: '#009B48' },
  { label: 'yellow', hex: '#FFD500' },
  { label: 'orange', hex: '#FF5800' },
  { label: 'blue',   hex: '#0046AD' },
];

interface CanvasOverlayProps {
  /** Current 3×3 color grid (hex values or null) */
  colors: (string | null)[][];
  /** Confidence values for each cell (0..1) */
  confidences?: number[][];
  /** Called when user manually sets a sticker color */
  onStickerChange: (row: number, col: number, colorLabel: string) => void;
  /** Whether editing is enabled */
  editable?: boolean;
  /** Show confidence percentages */
  showConfidence?: boolean;
}

export default function CanvasOverlay({
  colors,
  confidences,
  onStickerChange,
  editable = true,
  showConfidence = false,
}: CanvasOverlayProps) {
  const [activeCell, setActiveCell] = useState<[number, number] | null>(null);

  const handleCellClick = (row: number, col: number) => {
    if (!editable) return;
    if (activeCell && activeCell[0] === row && activeCell[1] === col) {
      setActiveCell(null);
    } else {
      setActiveCell([row, col]);
    }
  };

  const handleColorSelect = (row: number, col: number, label: string) => {
    onStickerChange(row, col, label);
    setActiveCell(null);
  };

  return (
    <div className="relative">
      {/* 3×3 Grid */}
      <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-black/30 backdrop-blur-sm border border-white/10">
        {colors.flat().map((color, index) => {
          const row = Math.floor(index / 3);
          const col = index % 3;
          const isActive = activeCell?.[0] === row && activeCell?.[1] === col;
          const confidence = confidences?.[row]?.[col];
          const displayColor = color ?? '#808080';

          return (
            <motion.button
              key={`${row}-${col}`}
              onClick={() => handleCellClick(row, col)}
              className={`relative aspect-square rounded-lg border-2 transition-all ${
                isActive
                  ? 'border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] scale-105 z-10'
                  : editable
                  ? 'border-white/10 hover:border-white/30 hover:scale-102'
                  : 'border-white/10'
              }`}
              style={{ backgroundColor: displayColor }}
              whileTap={editable ? { scale: 0.92 } : undefined}
              aria-label={`Sticker at row ${row + 1}, column ${col + 1}. Color: ${
                COLOR_OPTIONS.find(c => c.hex === color)?.label ?? 'unscanned'
              }`}
            >
              {/* Confidence badge */}
              {showConfidence && confidence !== undefined && confidence > 0 && (
                <span className="absolute bottom-0.5 right-0.5 text-[7px] font-mono font-bold bg-black/60 text-white px-1 rounded">
                  {Math.round(confidence * 100)}%
                </span>
              )}

              {/* Edit indicator */}
              {editable && !isActive && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30 rounded-lg">
                  <Pipette className="w-3 h-3 text-white" />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Color Picker Popover */}
      <AnimatePresence>
        {activeCell && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full z-20
                       flex gap-1.5 p-2 rounded-xl glass shadow-2xl border border-white/20"
          >
            {COLOR_OPTIONS.map(opt => (
              <button
                key={opt.label}
                onClick={() => handleColorSelect(activeCell[0], activeCell[1], opt.label)}
                className="w-7 h-7 rounded-lg border-2 border-white/20 hover:border-white hover:scale-110 
                           transition-all shadow-inner active:scale-90"
                style={{ backgroundColor: opt.hex }}
                aria-label={`Set to ${opt.label}`}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
