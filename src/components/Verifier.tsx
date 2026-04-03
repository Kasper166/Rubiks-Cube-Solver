import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Check, AlertCircle, Palette, RefreshCw } from 'lucide-react';
import { CubeState, CubeColor, COLOR_MAP, validateCubeState, ValidationResult, cubeStateToDefinition } from '../lib/cubeUtils';

// Import and register the twisty-player custom element
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
  const twistyPlayerRef = useRef<HTMLElement>(null);

  const colors: CubeColor[] = Object.keys(COLOR_MAP) as CubeColor[];

  useEffect(() => {
    const result = validateCubeState(state);
    setValidation(result);

    if (twistyPlayerRef.current) {
        const stickering = cubeStateToDefinition(state);
        twistyPlayerRef.current.setAttribute('experimental-stickering', stickering);
    }
  }, [state]);

  const handleStickerClick = (face: keyof CubeState, stickerIndex: number) => {
    if (!isEditing) return;
    
    const r = Math.floor(stickerIndex / 3);
    const c = stickerIndex % 3;

    if (state[face][r][c] !== selectedColor) {
      const newState = JSON.parse(JSON.stringify(state)); // Deep copy
      newState[face][r][c] = selectedColor;
      setState(newState);
    }
  };

  const renderFace = (face: keyof CubeState) => (
    <div className="grid grid-cols-3 gap-0.5">
      {state[face].flat().map((color, i) => (
        <div
          key={i}
          onClick={() => handleStickerClick(face, i)}
          className="w-6 h-6 sm:w-8 sm:h-8 rounded-sm cursor-pointer transition-transform active:scale-90"
          style={{ backgroundColor: COLOR_MAP[color] }}
        ></div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col items-center min-h-screen bg-zinc-950 text-white p-4 pb-24">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Verify State</h2>
          <p className="text-zinc-400">Confirm the 3D model matches your cube, or use Edit Mode to fix it.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="bg-zinc-900 rounded-3xl p-4 sm:p-8 aspect-square flex items-center justify-center border border-zinc-800 shadow-2xl">
            <twisty-player
                ref={twistyPlayerRef}
                puzzle="3x3x3"
                visualization="experimental-3D"
                control-panel="none"
                experimental-stickering={cubeStateToDefinition(state)}
            ></twisty-player>
          </div>

          <div className="space-y-6">
            <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2"><Palette className="w-5 h-5" /> Color Palette</h3>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isEditing ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {isEditing ? 'Finish Editing' : 'Edit Mode'}
                </button>
              </div>

              {isEditing && (
                <div className="flex flex-wrap gap-3">
                  {colors.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        selectedColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: COLOR_MAP[color] }}
                    />
                  ))}
                </div>
              )}
              {isEditing && <p className="text-xs text-zinc-400">Click a sticker on the 2D view below to change its color.</p>}
            </div>

            <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 space-y-4">
              <h3 className="font-bold flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Validation</h3>
              {validation.isValid ? (
                <div className="text-green-400 bg-green-400/10 p-3 rounded-lg text-sm flex items-center gap-2">
                  <Check /> Cube state is valid and solvable!
                </div>
              ) : (
                <div className="space-y-2">
                  {validation.errors.map((error, i) => (
                    <p key={i} className="text-xs text-red-400 bg-red-400/10 p-2 rounded-md">{error}</p>
                  ))}
                </div>
              )}
            </div>
            
            {isEditing && (
              <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 space-y-2">
                 <h3 className="text-sm font-bold text-zinc-400">2D Edit View</h3>
                 <div className="grid grid-cols-4 gap-2">
                    <div />
                    <div className="flex justify-center">{renderFace('U')}</div>
                    <div />
                    <div />

                    <div className="flex justify-center">{renderFace('L')}</div>
                    <div className="flex justify-center">{renderFace('F')}</div>
                    <div className="flex justify-center">{renderFace('R')}</div>
                    <div className="flex justify-center">{renderFace('B')}</div>

                    <div />
                    <div className="flex justify-center">{renderFace('D')}</div>
                    <div />
                    <div />
                 </div>
              </div>
            )}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-800 flex items-center justify-center gap-4">
          <button
            onClick={onBack}
            className="px-8 py-4 rounded-2xl bg-zinc-900 border border-zinc-800 font-bold hover:bg-zinc-800 transition-colors"
          >
            Rescan
          </button>
          <button
            onClick={() => onConfirm(state)}
            disabled={!validation.isValid}
            className="flex-1 max-w-xs py-4 rounded-2xl bg-white text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors shadow-xl"
          >
            <Check className="w-6 h-6" />
            Confirm and Solve
          </button>
        </div>
      </div>
    </div>
  );
}
