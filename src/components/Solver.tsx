
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, List } from 'lucide-react';
import { CubeState } from '../lib/cubeUtils';

// Import cubing.js elements
import 'cubing/twisty';

interface SolverProps {
  cubeState: CubeState;
  onReset: () => void;
}

export default function Solver({ cubeState, onReset }: SolverProps) {
  const [solution, setSolution] = useState<string[]>([]);
  const [isSolving, setIsSolving] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const twistyRef = useRef<any>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../lib/solver.worker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
      if (e.data.solution) {
        setSolution(e.data.solution);
      } else if (e.data.error) {
        setError(e.data.error);
      }
      setIsSolving(false);
    };

    worker.onerror = () => {
      setError('An unexpected error occurred with the solver.');
      setIsSolving(false);
    };

    worker.postMessage({ cubeState });

    return () => {
      worker.terminate();
    };
  }, [cubeState]);

  const handlePlay = () => {
    if (twistyRef.current) {
        twistyRef.current.play();
    }
  };

  const handlePause = () => {
    if (twistyRef.current) {
        twistyRef.current.pause();
    }
  };

  const handleStepForward = () => {
    if (twistyRef.current) {
        twistyRef.current.timestamp += 1000; // Exact timing might need adjustment
    }
  };

  const handleStepBackward = () => {
    if (twistyRef.current) {
        twistyRef.current.timestamp -= 1000;
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-zinc-950 text-white p-4 pb-24">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Solution</h2>
          <p className="text-zinc-400">Follow the moves to solve your cube</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-zinc-900 rounded-3xl p-4 aspect-square border border-zinc-800 shadow-2xl flex flex-col">
            <div className="flex-1 w-full">
                <twisty-player
                    ref={twistyRef}
                    style={{ width: '100%', height: '100%' }}
                    alg={solution.join(' ')}
                    background="none"
                    control-panel="none"
                />
            </div>
            
            <div className="flex items-center justify-center gap-4 p-4 border-t border-zinc-800">
                <button onClick={handleStepBackward} className="p-3 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors">
                    <SkipBack className="w-5 h-5 fill-current" />
                </button>
                <button onClick={() => { if(twistyRef.current) twistyRef.current.timestamp = 0; }} className="p-3 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors">
                    <RotateCcw className="w-5 h-5" />
                </button>
                <button onClick={handlePlay} className="p-4 rounded-full bg-white text-black hover:bg-zinc-200 transition-colors">
                    <Play className="w-6 h-6 fill-current" />
                </button>
                <button onClick={handlePause} className="p-4 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors">
                    <Pause className="w-6 h-6 fill-current" />
                </button>
                <button onClick={handleStepForward} className="p-3 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors">
                    <SkipForward className="w-5 h-5 fill-current" />
                </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 h-full flex flex-col">
              <h3 className="font-bold flex items-center gap-2 mb-4">
                <List className="w-5 h-5" />
                Move Sequence ({solution.length} moves)
              </h3>
              
              {isSolving ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                    <p className="text-zinc-400 animate-pulse">Calculating optimal solution...</p>
                </div>
              ) : error ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 p-8">
                    <div className="p-4 bg-red-500/10 rounded-full">
                        <RotateCcw className="w-8 h-8 text-red-500" />
                    </div>
                    <p className="text-red-400">{error}</p>
                    <button onClick={onReset} className="text-sm font-bold underline">Try scanning again</button>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="grid grid-cols-4 gap-2">
                        {solution.map((move, i) => (
                            <div key={i} className="bg-zinc-800 p-3 rounded-xl text-center font-mono font-bold hover:bg-zinc-700 transition-colors cursor-default border border-zinc-700/50">
                                <span className="block text-[10px] text-zinc-500 mb-1">{i + 1}</span>
                                {move}
                            </div>
                        ))}
                    </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-800 flex items-center justify-center">
          <button
            onClick={onReset}
            className="px-12 py-4 rounded-2xl bg-zinc-900 border border-zinc-800 font-bold hover:bg-zinc-800 transition-colors"
          >
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
}
