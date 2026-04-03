import { experimentalSolveTwips as solve } from 'cubing/search';
import { cubeStateToDefinition } from './cubeUtils';

self.onmessage = async (e) => {
  const { cubeState } = e.data;
  try {
    const def = cubeStateToDefinition(cubeState);
    const result = await solve(def);
    self.postMessage({ solution: result.toString().split(' ').filter(m => m.length > 0) });
  } catch (err) {
    self.postMessage({ error: 'Failed to find a solution. Please check the cube state.' });
  }
};
