/**
 * ThinkBarOrchestrator — The 20-second "Wow Factor" sequence.
 * 
 * Phase 1 (0–5s):  SymmetryValidator — parity and corner legality checks
 * Phase 2 (5–15s): Kociemba solver × multiple orientations → find shortest path
 * Phase 3 (15–20s): Ghost Solve animation at 5× speed
 */

import type { ThreeCube } from './ThreeCube';
import type { CubeStateManager } from './CubeStateManager';
import { validateCubeState, cubeStateToDefinition, CubeState } from '../lib/cubeUtils';

export interface ThinkBarProgress {
  phase: 1 | 2 | 3;
  phaseLabel: string;
  progress: number; // 0..1
  detail: string;
  checks?: { name: string; passed: boolean }[];
  bestMoveCount?: number;
  orientationsTested?: number;
  totalOrientations?: number;
}

export type ProgressCallback = (progress: ThinkBarProgress) => void;

/**
 * Sleep helper that respects cancellation.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Phase 1: SymmetryValidator
 * Runs validation checks with animated reveals over 5 seconds.
 */
async function runValidation(
  cubeState: CubeState,
  onProgress: ProgressCallback
): Promise<boolean> {
  const checks: { name: string; passed: boolean }[] = [];

  // Simulate progressive check reveals
  const validationChecks = [
    { name: 'Sticker Count', delay: 600 },
    { name: 'Center Integrity', delay: 800 },
    { name: 'Edge Parity', delay: 1000 },
    { name: 'Corner Parity', delay: 800 },
    { name: 'Orientation Sum', delay: 600 },
    { name: 'Permutation Parity', delay: 700 },
  ];

  const result = validateCubeState(cubeState);

  for (let i = 0; i < validationChecks.length; i++) {
    const check = validationChecks[i];
    await sleep(check.delay);

    // Map validation results to individual checks
    const passed = i < 2
      ? result.errors.filter(e => e.includes('sticker') || e.includes('center')).length === 0
      : i < 4
        ? result.errors.filter(e => e.includes('edge') || e.includes('corner')).length === 0
        : result.isValid;

    checks.push({ name: check.name, passed });

    onProgress({
      phase: 1,
      phaseLabel: 'Symmetry Validation',
      progress: (i + 1) / validationChecks.length,
      detail: `Checking ${check.name}...`,
      checks: [...checks],
    });
  }

  return result.isValid;
}

/**
 * Phase 2: Multi-orientation Kociemba solver
 * Spawns workers to find the absolute shortest solution.
 */
async function runParallelSolver(
  cubeState: CubeState,
  numOrientations: number,
  onProgress: ProgressCallback
): Promise<string[]> {
  const definition = cubeStateToDefinition(cubeState);
  const NUM_WORKERS = Math.min(4, navigator.hardwareConcurrency || 2);

  let bestSolution: string[] = [];
  let bestMoveCount = Infinity;
  let completedCount = 0;

  return new Promise<string[]>((resolve) => {
    const workers: Worker[] = [];

    // Create worker pool
    for (let i = 0; i < NUM_WORKERS; i++) {
      const worker = new Worker(
        new URL('./solverPool.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (e) => {
        const { success, moves, moveCount, orientationIndex } = e.data;

        completedCount++;

        if (success && moveCount < bestMoveCount) {
          bestMoveCount = moveCount;
          bestSolution = moves;
        }

        onProgress({
          phase: 2,
          phaseLabel: 'Path Optimization',
          progress: completedCount / numOrientations,
          detail: `Testing orientation ${completedCount}/${numOrientations}... Best: ${
            bestMoveCount === Infinity ? '--' : bestMoveCount
          } moves`,
          bestMoveCount: bestMoveCount === Infinity ? undefined : bestMoveCount,
          orientationsTested: completedCount,
          totalOrientations: numOrientations,
        });

        if (completedCount >= numOrientations) {
          // Terminate all workers
          workers.forEach(w => w.terminate());
          resolve(bestSolution);
        }
      };

      worker.onerror = (event) => {
        console.error('Solver worker error:', event.message);
        completedCount++;
        if (completedCount >= numOrientations) {
          workers.forEach(w => w.terminate());
          resolve(bestSolution);
        }
      };

      workers.push(worker);
    }

    // Distribute tasks across workers
    for (let i = 0; i < numOrientations; i++) {
      const workerIdx = i % NUM_WORKERS;
      workers[workerIdx].postMessage({
        cubeDefinition: definition,
        orientationIndex: i,
        taskId: `solve-${i}`,
      });
    }

    // Safety timeout — resolve after 12 seconds regardless
    setTimeout(() => {
      if (completedCount < numOrientations) {
        workers.forEach(w => w.terminate());
        resolve(bestSolution.length > 0 ? bestSolution : []);
      }
    }, 12000);
  });
}

/**
 * Phase 3: Ghost Solve
 * Animates a translucent cube solving at 5× speed.
 */
async function runGhostSolve(
  threeCube: ThreeCube | null,
  solution: string[],
  onProgress: ProgressCallback
): Promise<void> {
  if (!threeCube || solution.length === 0) {
    // Still animate the progress for UX
    for (let i = 0; i <= 20; i++) {
      await sleep(250);
      onProgress({
        phase: 3,
        phaseLabel: 'Ghost Solve',
        progress: i / 20,
        detail: solution.length === 0
          ? 'No solution available for ghost preview'
          : `Rendering move ${Math.floor((i / 20) * solution.length)}/${solution.length}`,
      });
    }
    return;
  }

  onProgress({
    phase: 3,
    phaseLabel: 'Ghost Solve',
    progress: 0,
    detail: 'Starting ghost solve preview...',
  });

  // Execute moves at 5× speed
  const totalMoves = solution.length;
  let completed = 0;

  for (const move of solution) {
    await threeCube.executeMove(move, 0.07); // ~70ms per move at 5×
    completed++;
    onProgress({
      phase: 3,
      phaseLabel: 'Ghost Solve',
      progress: completed / totalMoves,
      detail: `Ghost solving... ${completed}/${totalMoves} moves`,
    });
  }
}

/**
 * Main orchestration function.
 * Runs the full 20-second Think Bar sequence.
 * 
 * @returns The optimal solution moves array
 */
export async function orchestrateThinkBar(
  cubeState: CubeState,
  threeCube: ThreeCube | null,
  onProgress: ProgressCallback,
  numOrientations: number = 8
): Promise<{ solution: string[]; isValid: boolean }> {
  // Phase 1: Validation (0-5s)
  const isValid = await runValidation(cubeState, onProgress);

  if (!isValid) {
    onProgress({
      phase: 1,
      phaseLabel: 'Validation Failed',
      progress: 1,
      detail: 'Cube state is invalid. Please go back and correct the colors.',
    });
    return { solution: [], isValid: false };
  }

  // Phase 2: Multi-orientation solving (5-15s)
  const solution = await runParallelSolver(
    cubeState,
    numOrientations,
    onProgress
  );

  // Phase 3: Ghost Solve (15-20s)
  await runGhostSolve(threeCube, solution, onProgress);

  return { solution, isValid: true };
}
