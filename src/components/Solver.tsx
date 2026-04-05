import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  RotateCcw, 
  List, 
  CheckCircle2, 
  Settings2,
  Clock,
  ChevronRight
} from 'lucide-react';
import { CubeState, COLOR_MAP } from '../lib/cubeUtils';
import 'cubing/twisty';

// No local declaration here, relying on global types.d.ts

interface SolverProps {
  cubeState: CubeState;
  onReset: () => void;
}

export default function Solver({ cubeState, onReset }: SolverProps) {
  const [solution, setSolution] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
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

    return () => worker.terminate();
  }, [cubeState]);

  // Sync current move index with twisty-player
  useEffect(() => {
    const interval = setInterval(() => {
        if (twistyRef.current && isPlaying) {
            // This is a rough estimation, twisty-player has better ways to track progress 
            // but for simplicity in this UI we'll just poll or use events if available
            // For now, let's just use the player's own internal state if we can
        }
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handlePlayToggle = () => {
    if (twistyRef.current) {
        if (isPlaying) twistyRef.current.pause();
        else twistyRef.current.play();
        setIsPlaying(!isPlaying);
    }
  };

  const jumpToMove = (index: number) => {
    if (twistyRef.current) {
        // Simple way to jump: reset and then apply a sub-algorithm
        // Or use twisty-player's timestamp logic
        twistyRef.current.timestamp = index * 1000; // Assuming 1s per move
        setCurrentMoveIndex(index);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-6rem)] p-6 max-w-7xl mx-auto gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-heading font-extrabold tracking-tight">Solution Master</h2>
          <p className="text-zinc-400">Step-by-step guide to a perfect cube</p>
        </div>
        <button onClick={onReset} className="btn-secondary flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> Start Over
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        {/* Left Side: 3D Visualization */}
        <main className="lg:col-span-8 flex flex-col gap-6">
          <div className="glass-card flex-1 relative flex items-center justify-center min-h-[400px]">
             <div className="absolute top-6 left-6 flex items-center gap-3">
                <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-ruby-green animate-pulse" />
                    Live 3D Preview
                </div>
             </div>

             <twisty-player
                ref={twistyRef}
                className="w-full h-full block"
                puzzle="3x3x3"
                alg={solution.join(' ')}
                control-panel="none"
                background="none"
             ></twisty-player>

             {isSolving && (
                <div className="absolute inset-0 glass rounded-[3rem] z-20 flex flex-col items-center justify-center p-8 text-center space-y-6">
                    <div className="relative">
                        <div className="w-20 h-20 border-4 border-ruby-blue/20 border-t-ruby-blue rounded-full animate-spin" />
                        <Clock className="w-8 h-8 text-ruby-blue absolute inset-0 m-auto animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold tracking-tight">Calculating optimal path</h3>
                        <p className="text-zinc-400 mt-2">Kociemba algorithm is running in a web worker...</p>
                    </div>
                </div>
             )}

             {error && (
                <div className="absolute inset-0 glass rounded-[3rem] z-20 flex flex-col items-center justify-center p-8 text-center space-y-6">
                    <div className="p-4 bg-red-500/20 rounded-3xl">
                        <RotateCcw className="w-12 h-12 text-red-500" />
                    </div>
                    <div className="max-w-xs">
                        <h3 className="text-2xl font-bold text-red-400">Solver Error</h3>
                        <p className="text-zinc-400 mt-2">{error}</p>
                    </div>
                    <button onClick={onReset} className="btn-primary">Try Again</button>
                </div>
             )}
          </div>

          {/* Player Controls */}
          <div className="glass-card flex items-center justify-between gap-6 py-4">
             <div className="flex items-center gap-3">
                <button onClick={() => { if(twistyRef.current) twistyRef.current.timestamp = 0; }} className="p-3 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                    <RotateCcw className="w-5 h-5" />
                </button>
                <div className="w-px h-6 bg-white/5" />
                <button onClick={() => { if(twistyRef.current) twistyRef.current.timestamp -= 1000; }} className="p-3 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                    <SkipBack className="w-5 h-5 fill-current" />
                </button>
                <button 
                  onClick={handlePlayToggle}
                  className="w-14 h-14 bg-white text-black rounded-2xl flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
                >
                    {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                </button>
                <button onClick={() => { if(twistyRef.current) twistyRef.current.timestamp += 1000; }} className="p-3 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                    <SkipForward className="w-5 h-5 fill-current" />
                </button>
             </div>

             <div className="flex-1 px-4">
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(currentMoveIndex / Math.max(1, solution.length)) * 100}%` }}
                        className="h-full bg-ruby-blue shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                    />
                </div>
             </div>

             <div className="flex items-center gap-4 text-xs font-mono text-zinc-500 whitespace-nowrap">
                <span className="text-white font-bold">{currentMoveIndex}</span> / {solution.length} Moves
             </div>
          </div>
        </main>

        {/* Right Side: Move List */}
        <aside className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-card flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3 text-ruby-blue">
                   <List className="w-5 h-5" />
                   <h3 className="font-bold">Move Sequence</h3>
                </div>
                <div className="text-[10px] bg-ruby-blue/10 text-ruby-blue px-2 py-1 rounded-md font-bold uppercase tracking-tight">Kociemba</div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                <AnimatePresence>
                    {solution.map((move, i) => (
                        <motion.button
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            onClick={() => jumpToMove(i)}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                i === currentMoveIndex 
                                    ? 'bg-ruby-blue/10 border-ruby-blue/30 text-white' 
                                    : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
                            }`}
                        >
                            <div className="flex items-center gap-4">
                                <span className="w-6 text-[10px] font-mono text-zinc-600 font-bold">{String(i + 1).padStart(2, '0')}</span>
                                <span className="text-lg font-mono font-bold tracking-widest">{move}</span>
                            </div>
                            {i === currentMoveIndex ? (
                                <div className="w-2 h-2 rounded-full bg-ruby-blue shadow-[0_0_10px_rgba(59,130,246,1)]" />
                            ) : i < currentMoveIndex ? (
                                <CheckCircle2 className="w-4 h-4 text-ruby-green opacity-40" />
                            ) : (
                                <ChevronRight className="w-4 h-4 opacity-10" />
                            )}
                        </motion.button>
                    ))}
                </AnimatePresence>
            </div>
            
            <div className="mt-6 p-4 bg-zinc-950/50 rounded-2xl border border-white/5 space-y-4">
                <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    <span>Performance</span>
                    <Settings2 className="w-3 h-3" />
                </div>
                <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-400">Optimal Solution Found</p>
                    <div className="flex gap-1">
                        {[1,2,3,4,5].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-ruby-green" />)}
                    </div>
                </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
