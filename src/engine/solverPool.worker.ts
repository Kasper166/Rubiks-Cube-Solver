/**
 * Solver Pool Worker — Runs Kociemba's algorithm with orientation offsets.
 * 
 * Receives a cube definition string + orientation index,
 * solves it, and returns the solution + move count.
 */

import { experimentalSolve3x3x3IgnoringCenters as solve } from 'cubing/search';
import { faceletsToKPattern } from '../lib/cubeUtils';

const ctx: Worker = self as any;

ctx.onmessage = async (e) => {
  const { cubeDefinition, orientationIndex, taskId } = e.data;

  try {
    // Convert facelet string to KPattern
    const pattern = await faceletsToKPattern(cubeDefinition);

    // TODO: Apply orientation rotation if needed (feature enhancement)
    // For now, we fix the API crash by passing a KPattern
    const result = await solve(pattern);
    const moves = result.toString().split(' ').filter((m: string) => m.length > 0);
    
    ctx.postMessage({
      taskId,
      orientationIndex,
      success: true,
      moves,
      moveCount: moves.length,
    });
  } catch (err) {
    ctx.postMessage({
      taskId,
      orientationIndex,
      success: false,
      error: err instanceof Error ? err.message : 'Unknown solver error',
      moves: [],
      moveCount: Infinity,
    });
  }
};
