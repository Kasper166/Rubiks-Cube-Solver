import { describe, it, expect } from 'vitest';
import { getFaceletLabel, COLOR_TO_FACE_LABEL } from './ColorBlindMode';

describe('ColorBlindMode', () => {

  describe('getFaceletLabel', () => {
    it('should return correct FaceLabel for known hex colors', () => {
      expect(getFaceletLabel('#FFFFFF')).toBe('U'); // White -> Up
      expect(getFaceletLabel('#B7121F')).toBe('R'); // Red -> Right
      expect(getFaceletLabel('#009B48')).toBe('F'); // Green -> Front
      expect(getFaceletLabel('#FFD500')).toBe('D'); // Yellow -> Down
      expect(getFaceletLabel('#FF5800')).toBe('L'); // Orange -> Left
      expect(getFaceletLabel('#0046AD')).toBe('B'); // Blue -> Back
    });

    it('should be case-insensitive to hex code variations', () => {
      expect(getFaceletLabel('#ffffff')).toBe('U'); // lowercase white
      expect(getFaceletLabel('#b7121f')).toBe('R'); 
    });

    it('should return "-" for null or grey (unscanned)', () => {
      expect(getFaceletLabel(null)).toBe('-');
      expect(getFaceletLabel('#808080')).toBe('-');
    });

    it('should return "?" for unknown hex colors', () => {
      expect(getFaceletLabel('#FF00FF')).toBe('?'); // Magenta
      expect(getFaceletLabel('#000000')).toBe('?'); // Black
    });
  });

});
