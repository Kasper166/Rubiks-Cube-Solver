import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CubeStateManager } from './CubeStateManager';
import { COLOR_HEX_MAP } from './CubeStateManager';

describe('CubeStateManager', () => {
  let manager: CubeStateManager;

  beforeEach(() => {
    manager = new CubeStateManager();
  });

  it('should initialize with an empty state and return false for isComplete', () => {
    expect(manager.isComplete()).toBe(false);
    // Spot check a default value
    const snapshot = manager.getSnapshot();
    expect(snapshot.faces['U'].scanned).toBe(false);
  });

  it('should correctly ingest face data and notify listeners', () => {
    const mockListener = vi.fn();
    manager.subscribe(mockListener);

    // Provide a grid of colors
    const colors = Array(3).fill(null).map(() => Array(3).fill('white'));
    manager.ingestFaceData('U', colors);

    expect(mockListener).toHaveBeenCalledTimes(1);
    const state = manager.getSnapshot();
    expect(state.faces['U'].scanned).toBe(true);
    expect(state.faces['U'].stickers[0][0].color).toBe(COLOR_HEX_MAP['white']);
  });

  it('should explicitly emit specific facelet changes', () => {
    const mockFaceletListener = vi.fn();
    manager.onFaceletChange(mockFaceletListener);

    // Initial is all null
    manager.manualOverride('R', 1, 1, 'red');

    // Should be called with old color null, new color red hex
    expect(mockFaceletListener).toHaveBeenCalledWith('R', 1, 1, null, COLOR_HEX_MAP['red']);
  });

  it('should properly track completeness, transitioning to true only when all 6 faces are scanned', () => {
    const faces: ('U' | 'D' | 'F' | 'B' | 'L' | 'R')[] = ['U', 'D', 'F', 'B', 'L', 'R'];
    const fakeData = Array(3).fill(null).map(() => Array(3).fill('green'));

    for (let i = 0; i < faces.length; i++) {
      expect(manager.isComplete()).toBe(false);
      manager.ingestFaceData(faces[i], fakeData);
    }
    
    // After all 6 are scanned
    expect(manager.isComplete()).toBe(true);
  });

  it('should output structurally correct legacy state', () => {
    const fakeData = Array(3).fill(null).map(() => Array(3).fill('blue'));
    manager.ingestFaceData('B', fakeData);

    const legacyState = manager.toLegacyState();
    
    expect(legacyState).toHaveProperty('B');
    expect(legacyState['B'][0][0]).toBe('blue');

    // Default missing face should be 'white' string instead of null in legacy output
    expect(legacyState).toHaveProperty('U');
    expect(legacyState['U'][0][0]).toBe('white');
  });

  it('should create a valid Kociemba definition string from state', () => {
    // Generate an already-solved mock
    const colorToFace = {
      white: 'U', red: 'R', green: 'F', yellow: 'D', orange: 'L', blue: 'B'
    };

    const definitions = [
      { face: 'U', color: 'white' },
      { face: 'R', color: 'red' },
      { face: 'F', color: 'green' },
      { face: 'D', color: 'yellow' },
      { face: 'L', color: 'orange' },
      { face: 'B', color: 'blue' }
    ] as const;

    definitions.forEach(def => {
      manager.ingestFaceData(def.face, Array(3).fill(null).map(() => Array(3).fill(def.color)));
    });

    // URFDLB ordered 9 chars per face
    const defStr = manager.toDefinitionString();
    expect(defStr).toBe('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
  });
});
