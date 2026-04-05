import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  AlertCircle, 
  Palette, 
  RotateCcw, 
  ArrowRight, 
  Edit3, 
  Box, 
  AlertTriangle 
} from 'lucide-react';
import { 
  CubeState, 
  CubeColor, 
  COLOR_MAP, 
  validateCubeState, 
  ValidationResult, 
  cubeStateToDefinition,
  FACE_LABELS
} from '../lib/cubeUtils';
import 'cubing/twisty';


interface VerifierProps {
  initialState: CubeState;
  onConfirm: (state: CubeState) => void;
  onBack: () => void;
}

export default function Verifier({ initialState, onConfirm, onBack }: VerifierProps) {
  const [state, setState] = useState<CubeState>(initialState);
  const [selectedColor, setSelectedColor] = useState<CubeColor>('white');
  const [isEditing, setIsEditing] = useState(false);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: false, errors: [] });
  const twistyPlayerRef = useRef<any>(null);

  const colors: CubeColor[] = Object.keys(COLOR_MAP) as CubeColor[];

  useEffect(() => {
    const result = validateCubeState(state);
    setValidation(result);

    if (twistyPlayerRef.current) {
      twistyPlayerRef.current.experimentalStickering = cubeStateToDefinition(state);
    }
  }, [state]);

  const handleStickerClick = (face: string, stickerIndex: number) => {
    if (!isEditing) return;
    const r = Math.floor(stickerIndex / 3);
    const c = stickerIndex % 3;

    const newState = JSON.parse(JSON.stringify(state));
    newState[face][r][c] = selectedColor;
    setState(newState);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-6rem)] p-6 max-w-7xl mx-auto gap-8">
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
            onClick={() => onConfirm(state)}
            className="btn-primary flex items-center gap-2 bg-white text-black"
          >
            Solve Cube <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        {/* Left Panel: Stats & Validation */}
        <aside className="lg:col-span-3 space-y-6">
          <section className="glass-card">
            <div className="flex items-center gap-3 mb-4">
               <div className="p-2 bg-ruby-blue/20 rounded-lg">
                 <AlertCircle className="w-5 h-5 text-ruby-blue" />
               </div>
               <h3 className="font-bold">Validation</h3>
            </div>
            {validation.isValid ? (
              <div className="p-4 bg-ruby-green/10 border border-ruby-green/20 rounded-2xl text-ruby-green text-sm flex items-start gap-3">
                <Check className="w-5 h-5 shrink-0 mt-0.5" />
                <p>Everything looks perfect! Ready for the solver.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {validation.errors.map((error, i) => (
                  <div key={i} className="p-3 bg-red-400/10 border border-red-400/20 rounded-xl text-red-400 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="glass-card">
            <div className="flex items-center gap-3 mb-4">
               <div className="p-2 bg-white/10 rounded-lg">
                 <Box className="w-5 h-5 text-white" />
               </div>
               <h3 className="font-bold">Piece Count</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
               {colors.map(color => {
                 const count = Object.values(state).flat(2).filter(c => c === color).length;
                 return (
                    <div key={color} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 text-xs">
                        <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: COLOR_MAP[color] }} />
                        <span className={count === 9 ? 'text-zinc-400' : 'text-ruby-orange font-bold'}>{count}/9</span>
                    </div>
                 );
               })}
            </div>
          </section>
        </aside>

        {/* Center Panel: 3D Model Room */}
        <main className="lg:col-span-6 relative group">
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-[3rem] -z-10" />
          <div className="h-full min-h-[500px] flex items-center justify-center relative">
            <twisty-player
              ref={twistyPlayerRef}
              className="w-full h-full block"
              puzzle="3x3x3"
              control-panel="none"
              background="none"
              experimental-stickering={cubeStateToDefinition(state)}
            ></twisty-player>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 glass rounded-full shadow-2xl">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest whitespace-nowrap">Interactive Review</p>
              <div className="w-px h-4 bg-white/10" />
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-2 text-sm font-bold transition-all px-4 py-2 rounded-xl ${
                    isEditing ? 'bg-white text-black scale-105' : 'hover:text-white'
                }`}
              >
                <Edit3 className="w-4 h-4" /> {isEditing ? 'Finishing...' : 'Manual Edit'}
              </button>
            </div>
          </div>
        </main>

        {/* Right Panel: Manual Overrides */}
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
                <div className="flex items-center gap-3 mb-6">
                   <div className="p-2 bg-ruby-orange/20 rounded-lg">
                     <Palette className="w-5 h-5 text-ruby-orange" />
                   </div>
                   <h3 className="font-bold">Palette</h3>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-8">
                  {colors.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                        selectedColor === color 
                            ? 'bg-white/10 border-white/40 ring-1 ring-white/20' 
                            : 'border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-md shadow-lg" style={{ backgroundColor: COLOR_MAP[color] }} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">{color}</span>
                    </button>
                  ))}
                </div>

                <p className="text-[10px] text-zinc-500 font-bold uppercase text-center mb-6 tracking-widest">2D Face Editor</p>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8 pb-4">
                    {Object.keys(state).map((face) => (
                        <div key={face} className="space-y-4">
                            <h4 className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest text-center">{FACE_LABELS[face as keyof CubeState]}</h4>
                            <div className="flex justify-center">
                                <div className="grid grid-cols-3 gap-1">
                                    {state[face].flat().map((color, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleStickerClick(face, i)}
                                            style={{ backgroundColor: COLOR_MAP[color] }}
                                            className="w-8 h-8 rounded-md border border-black/20 shadow-inner active:scale-90 transition-transform"
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
                        <div className="w-16 h-16 rounded-[2rem] bg-ruby-blue/10 border border-ruby-blue/20 flex items-center justify-center">
                            <Box className="w-8 h-8 text-ruby-blue" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-heading font-extrabold">State Verified</h3>
                            <p className="text-sm text-zinc-400">The 3D model on the left represents the scanned cube. If anything is wrong, use Edit Mode.</p>
                        </div>
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="text-xs font-bold text-white/40 hover:text-white transition-colors underline underline-offset-4"
                        >
                            Enter manual correction
                        </button>
                    </div>
                    
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 text-center">Reference Face</p>
                        <p className="text-xs text-center text-zinc-400">Front Center should be <span className="font-bold text-ruby-green">Green</span></p>
                    </div>
                </motion.section>
            )}
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}
