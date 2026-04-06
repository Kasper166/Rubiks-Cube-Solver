/**
 * GlareDetector — Analyzes camera feed for specular highlights
 * that could degrade color-detection accuracy.
 *
 * Works on the V (value/brightness) channel of HSV color space.
 * Pixels with V > threshold are flagged as glare.
 */

export interface GlareResult {
  hasGlare: boolean;
  intensity: number; // 0..1 — ratio of glare pixels
  affectedCells: [number, number][]; // [row, col] grid cells with glare
  maxBrightness: number;
}

/**
 * Analyze a region of an ImageData for glare.
 * @param imageData - Raw pixel data from canvas
 * @param gridSize  - Grid dimension (3 for a 3×3 cube face)
 * @param threshold - V-channel threshold (0–255), default 240
 */
export function detectGlare(
  imageData: ImageData,
  gridSize: number = 3,
  threshold: number = 240
): GlareResult {
  const { data, width, height } = imageData;
  const cellW = Math.floor(width / gridSize);
  const cellH = Math.floor(height / gridSize);

  let totalGlarePixels = 0;
  let totalPixels = 0;
  let maxBrightness = 0;
  const affectedCells: [number, number][] = [];

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const startX = col * cellW;
      const startY = row * cellH;
      let cellGlare = 0;
      let cellTotal = 0;

      // Sample the center 60% of each cell to avoid edge artifacts
      const marginX = Math.floor(cellW * 0.2);
      const marginY = Math.floor(cellH * 0.2);

      for (let y = startY + marginY; y < startY + cellH - marginY; y++) {
        for (let x = startX + marginX; x < startX + cellW - marginX; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // V channel = max(R, G, B)
          const v = Math.max(r, g, b);
          if (v > maxBrightness) maxBrightness = v;

          if (v > threshold) {
            cellGlare++;
            totalGlarePixels++;
          }
          cellTotal++;
          totalPixels++;
        }
      }

      // If >15% of the cell is glare, mark it
      if (cellTotal > 0 && cellGlare / cellTotal > 0.15) {
        affectedCells.push([row, col]);
      }
    }
  }

  const intensity = totalPixels > 0 ? totalGlarePixels / totalPixels : 0;

  return {
    hasGlare: intensity > 0.05 || affectedCells.length > 0,
    intensity,
    affectedCells,
    maxBrightness,
  };
}
