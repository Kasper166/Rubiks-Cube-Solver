/**
 * Solver Worker — Phase 2/3 Orchestration Background logic.
 * 
 * This worker wraps the Kociemba algorithm from the cubing/search library.
 * It's updated to correctly handle the @cubing/search API which expects a KPattern.
 */

import { experimentalSolve3x3x3IgnoringCenters as solve } from 'cubing/search';
import { CubeState, cubeStateToDefinition, faceletsToKPattern } from './cubeUtils';

const ctx: Worker = self as any;

ctx.onmessage = async (e: MessageEvent<{ cubeState: CubeState }>) => {
  const { cubeState } = e.data;
  
  try {
    // 1. Convert 2D color state to facelet string
    const definition = cubeStateToDefinition(cubeState);
    
    // 2. Convert facelet string to KPattern
    console.log('Worker converting facelets to KPattern...');
    const pattern = await faceletsToKPattern(definition);
    
    // 3. Solve using @cubing/search
    console.log('Worker starting search...');
    const result = await solve(pattern);
    const moves = result.toString().split(' ').filter(m => m.length > 0);
    
    ctx.postMessage({
      success: true,
      moves: moves,
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
