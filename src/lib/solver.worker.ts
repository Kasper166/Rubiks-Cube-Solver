/**
 * Solver Worker — Phase 2/3 Orchestration Background logic.
 * 
 * This worker wraps the Kociemba algorithm from the cubing/search library.
 * It's used for standalone solve tasks outside of the multi-orientation pool.
 */

import { experimentalSolve3x3x3IgnoringCenters as solve } from 'cubing/search';
import { cubeStateToDefinition, CubeState } from './cubeUtils';

const ctx: Worker = self as any;

ctx.onmessage = async (e: MessageEvent<{ cubeState: CubeState }>) => {
  const { cubeState } = e.data;
  
  try {
    // Convert 2D color state to Kociemba facelet string
    const definition = cubeStateToDefinition(cubeState);
    
    // Kociemba search is computationally expensive; run in background
    console.log('Worker starting search for definition:', definition);
    
    const result = await solve(definition as any);
    const moves = result.toString().split(' ').filter(m => m.length > 0);
    
    ctx.postMessage({ 
      success: true,
      solution: moves,
      moveCount: moves.length 
    });
  } catch (err) {
    console.error('Solver worker error:', err);
    ctx.postMessage({ 
      success: false,
      error: err instanceof Error ? err.message : 'Could not find a solution. Please check the cube state colors for logical consistency (e.g. piece parity).' 
    });
  }
};
