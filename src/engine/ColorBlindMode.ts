/**
 * ColorBlindMode — Accessibility layer for the 3D cube.
 * 
 * Maps cube face colors to single-character labels (U/D/L/R/F/B)
 * that can be overlaid on Three.js facelet meshes.
 */

import type { FaceName } from './CubeStateManager';

/** Maps hex colors to face-letter labels */
export const COLOR_TO_FACE_LABEL: Record<string, FaceName> = {
  '#FFFFFF': 'U', // White → Up
  '#B7121F': 'R', // Red   → Right
  '#009B48': 'F', // Green → Front
  '#FFD500': 'D', // Yellow → Down
  '#FF5800': 'L', // Orange → Left
  '#0046AD': 'B', // Blue  → Back
};

/** Maps color names to face-letter labels */
export const COLOR_NAME_TO_LABEL: Record<string, FaceName> = {
  white:  'U',
  red:    'R',
  green:  'F',
  yellow: 'D',
  orange: 'L',
  blue:   'B',
};

/**
 * Get the face-letter label for a given hex color.
 * Returns '?' for unknown colors, '-' for null/grey.
 */
export function getFaceletLabel(hexColor: string | null): string {
  if (!hexColor || hexColor === '#808080') return '-';
  // Normalize to uppercase
  const normalized = hexColor.toUpperCase();
  return COLOR_TO_FACE_LABEL[normalized] ?? '?';
}

/**
 * Generate pattern descriptions for each color in screen-reader friendly format.
 */
export const COLOR_DESCRIPTIONS: Record<string, string> = {
  '#FFFFFF': 'Up face (White)',
  '#B7121F': 'Right face (Red)',
  '#009B48': 'Front face (Green)',
  '#FFD500': 'Down face (Yellow)',
  '#FF5800': 'Left face (Orange)',
  '#0046AD': 'Back face (Blue)',
  '#808080': 'Unscanned (Grey)',
};
