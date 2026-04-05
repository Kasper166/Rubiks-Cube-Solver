import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ArrowLeft, ArrowRight, Check, RotateCw, Info } from 'lucide-react';
import { 
  CubeState, 
  CubeColor, 
  FaceName, 
  FACE_ORDER, 
  FACE_LABELS, 
  COLOR_MAP,
  INITIAL_CUBE_STATE, 
  detectColor,
  ROTATION_GUIDANCE
} from '../lib/cubeUtils';
import 'cubing/twisty';
import 'cubing/twisty';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'twisty-player': any;
    }
  }
}

interface ScannerProps {
  onComplete: (state: CubeState) => void;
}

export default function Scanner({ onComplete }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const twistyGuidanceRef = useRef<any>(null);
  
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFaceIndex, setCurrentFaceIndex] = useState(0);
  const [scannedState, setScannedState] = useState<CubeState>(INITIAL_CUBE_STATE);
  const [realTimeColors, setRealTimeColors] = useState<CubeColor[][]>(
    Array(3).fill(null).map(() => Array(3).fill('white'))
  );

  const currentFace = FACE_ORDER[currentFaceIndex];
  const guidance = ROTATION_GUIDANCE[currentFace];

  // Start Camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
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
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

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
          
          // Draw mirrored video
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const gridColors: CubeColor[][] = [];
          const boxSize = canvas.width / 3;
          
          for (let r = 0; r < 3; r++) {
            const row: CubeColor[] = [];
            for (let c = 0; c < 3; c++) {
              const x = c * boxSize + boxSize / 2;
              const y = r * boxSize + boxSize / 2;
              const data = ctx.getImageData(x - 5, y - 5, 10, 10).data;
              
              let red = 0, g = 0, b = 0;
              for (let i = 0; i < data.length; i += 4) {
                red += data[i]; g += data[i+1]; b += data[i+2];
              }
              const count = data.length / 4;
              row.push(detectColor(red/count, g/count, b/count));
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

  // Update 3D Guidance
  // Update 3D Guidance
  useEffect(() => {
    if (twistyGuidanceRef.current) {
        const player = twistyGuidanceRef.current;
        if (guidance.alg) {
            player.alg = guidance.alg;
            player.timestamp = 10000;
        } else {
            player.alg = "";
        }
    }
  }, [currentFaceIndex, guidance]);

  const captureFace = () => {
    setScannedState(prev => ({
      ...prev,
      [currentFace]: JSON.parse(JSON.stringify(realTimeColors))
    }));
    if (currentFaceIndex < 5) {
      setCurrentFaceIndex(i => i + 1);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-6rem)] gap-6 p-6 max-w-7xl mx-auto">
      {/* Video Side */}
      <div className="flex-1 relative glass-card overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">{FACE_LABELS[currentFace]}</h2>
              <p className="text-xs text-zinc-400 capitalize">Step {currentFaceIndex + 1} of 6</p>
            </div>
          </div>
          <div className="flex gap-2">
            {FACE_ORDER.map((_, i) => (
              <div 
                key={i} 
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i === currentFaceIndex ? 'bg-white scale-125' : i < currentFaceIndex ? 'bg-white/40' : 'bg-white/10'
                }`} 
              />
            ))}
          </div>
        </div>

        <div className="relative flex-1 bg-black rounded-2xl overflow-hidden group">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover scale-x-[-1]" 
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Real-time Grid Overlay */}
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="aspect-square w-full max-w-md grid grid-cols-3 grid-rows-3 gap-2 border-2 border-white/20 p-2 rounded-xl backdrop-blur-[2px]">
              {realTimeColors.flat().map((color, i) => (
                <motion.div
                  key={i}
                  initial={false}
                  animate={{ backgroundColor: COLOR_MAP[color] + '66' }}
                  className="rounded-lg border border-white/20 shadow-inner flex items-center justify-center"
                >
                  <div className="w-2 h-2 rounded-full bg-white/20" />
                </motion.div>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="absolute inset-0 bg-zinc-950/90 flex flex-col items-center justify-center p-8 text-center"
              >
                <Info className="w-12 h-12 text-red-500 mb-4" />
                <p className="text-lg font-medium">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-6 flex gap-4">
          <button
            onClick={() => setCurrentFaceIndex(i => Math.max(0, i - 1))}
            disabled={currentFaceIndex === 0}
            className="btn-secondary px-6"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={captureFace}
            className="btn-primary flex-1 flex items-center justify-center gap-3"
          >
            <Camera className="w-6 h-6" />
            Capture {FACE_LABELS[currentFace].split(' ')[0]}
          </button>
          {currentFaceIndex === 5 ? (
            <button
              onClick={() => onComplete(scannedState)}
              className="btn-primary bg-ruby-green text-white hover:bg-ruby-green/90 px-6"
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

      {/* Guidance Side */}
      <div className="w-full lg:w-96 flex flex-col gap-6">
        <div className="glass-card flex-1 flex flex-col items-center justify-center gap-6 text-center">
            <div className="w-full aspect-square relative">
                <twisty-player
                    ref={twistyGuidanceRef}
                    className="w-full h-full block"
                    puzzle="3x3x3"
                    control-panel="none"
                    background="none"
                    hint-facelets="none"
                ></twisty-player>
            </div>
            
            <div className="space-y-2">
                <h3 className="text-xl font-heading font-extrabold tracking-tight">Instruction</h3>
                <p className="text-zinc-400 text-sm max-w-[200px] mx-auto">
                    {guidance.text}
                </p>
            </div>

            <div className="w-full h-px bg-white/5" />

            <div className="grid grid-cols-3 gap-2 w-full max-w-[180px]">
                {scannedState[currentFace].flat().map((color, i) => (
                    <div 
                        key={i} 
                        className="aspect-square rounded-md border border-white/10"
                        style={{ backgroundColor: COLOR_MAP[color] }}
                    />
                ))}
            </div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Currently Captured</p>
        </div>

        <div className="glass-card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-ruby-blue/20 flex items-center justify-center">
                <RotateCw className="w-5 h-5 text-ruby-blue animate-spin-slow" />
            </div>
            <div className="flex-1">
                <p className="text-xs font-bold">Automatic 3D Sync</p>
                <p className="text-[10px] text-zinc-500">Model updates as you scan</p>
            </div>
        </div>
      </div>
    </div>
  );
}
