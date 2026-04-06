/**
 * Scanner — Phase 1: Camera-based cube face scanning
 * 
 * Uses the device camera to detect Rubik's Cube face colors via HSV analysis.
 * Features real-time color detection, glare warnings, haptic feedback,
 * and a Three.js 3D cube preview that updates live.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ArrowLeft, ArrowRight, Check, RotateCw, AlertTriangle, Sun } from 'lucide-react';
import {
  CubeState,
  CubeColor,
  FaceName,
  FACE_ORDER,
  FACE_LABELS,
  COLOR_MAP,
  INITIAL_CUBE_STATE,
  detectColor,
  ROTATION_GUIDANCE,
} from '../lib/cubeUtils';
import { detectGlare, type GlareResult } from '../services/GlareDetector';
import { Haptic } from '../services/HapticService';
import CubeRenderer from './CubeRenderer';
import CanvasOverlay from './CanvasOverlay';

interface ScannerProps {
  onComplete: (state: CubeState) => void;
}

export default function Scanner({ onComplete }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFaceIndex, setCurrentFaceIndex] = useState(0);
  const [scannedState, setScannedState] = useState<CubeState>(INITIAL_CUBE_STATE);
  const [realTimeColors, setRealTimeColors] = useState<CubeColor[][]>(
    Array(3).fill(null).map(() => Array(3).fill('white'))
  );
  const [glare, setGlare] = useState<GlareResult | null>(null);

  const currentFace = FACE_ORDER[currentFaceIndex];
  const guidance = ROTATION_GUIDANCE[currentFace];

  // Derive hex color map for the 3D preview
  const cubeColors = React.useMemo(() => {
    const result: Record<string, (string | null)[][]> = {};
    for (const face of FACE_ORDER) {
      result[face] = scannedState[face].map((row: CubeColor[]) =>
        row.map((c: CubeColor) => COLOR_MAP[c] ?? null)
      );
    }
    return result;
  }, [scannedState]);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  // Toggle camera
  const flipCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setCameraActive(false);
  }, []);

  // Start Camera
  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraActive(true);
        }
      } catch (err) {
        setError("Camera access denied. Please enable it in browser settings.");
      }
    };
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [facingMode]);

  // Real-time color detection loop
  useEffect(() => {
    let animationFrame: number;
    const detect = () => {
      if (videoRef.current && canvasRef.current && cameraActive) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = 300; // Small canvas for processing
          canvas.height = 300;
          
          // Draw video to canvas
          if (facingMode === 'user') {
            // Mirror for user facing camera
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Reset transform for next frame or logic
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.restore();

          // Glare detection
          const fullImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const glareResult = detectGlare(fullImageData, 3, 240);
          setGlare(glareResult);

          // Color detection per grid cell
          const gridColors: CubeColor[][] = [];
          const boxSize = canvas.width / 3;

          for (let r = 0; r < 3; r++) {
            const row: CubeColor[] = [];
            for (let c = 0; c < 3; c++) {
              const x = c * boxSize + boxSize / 2;
              const y = r * boxSize + boxSize / 2;
              const data = ctx.getImageData(x - 8, y - 8, 16, 16).data;

              let red = 0, g = 0, b = 0;
              for (let i = 0; i < data.length; i += 4) {
                red += data[i]; g += data[i + 1]; b += data[i + 2];
              }
              const count = data.length / 4;
              row.push(detectColor(red / count, g / count, b / count));
            }
            gridColors.push(row);
          }
          setRealTimeColors(gridColors);
        }
      }
      animationFrame = requestAnimationFrame(detect);
    };
    detect();
    return () => cancelAnimationFrame(animationFrame);
  }, [cameraActive]);

  const captureFace = useCallback(() => {
    Haptic.medium();
    setScannedState(prev => ({
      ...prev,
      [currentFace]: JSON.parse(JSON.stringify(realTimeColors)),
    }));
    if (currentFaceIndex < 5) {
      setCurrentFaceIndex(i => i + 1);
    }
  }, [currentFace, currentFaceIndex, realTimeColors]);

  const handleOverlayChange = useCallback(
    (row: number, col: number, colorLabel: string) => {
      Haptic.light();
      setRealTimeColors(prev => {
        const next = prev.map(r => [...r]);
        next[row][col] = colorLabel as CubeColor;
        return next;
      });
    },
    []
  );

  const handleComplete = useCallback(() => {
    Haptic.success();
    onComplete(scannedState);
  }, [scannedState, onComplete]);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-6rem)] gap-6 p-6 max-w-7xl mx-auto">
      {/* ─── Camera Feed ─────────────────────────────── */}
      <div className="flex-1 relative glass-card overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">{FACE_LABELS[currentFace]}</h2>
              <p className="text-xs text-zinc-400">Step {currentFaceIndex + 1} of 6</p>
            </div>
          </div>
          <div className="flex gap-2">
            {FACE_ORDER.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i === currentFaceIndex
                    ? 'bg-white scale-125'
                    : i < currentFaceIndex
                    ? 'bg-white/40'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Video Area */}
        <div className="relative flex-1 bg-black rounded-2xl overflow-hidden group">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scan Guide Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-2 border-white/30 rounded-3xl relative">
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-xl" />
              {/* Grid lines */}
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/15" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/15" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white/15" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white/15" />
            </div>
          </div>

          {/* Glare Warning */}
          <AnimatePresence>
            {glare?.hasGlare && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-4 left-4 right-4 z-20"
              >
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/20 border border-amber-500/30 backdrop-blur-md">
                  <Sun className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
                  <div>
                    <p className="text-sm font-bold text-amber-300">Glare Detected</p>
                    <p className="text-xs text-amber-400/70">
                      Tilt the cube to reduce reflections ({Math.round(glare.intensity * 100)}% intensity)
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live Recognition Grid — Bottom Right */}
          <div className="absolute bottom-4 right-4 z-10">
            <CanvasOverlay
              colors={realTimeColors.map(row => row.map(c => COLOR_MAP[c]))}
              onStickerChange={handleOverlayChange}
              editable={true}
            />
            <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest text-center mt-2 bg-black/40 py-1 rounded-full px-2">
              Live Recognition — Tap to Correct
            </p>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-zinc-950/90 flex flex-col items-center justify-center p-8 text-center"
              >
                <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                <p className="text-lg font-medium">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-4">
          <button
            onClick={() => setCurrentFaceIndex(i => Math.max(0, i - 1))}
            disabled={currentFaceIndex === 0}
            className="btn-secondary px-6"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button onClick={captureFace} className="btn-primary flex-1 flex items-center justify-center gap-3">
            <Camera className="w-6 h-6" />
            Capture {FACE_LABELS[currentFace].split(' ')[0]}
          </button>
          {currentFaceIndex === 5 ? (
            <button
              onClick={handleComplete}
              className="btn-primary bg-emerald-500 text-white hover:bg-emerald-600 px-6"
            >
              <Check className="w-6 h-6" />
            </button>
          ) : (
            <button
              onClick={() => setCurrentFaceIndex(i => Math.min(5, i + 1))}
              className="btn-secondary px-6"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ─── 3D Preview Side Panel ──────────────────── */}
      <div className="w-full lg:w-96 flex flex-col gap-6">
        <div className="glass-card flex-1 flex flex-col items-center justify-center gap-6 text-center">
          <div className="w-full aspect-square relative rounded-2xl overflow-hidden">
            <CubeRenderer colors={cubeColors} autoRotate={true} />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-heading font-extrabold tracking-tight">Instruction</h3>
            <p className="text-zinc-400 text-sm max-w-[200px] mx-auto">{guidance.text}</p>
          </div>

          <div className="w-full h-px bg-white/5" />

          {/* Currently Captured Grid */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-[180px]">
            {scannedState[currentFace].flat().map((color: CubeColor, i: number) => (
              <div
                key={i}
                className="aspect-square rounded-md border border-white/10 shadow-inner transition-colors duration-300"
                style={{ backgroundColor: COLOR_MAP[color] }}
              />
            ))}
          </div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Currently Captured</p>
        </div>

        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <RotateCw className="w-5 h-5 text-blue-400 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold">Real-Time 3D Sync</p>
            <p className="text-[10px] text-zinc-500">Model updates as you scan each face</p>
          </div>
        </div>
      </div>
    </div>
  );
}
