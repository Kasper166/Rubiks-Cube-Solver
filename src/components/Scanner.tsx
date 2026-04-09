/**
 * Scanner — Phase 1: Camera-based cube face scanning
 * 
 * Uses the device camera to detect Rubik's Cube face colors via HSV analysis.
 * Features real-time color detection, glare warnings, haptic feedback,
 * and a Three.js 3D cube preview that updates live.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ArrowLeft, ArrowRight, Check, RotateCw, AlertTriangle, Sun, Bug, SwitchCamera, Pause } from 'lucide-react';
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

// ── Calibration types ────────────────────────────────────────────────────────
type CalHSV = { h: number; s: number; v: number }; // h: 0-360, s/v: 0-100
type CalibrationData = Partial<Record<CubeColor, CalHSV>>;

const CAL_ORDER: CubeColor[] = ['white', 'yellow', 'red', 'orange', 'green', 'blue'];

export default function Scanner({ onComplete }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFaceIndex, setCurrentFaceIndex] = useState(0);
  const [scannedState, setScannedState] = useState<CubeState>(INITIAL_CUBE_STATE);
  const [realTimeColors, setRealTimeColors] = useState<CubeColor[][]>(
    Array(3).fill(null).map(() => Array(3).fill('white'))
  );
  const [manualOverrides, setManualOverrides] = useState<(CubeColor | null)[][]>(
    Array(3).fill(null).map(() => Array(3).fill(null))
  );
  const [glare, setGlare] = useState<GlareResult | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [cubeDetected, setCubeDetected] = useState(false);
  const cubeDetectedRef = useRef(false);

  // ── Calibration state ────────────────────────────────────────────────────
  // Built up incrementally as the user manually corrects stickers during scanning.
  const [calibration, setCalibration] = useState<CalibrationData>({});
  const calibrationRef = useRef<CalibrationData>({});
  calibrationRef.current = calibration;

  // ── Frame-freeze state ───────────────────────────────────────────────────
  // Freezes the canvas when the user manually corrects a sticker so they can
  // keep editing without the live feed moving under them.
  const [frameFrozen, setFrameFrozen] = useState(false);
  const frameFrozenRef = useRef(false);
  frameFrozenRef.current = frameFrozen;

  // Auto-capture states — use refs so the rAF loop always reads current values
  const lastFingerprintRef = useRef("");
  const stabilityStartRef = useRef<number | null>(null);
  const lastCapturedFaceRef = useRef<FaceName | null>(null);
  const captureFaceRef = useRef<() => void>(() => {});

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

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  // Refs mirroring state for the rAF detect() loop (avoids stale closures)
  const facingModeRef = useRef(facingMode);
  facingModeRef.current = facingMode;
  const manualOverridesRef = useRef(manualOverrides);
  manualOverridesRef.current = manualOverrides;
  const currentFaceRef = useRef(currentFace);
  currentFaceRef.current = currentFace;
  const debugModeRef = useRef(debugMode);
  debugModeRef.current = debugMode;

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
        // Use 'ideal' so laptops (which only have a user-facing camera) don't fail
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
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
          
          // Read current values from refs to avoid stale closures
          const curFacingMode = facingModeRef.current;
          const curOverrides = manualOverridesRef.current;
          const curFace = currentFaceRef.current;

          // Draw the guide area to canvas so sampling aligns with what the user sees.
          // The guide box (w-64 = 256px CSS) is centered in the video container.
          // We compute its position in video-frame coordinates accounting for object-cover.
          const videoW = video.videoWidth;
          const videoH = video.videoHeight;
          const container = videoContainerRef.current;
          const containerW = container ? container.clientWidth : videoW;
          const containerH = container ? container.clientHeight : videoH;

          if (videoW > 0 && videoH > 0) {
            // Compute the video region visible through CSS object-cover
            const videoAspect = videoW / videoH;
            const containerAspect = containerW / containerH;
            let srcX = 0, srcY = 0, srcW = videoW, srcH = videoH;
            if (videoAspect > containerAspect) {
              // Landscape video in portrait/square container — crop sides
              srcW = videoH * containerAspect;
              srcX = (videoW - srcW) / 2;
            } else {
              // Portrait video in landscape container — crop top/bottom
              srcH = videoW / containerAspect;
              srcY = (videoH - srcH) / 2;
            }

            // The CSS guide box (256×256px) is centered in the container
            const guideCSS = 256;
            const guideCSSX = (containerW - guideCSS) / 2;
            const guideCSSY = (containerH - guideCSS) / 2;

            // Map guide box to video-frame coordinates
            const scaleX = srcW / containerW;
            const scaleY = srcH / containerH;
            const guideVX = srcX + guideCSSX * scaleX;
            const guideVY = srcY + guideCSSY * scaleY;
            const guideVW = guideCSS * scaleX;
            const guideVH = guideCSS * scaleY;

            // Skip redraw when frozen (user is correcting stickers) — keeps canvas still
            if (!frameFrozenRef.current) {
              ctx.save();
              if (curFacingMode === 'user') {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
              }
              // Draw only the guide region → fills the entire 300×300 canvas
              ctx.drawImage(video, guideVX, guideVY, guideVW, guideVH, 0, 0, canvas.width, canvas.height);
              ctx.restore();
            }
          }

          // Glare detection on the guide area
          const fullImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const glareResult = detectGlare(fullImageData, 3, 240);
          setGlare(glareResult);

          // Cube face recognition: check for dark sticker borders at 1/3 and 2/3 marks
          const detected = assessCubeFaceConfidence(ctx) > 0.5;
          if (detected !== cubeDetectedRef.current) {
            cubeDetectedRef.current = detected;
            setCubeDetected(detected);
          }

          // Color detection: canvas now represents the guide area exactly.
          // Divide into a uniform 3×3 grid — each cell is 100×100px in the canvas.
          const boxSize = canvas.width / 3; // 100px
          const curCalibration = calibrationRef.current;

          const gridColors: CubeColor[][] = [];
          for (let r = 0; r < 3; r++) {
            const row: CubeColor[] = [];
            for (let c = 0; c < 3; c++) {
              // If manually overridden, use that color
              if (curOverrides[r][c]) {
                row.push(curOverrides[r][c]!);
                continue;
              }

              // Force center color for the current face to avoid misdetection
              if (r === 1 && c === 1) {
                const expectedCenter = {
                  U: 'white',
                  F: 'green',
                  R: 'red',
                  B: 'blue',
                  L: 'orange',
                  D: 'yellow'
                }[curFace] as CubeColor;
                row.push(expectedCenter);
                continue;
              }

              const x = c * boxSize + boxSize / 2;
              const y = r * boxSize + boxSize / 2;
              const sampleSize = 12;
              const data = ctx.getImageData(x - sampleSize/2, y - sampleSize/2, sampleSize, sampleSize).data;

              let red = 0, g = 0, b = 0;
              for (let i = 0; i < data.length; i += 4) {
                red += data[i]; g += data[i + 1]; b += data[i + 2];
              }
              const count = data.length / 4;
              // Use calibrated nearest-neighbour only for colors the user has already
              // corrected — falls back to HSV ranges for uncalibrated colors.
              const color = detectColorWithCalibration(red / count, g / count, b / count, curCalibration);
              row.push(color);
            }
            gridColors.push(row);
          }
          setRealTimeColors(gridColors);

          // ── Debug canvas: visualise what the CV algorithm sees ──────────
          if (debugModeRef.current && debugCanvasRef.current) {
            const dc = debugCanvasRef.current;
            const dctx = dc.getContext('2d');
            if (dctx) {
              dc.width = 300;
              dc.height = 300;
              // Copy the processed (guide-area) image
              dctx.drawImage(canvas, 0, 0);

              const cellPx = 100; // canvas.width / 3
              for (let dr = 0; dr < 3; dr++) {
                for (let dc2 = 0; dc2 < 3; dc2++) {
                  const cx = dc2 * cellPx + cellPx / 2;
                  const cy = dr * cellPx + cellPx / 2;
                  const detectedColor = gridColors[dr][dc2];
                  const hex = COLOR_MAP[detectedColor];
                  const isOverride = !!curOverrides[dr][dc2];
                  const isForced = dr === 1 && dc2 === 1;

                  // Semi-transparent tint per cell
                  dctx.fillStyle = hex + '44';
                  dctx.fillRect(dc2 * cellPx, dr * cellPx, cellPx, cellPx);

                  // Sampling circle
                  dctx.beginPath();
                  dctx.arc(cx, cy, 18, 0, Math.PI * 2);
                  dctx.fillStyle = hex;
                  dctx.fill();
                  dctx.strokeStyle = isOverride ? '#facc15' : isForced ? '#a78bfa' : 'white';
                  dctx.lineWidth = isOverride || isForced ? 3 : 2;
                  dctx.stroke();

                  // Color abbreviation inside circle
                  dctx.fillStyle = detectedColor === 'white' || detectedColor === 'yellow' ? '#000' : '#fff';
                  dctx.font = 'bold 9px monospace';
                  dctx.textAlign = 'center';
                  dctx.textBaseline = 'middle';
                  dctx.fillText(detectedColor.slice(0, 3).toUpperCase(), cx, cy);

                  // Badge: override / forced indicator
                  if (isOverride || isForced) {
                    dctx.font = 'bold 7px monospace';
                    dctx.fillStyle = isOverride ? '#facc15' : '#a78bfa';
                    dctx.fillText(isOverride ? 'OVR' : 'FXD', cx, cy + 26);
                  }
                }
              }

              // Grid lines
              dctx.strokeStyle = 'rgba(255,255,255,0.5)';
              dctx.lineWidth = 1;
              for (let i = 1; i < 3; i++) {
                dctx.beginPath(); dctx.moveTo(i * cellPx, 0); dctx.lineTo(i * cellPx, 300); dctx.stroke();
                dctx.beginPath(); dctx.moveTo(0, i * cellPx); dctx.lineTo(300, i * cellPx); dctx.stroke();
              }
            }
          }
          // ────────────────────────────────────────────────────────────────

          // Auto-capture detection (using refs for current values)
          const fingerprint = gridColors.flat().join("");
          if (fingerprint !== lastFingerprintRef.current) {
            lastFingerprintRef.current = fingerprint;
            stabilityStartRef.current = Date.now();
          } else if (stabilityStartRef.current && Date.now() - stabilityStartRef.current > 1200) {
            // Stable for 1.2s — only capture if cube face is recognised, not frozen, and colors are diverse
            if (curFace !== lastCapturedFaceRef.current && cubeDetectedRef.current && !frameFrozenRef.current) {
               const uniqueColors = new Set(gridColors.flat()).size;
               if (uniqueColors >= 2) {
                 captureFaceRef.current();
               }
            }
          }
        }
      }
      animationFrame = requestAnimationFrame(detect);
    };
    detect();
    return () => cancelAnimationFrame(animationFrame);
  }, [cameraActive]);

  const captureFace = useCallback(() => {
    Haptic.medium();
    const finalColors = JSON.parse(JSON.stringify(realTimeColors));
    setScannedState(prev => ({
      ...prev,
      [currentFace]: finalColors,
    }));
    lastCapturedFaceRef.current = currentFace;
    setManualOverrides(Array(3).fill(null).map(() => Array(3).fill(null)));
    setFrameFrozen(false); // resume live feed for the next face

    if (currentFaceIndex < 5) {
      setCurrentFaceIndex(i => i + 1);
    }
  }, [currentFace, currentFaceIndex, realTimeColors]);
  captureFaceRef.current = captureFace;

  const handleOverlayChange = useCallback(
    (row: number, col: number, colorLabel: string) => {
      Haptic.light();

      // Sample the frozen/live canvas pixel at this sticker's position and store
      // it as a calibration reference for this color label.  Future scans will use
      // nearest-neighbour against these real samples to distinguish orange vs red, etc.
      if (canvasRef.current) {
        const ctx2 = canvasRef.current.getContext('2d', { willReadFrequently: true });
        if (ctx2) {
          const cellSize = 100; // 300 / 3
          const cx = col * cellSize + cellSize / 2;
          const cy = row * cellSize + cellSize / 2;
          const sampleSize = 12;
          const d = ctx2.getImageData(cx - sampleSize / 2, cy - sampleSize / 2, sampleSize, sampleSize).data;
          let sr = 0, sg = 0, sb = 0;
          for (let i = 0; i < d.length; i += 4) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; }
          const n = d.length / 4;
          setCalibration(prev => ({ ...prev, [colorLabel]: rgbToHsvPublic(sr / n, sg / n, sb / n) }));
        }
      }

      // Freeze the frame so the user can keep correcting without the image moving.
      setFrameFrozen(true);

      setManualOverrides(prev => {
        const next = prev.map(r => [...r]);
        next[row][col] = colorLabel as CubeColor;
        return next;
      });
      // Also update real-time colors immediately for feedback
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
    <div className="flex flex-col lg:flex-row min-h-screen lg:h-[calc(100vh-6rem)] gap-6 p-4 lg:p-6 max-w-7xl mx-auto">
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
              <div className="flex items-center gap-2">
                <p className="text-xs text-zinc-400">Step {currentFaceIndex + 1} of 6</p>
                {Object.keys(calibration).length > 0 && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                    ✓ {Object.keys(calibration).length} calibrated
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setDebugMode(d => !d)}
              className={`p-2 rounded-xl transition-colors ${debugMode ? 'bg-amber-500/30 text-amber-400' : 'bg-white/10 hover:bg-white/20 text-white'}`}
              title="Toggle CV debug mode"
            >
              <Bug className="w-4 h-4" />
            </button>
            <button
              onClick={flipCamera}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
              title="Flip Camera"
            >
              <RotateCw className="w-4 h-4 text-white" />
            </button>
            <div className="flex items-center gap-2">
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
        </div>

        {/* Video Area */}
        <div ref={videoContainerRef} className="relative flex-1 min-h-[350px] lg:min-h-0 bg-black rounded-2xl overflow-hidden group">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scan Guide Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2">
            <div
              className={`w-64 h-64 border-2 rounded-3xl relative transition-all duration-300 ${
                cubeDetected
                  ? 'border-emerald-400/80 shadow-[0_0_20px_2px_rgba(52,211,153,0.25)]'
                  : 'border-white/30'
              }`}
            >
              <div className={`absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 rounded-tl-xl transition-colors duration-300 ${cubeDetected ? 'border-emerald-400' : 'border-white'}`} />
              <div className={`absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 rounded-tr-xl transition-colors duration-300 ${cubeDetected ? 'border-emerald-400' : 'border-white'}`} />
              <div className={`absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 rounded-bl-xl transition-colors duration-300 ${cubeDetected ? 'border-emerald-400' : 'border-white'}`} />
              <div className={`absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 rounded-br-xl transition-colors duration-300 ${cubeDetected ? 'border-emerald-400' : 'border-white'}`} />
              {/* Grid lines */}
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/15" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/15" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white/15" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white/15" />
            </div>
            {/* Detection status label */}
            <div className={`px-3 py-1 rounded-full text-[11px] font-bold backdrop-blur-sm transition-all duration-300 ${
              cubeDetected
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-black/30 text-zinc-500 border border-white/10'
            }`}>
              {cubeDetected ? '✓ Cube detected — hold still' : 'Align cube face in frame'}
            </div>
          </div>

          {/* Rotation Arrow */}
          <AnimatePresence>
            {!showIntro && currentFaceIndex > 0 && stabilityStartRef.current && (Date.now() - stabilityStartRef.current < 3000) && (
              <RotationArrow alg={guidance.alg} facingMode={facingMode} />
            )}
          </AnimatePresence>

          {/* Frame-frozen indicator */}
          <AnimatePresence>
            {frameFrozen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 backdrop-blur-sm"
              >
                <Pause className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold text-amber-300">Frame frozen — correct stickers, then Capture</span>
              </motion.div>
            )}
          </AnimatePresence>

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
          <div className="absolute bottom-4 right-4 z-10 w-24 sm:w-32 lg:w-40">
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

        {/* ── Debug Panel ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {debugMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Bug className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">CV Debug Mode</span>
                  <span className="ml-auto text-[10px] text-zinc-500">
                    <span className="text-white/40">●</span> sampled &nbsp;
                    <span className="text-amber-400">●</span> override &nbsp;
                    <span className="text-violet-400">●</span> forced
                  </span>
                </div>
                <div className="flex gap-4 items-start">
                  {/* Debug canvas — what the CV algorithm actually processes */}
                  <div className="shrink-0">
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1 text-center">What CV sees</p>
                    <canvas
                      ref={debugCanvasRef}
                      width={180}
                      height={180}
                      className="rounded-xl border border-white/10"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>

                  {/* Detected colour grid with names */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-2 text-center">Detected colours</p>
                    <div className="grid grid-cols-3 gap-1">
                      {realTimeColors.flat().map((color, i) => {
                        const row = Math.floor(i / 3);
                        const col = i % 3;
                        const isOverride = !!manualOverrides[row][col];
                        const isForced = row === 1 && col === 1;
                        return (
                          <div
                            key={i}
                            className="flex flex-col items-center gap-0.5 p-1 rounded-lg border"
                            style={{
                              backgroundColor: COLOR_MAP[color] + '22',
                              borderColor: isOverride ? '#facc15' : isForced ? '#a78bfa' : COLOR_MAP[color] + '66',
                            }}
                          >
                            <div
                              className="w-4 h-4 rounded-sm shadow"
                              style={{ backgroundColor: COLOR_MAP[color] }}
                            />
                            <span className="text-[8px] font-mono font-bold text-zinc-300 leading-none">
                              {color.slice(0, 3).toUpperCase()}
                            </span>
                            {isOverride && <span className="text-[7px] text-amber-400 leading-none">OVR</span>}
                            {isForced && <span className="text-[7px] text-violet-400 leading-none">FXD</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Face + stability info */}
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-[9px]">
                        <span className="text-zinc-500">Scanning face</span>
                        <span className="font-mono font-bold text-white">{currentFace} — {FACE_LABELS[currentFace].split('(')[1]?.replace(')', '') ?? ''}</span>
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span className="text-zinc-500">Unique colours</span>
                        <span className={`font-mono font-bold ${new Set(realTimeColors.flat()).size >= 2 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {new Set(realTimeColors.flat()).size} / 6
                        </span>
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span className="text-zinc-500">Glare</span>
                        <span className={`font-mono font-bold ${glare?.hasGlare ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {glare ? `${Math.round(glare.intensity * 100)}%` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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

      {/* ─── 3D Preview Side Panel (Hidden on mobile for better focus) ──────────────────── */}
      <div className="hidden lg:flex w-full lg:w-96 flex-col gap-6">
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

      {/* Intro Overlay — camera picker */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="max-w-sm w-full">
              <div className="w-20 h-20 bg-blue-500/20 rounded-3xl flex items-center justify-center mb-6 mx-auto">
                <Camera className="w-10 h-10 text-blue-400" />
              </div>
              <h2 className="text-2xl font-heading font-bold mb-2">Choose Your Camera</h2>
              <p className="text-zinc-400 text-sm mb-3">
                The rotation arrows will adapt to your camera direction.
              </p>
              <p className="text-zinc-500 text-xs mb-8">
                Tip: if colors are misdetected while scanning, tap any sticker in the live grid to correct it — the app will learn your cube's colors automatically.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => { setFacingMode('environment'); setShowIntro(false); }}
                  className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                    facingMode === 'environment'
                      ? 'border-blue-500 bg-blue-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/30 hover:bg-white/10'
                  }`}
                >
                  <Camera className="w-8 h-8" />
                  <div className="text-left">
                    <p className="font-bold text-sm leading-tight">Back Camera</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">Point phone at the cube</p>
                  </div>
                </button>
                <button
                  onClick={() => { setFacingMode('user'); setShowIntro(false); }}
                  className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                    facingMode === 'user'
                      ? 'border-violet-500 bg-violet-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/30 hover:bg-white/10'
                  }`}
                >
                  <SwitchCamera className="w-8 h-8" />
                  <div className="text-left">
                    <p className="font-bold text-sm leading-tight">Front Camera</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">Hold cube facing you</p>
                  </div>
                </button>
              </div>
              <p className="text-[11px] text-zinc-600">
                You can switch cameras at any time using the button in the top right.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Calibration helpers ──────────────────────────────────────────────────────

/** Converts RGB (0-255) to HSV with h: 0-360, s/v: 0-100. */
function rgbToHsvPublic(r: number, g: number, b: number): CalHSV {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}

/**
 * Nearest-neighbour classifier among only the calibrated colors.
 * Returns null if no calibration data is present.
 */
function detectColorCalibrated(
  r: number, g: number, b: number,
  cal: CalibrationData,
): CubeColor | null {
  const { h, s, v } = rgbToHsvPublic(r, g, b);
  let best: CubeColor | null = null;
  let bestDist = Infinity;
  for (const color of CAL_ORDER) {
    const ref = cal[color];
    if (!ref) continue;
    const dh = Math.min(Math.abs(h - ref.h), 360 - Math.abs(h - ref.h));
    const ds = Math.abs(s - ref.s);
    const dv = Math.abs(v - ref.v);
    const dist = dh * 2.0 + ds * 0.8 + dv * 0.3;
    if (dist < bestDist) { bestDist = dist; best = color; }
  }
  return best;
}

/**
 * Hybrid classifier: uses calibrated nearest-neighbour only when the default
 * HSV classifier returns a color that has a calibration entry (meaning there
 * may be ambiguity with a nearby calibrated color).  Falls back to the default
 * for colors that have never been corrected.
 *
 * Example: red and orange are both calibrated → if default says "orange",
 * we re-run nearest-neighbour to check if it's closer to the calibrated red.
 * If default says "green" and green is uncalibrated, we trust the default.
 */
function detectColorWithCalibration(
  r: number, g: number, b: number,
  cal: CalibrationData,
): CubeColor {
  const defaultResult = detectColor(r, g, b);
  if (!cal[defaultResult]) return defaultResult; // color not calibrated → trust default
  const calibrated = detectColorCalibrated(r, g, b, cal);
  return calibrated ?? defaultResult;
}

/**
 * Estimates the probability that the canvas contains a Rubik's cube face.
 *
 * Strategy: a cube face has black plastic borders between stickers.
 * These borders appear at the 1/3 and 2/3 marks of the 300×300 canvas.
 * We compare the brightness of those border strips vs the cell centres.
 * Dark borders + bright cells + clear contrast → high confidence.
 */
function assessCubeFaceConfidence(ctx: CanvasRenderingContext2D): number {
  const W = 300;
  const step = W / 3; // 100 — border positions

  let borderBrightness = 0, borderCount = 0;
  let cellBrightness = 0, cellCount = 0;

  // Sample vertical border strips at x ≈ 100 and x ≈ 200
  for (const bx of [step, step * 2]) {
    for (let s = 0; s < 8; s++) {
      const y = Math.round((s + 0.5) * W / 8);
      // Skip pixels near horizontal border crossings (noisy corners)
      if (Math.abs(y - step) < 10 || Math.abs(y - step * 2) < 10) continue;
      const d = ctx.getImageData(bx - 2, y, 5, 1).data;
      for (let i = 0; i < d.length; i += 4) {
        borderBrightness += (d[i] + d[i + 1] + d[i + 2]) / 3;
        borderCount++;
      }
    }
  }

  // Sample horizontal border strips at y ≈ 100 and y ≈ 200
  for (const by of [step, step * 2]) {
    for (let s = 0; s < 8; s++) {
      const x = Math.round((s + 0.5) * W / 8);
      if (Math.abs(x - step) < 10 || Math.abs(x - step * 2) < 10) continue;
      const d = ctx.getImageData(x, by - 2, 1, 5).data;
      for (let i = 0; i < d.length; i += 4) {
        borderBrightness += (d[i] + d[i + 1] + d[i + 2]) / 3;
        borderCount++;
      }
    }
  }

  // Sample 12×12 patch at each of the 9 cell centres
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = Math.round(col * step + step / 2);
      const cy = Math.round(row * step + step / 2);
      const d = ctx.getImageData(cx - 6, cy - 6, 12, 12).data;
      for (let i = 0; i < d.length; i += 4) {
        cellBrightness += (d[i] + d[i + 1] + d[i + 2]) / 3;
        cellCount++;
      }
    }
  }

  const avgBorder = borderCount > 0 ? borderBrightness / borderCount : 255;
  const avgCell   = cellCount   > 0 ? cellBrightness   / cellCount   : 0;

  // Border should be dark (plastic frame), cells should be brighter (coloured stickers)
  const borderDarkScore  = Math.max(0, 1 - avgBorder / 90);       // full score when avgBorder < ~45
  const contrastScore    = Math.max(0, Math.min(1, (avgCell - avgBorder) / 80)); // needs 80+ gap

  return borderDarkScore * 0.55 + contrastScore * 0.45;
}

function RotationArrow({ alg, facingMode }: { alg: string; facingMode: 'user' | 'environment' }) {
  if (!alg) return null;

  // For front camera the user faces the lens, so left/right are physically mirrored.
  const flip = facingMode === 'user';

  let rotationClass = "";
  let icon = <ArrowRight className="w-12 h-12" />;

  if (alg === "x") {
    rotationClass = "-rotate-90"; // UP — same for both cameras
  } else if (alg === "x'") {
    rotationClass = "rotate-90";  // DOWN — same for both cameras
  } else if (alg === "y") {
    rotationClass = flip ? "rotate-0" : "rotate-180"; // back→left, front→right
  } else if (alg === "y'") {
    rotationClass = flip ? "rotate-180" : "rotate-0"; // back→right, front→left
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`absolute inset-0 flex items-center justify-center pointer-events-none z-30`}
    >
      <div className={`p-6 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl ${rotationClass}`}>
        <motion.div
          animate={{ x: [0, 15, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          {icon}
        </motion.div>
      </div>
    </motion.div>
  );
}
