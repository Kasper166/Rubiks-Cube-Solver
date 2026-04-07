import { describe, it, expect } from 'vitest';
import { detectGlare } from './GlareDetector';

describe('GlareDetector', () => {

  it('should detect glare in images with high bright pixel ratio', () => {
    // Manually create mock ImageData
    // a 10x10 image = 100 pixels
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);

    // Fill with very bright pixels (glare)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 250;     // R
      data[i + 1] = 250; // G
      data[i + 2] = 250; // B
      data[i + 3] = 255; // A
    }

    const imgData = new ImageData(data, width, height);

    const result = detectGlare(imgData, 10, 240);
    
    // We expect it to strongly flag glare since 100% of pixels exceed 240
    expect(result.hasGlare).toBe(true);
    expect(result.intensity).toBeGreaterThan(0.5);
  });

  it('should not false positive on normal bright colors', () => {
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);

    // Normal bright colors, NOT highlights (e.g. skin tone or soft white)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 220;     // R
      data[i + 1] = 210; // G
      data[i + 2] = 200; // B
      data[i + 3] = 255; // A
    }

    const imgData = new ImageData(data, width, height);

    // Threshold is 240, so 220 should not trigger it
    const result = detectGlare(imgData, 10, 240);
    
    // Non-glare
    expect(result.hasGlare).toBe(false);
    expect(result.intensity).toBe(0);
  });
});
