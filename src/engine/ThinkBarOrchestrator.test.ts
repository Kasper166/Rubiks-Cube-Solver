import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orchestrateThinkBar, ThinkBarProgress } from './ThinkBarOrchestrator';
import { INITIAL_CUBE_STATE, CubeState } from '../lib/cubeUtils';

// Mock validateCubeState inside cubeUtils
vi.mock('../lib/cubeUtils', async () => {
  const actual = await vi.importActual('../lib/cubeUtils');
  return {
    ...actual,
    validateCubeState: vi.fn((state: any) => {
        // Quick mock logic: if U is all red, it's invalid. Else valid.
        if (state.U[0][0] === 'red') {
            return { isValid: false, errors: ['Invalid'] };
        }
        return { isValid: true, errors: [] };
    }),
  };
});

describe('ThinkBarOrchestrator', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should immediately return invalid and empty solution if validation fails', async () => {
    const invalidState: CubeState = JSON.parse(JSON.stringify(INITIAL_CUBE_STATE));
    invalidState.U[0][0] = 'red'; // Trigger the mock rejection

    const mockProgress = vi.fn();
    
    // Use an incredibly short timeout to prevent hanging, or fake timers
    vi.useFakeTimers();
    
    const promise = orchestrateThinkBar(invalidState, null, mockProgress, 1);
    
    // We must advance timers to get through sleep() inside runValidation
    await vi.runAllTimersAsync();
    
    const result = await promise;

    expect(result.isValid).toBe(false);
    expect(result.solution).toHaveLength(0);
    
    // Check progress was called indicating validation failed
    expect(mockProgress).toHaveBeenCalledWith(expect.objectContaining({
      phaseLabel: 'Validation Failed',
    }));

    vi.useRealTimers();
  });

});
