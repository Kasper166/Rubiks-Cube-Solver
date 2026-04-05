import { experimentalSolve3x3x3IgnoringCenters as solve } from 'cubing/search';
import { cubeStateToDefinition } from './cubeUtils';

const ctx: Worker = self as any;

ctx.onmessage = async (e) => {
  const { cubeState } = e.data;
  try {
    const def = cubeStateToDefinition(cubeState);
    const result = await solve(def as any);
    ctx.postMessage({ 
      solution: result.toString().split(' ').filter(m => m.length > 0) 
    });
  } catch (err) {
    let errorMessage = 'Failed to find a solution. The cube state may be invalid or unsolvable.';
    if (err instanceof Error) {
      errorMessage = err.message;
    }
    ctx.postMessage({ error: errorMessage });
  }
};
