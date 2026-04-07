import { describe, it, expect } from 'vitest';
import { 
  detectColor, 
  validateCubeState, 
  INITIAL_CUBE_STATE, 
  CubeState,
  faceletsToKPattern,
  cubeStateToDefinition
} from './cubeUtils';

describe('cubeUtils', () => {

  describe('detectColor', () => {
    it('should explicitly classify pure colors correctly based on HSV', () => {
      // White: 255, 255, 255
      expect(detectColor(255, 255, 255)).toBe('white');
      // Red: 255, 0, 0
      expect(detectColor(255, 0, 0)).toBe('red');
      // Green: 0, 255, 0
      expect(detectColor(0, 255, 0)).toBe('green');
      // Blue: 0, 0, 255
      expect(detectColor(0, 0, 255)).toBe('blue');
      // Yellow: 255, 255, 0
      expect(detectColor(255, 255, 0)).toBe('yellow');
      // Orange: 255, 128, 0 (Approx)
      expect(detectColor(255, 128, 0)).toBe('orange');
    });

    it('should gracefully handle dark variations and noise', () => {
      // Extremely dark yields blue fallback
      expect(detectColor(5, 5, 5)).toBe('blue');
      // High lightness with low saturation -> white
      expect(detectColor(240, 240, 240)).toBe('white');
      expect(detectColor(200, 210, 205)).toBe('white');
    });
  });

  describe('validateCubeState', () => {
    it('should validate an already resolved cube input configuration with no errors', () => {
      const result = validateCubeState(INITIAL_CUBE_STATE);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect incorrect sticker counts when a face has improper colors', () => {
      const badState: CubeState = JSON.parse(JSON.stringify(INITIAL_CUBE_STATE));
      badState.U[0][0] = 'red'; // Should be white, now there is 1 extra red and 1 missing white
      
      const result = validateCubeState(badState);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid number of white stickers (should be 9)');
      expect(result.errors).toContain('Invalid number of red stickers (should be 9)');
    });

    it('should detect impossible edge pieces (e.g. white-yellow)', () => {
      const badState: CubeState = JSON.parse(JSON.stringify(INITIAL_CUBE_STATE));
      // Modify U (White) and D (Yellow) to form an impossible adjacent edge
      // U[1][2], R[0][1] forms an edge. Let's make R[0][1] yellow.
      // Now we have a white-yellow edge.
      badState.R[0][1] = 'yellow';
      // Balance out the colors so sticker count passes, but wait, sticker count fails, which is fine.
      // We just want to check if impossible edge is detected.
      const result = validateCubeState(badState);
      expect(result.isValid).toBe(false);
      const hasImpossibleEdgeError = result.errors.some(e => e.includes('Impossible edge piece'));
      expect(hasImpossibleEdgeError).toBe(true);
    });

    it('should gracefully detect incorrect corner orientations', () => {
      const badState: CubeState = JSON.parse(JSON.stringify(INITIAL_CUBE_STATE));
      // Tweak a corner to twist it
      // U[2][2], R[0][2], F[0][2] is a corner.
      badState.U[2][2] = 'red';
      badState.R[0][2] = 'green';
      badState.F[0][2] = 'white';

      const result = validateCubeState(badState);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid corner orientation parity. One or more corners may be twisted.');
    });
  });

  describe('faceletsToKPattern', () => {
    // Tests cubing.js integration conversion logic dynamically
    it('should cleanly create KPattern from a valid facelet string without throwing', async () => {
      const def = cubeStateToDefinition(INITIAL_CUBE_STATE);
      // Usually "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"
      expect(def).toHaveLength(54);
      
      const kpattern = await faceletsToKPattern(def);
      expect(kpattern).toBeDefined();
      expect(typeof kpattern).toBe('object');
    });
  });

});
