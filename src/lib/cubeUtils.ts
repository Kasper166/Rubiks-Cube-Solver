
export type FaceName = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
export type CubeColor = 'white' | 'red' | 'green' | 'yellow' | 'orange' | 'blue';

export const FACE_ORDER: FaceName[] = ['U', 'F', 'R', 'B', 'L', 'D'];

export const ROTATION_GUIDANCE: Record<FaceName, { text: string; alg: string }> = {
  U: { text: "Scan the Top face", alg: "" },
  F: { text: "Rotate cube DOWN to show Front", alg: "x" },
  R: { text: "Rotate cube LEFT to show Right", alg: "y" },
  B: { text: "Rotate cube LEFT to show Back", alg: "y" },
  L: { text: "Rotate cube LEFT to show Left", alg: "y" },
  D: { text: "Rotate cube DOWN to show Bottom", alg: "z2 x" }, // This is a bit complex, might need better logic
};

// Simplified fixed rotation sequence: 
// 1. U (White)
// 2. F (Green) - rotate x
// 3. R (Red) - rotate y
// 4. B (Blue) - rotate y
// 5. L (Orange) - rotate y
// 6. D (Yellow) - rotate x twice from F or x' from B?
// Let's use a more standard sequence: F, R, B, L, U, D

export const COLOR_MAP: Record<CubeColor, string> = {
  white: '#FFFFFF',
  red: '#B7121F',
  green: '#009B48',
  yellow: '#FFD500',
  orange: '#FF5800',
  blue: '#0046AD',
};

export const FACE_LABELS: Record<FaceName, string> = {
  U: 'Up (White Center)',
  R: 'Right (Red Center)',
  F: 'Front (Green Center)',
  D: 'Down (Yellow Center)',
  L: 'Left (Orange Center)',
  B: 'Back (Blue Center)',
};

export interface CubeState {
  [face: string]: CubeColor[][];
}

export const INITIAL_CUBE_STATE: CubeState = {
  U: Array(3).fill(null).map(() => Array(3).fill('white')),
  R: Array(3).fill(null).map(() => Array(3).fill('red')),
  F: Array(3).fill(null).map(() => Array(3).fill('green')),
  D: Array(3).fill(null).map(() => Array(3).fill('yellow')),
  L: Array(3).fill(null).map(() => Array(3).fill('orange')),
  B: Array(3).fill(null).map(() => Array(3).fill('blue')),
};

export function detectColor(r: number, g: number, b: number): CubeColor {
  const hsv = rgbToHsv(r, g, b);
  const h = hsv.h * 360;
  const s = hsv.s * 100;
  const v = hsv.v * 100;

  // White: Low saturation, high value
  if (s < 25 && v > 65) return 'white';
  
  // High saturation / value colors
  if (v < 15) return 'blue'; // Very dark

  if (h < 15 || h > 345) return 'red';
  if (h >= 15 && h < 45) return 'orange';
  if (h >= 45 && h < 65) return 'yellow';
  if (h >= 65 && h < 165) return 'green';
  if (h >= 165 && h < 265) return 'blue';
  
  return 'white'; // Fallback
}

function rgbToHsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, v };
}

export function cubeStateToDefinition(state: CubeState): string {
  // Map each color to the face it represents (based on center stickers)
  const colorToFace: Record<string, string> = {};
  for (const face of FACE_ORDER) {
    colorToFace[state[face][1][1]] = face;
  }

  let def = '';
  for (const face of FACE_ORDER) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const color = state[face][r][c];
        def += colorToFace[color] || 'U';
      }
    }
  }
  return def;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Helper to sort colors in a piece for consistent representation
const sortPieceColors = (colors: CubeColor[]): string => {
    return colors.sort().join('');
};

// Helper to get corner orientation
// 0: correctly oriented, 1: twisted clockwise, 2: twisted counter-clockwise
function getCornerOrientation(upDownFaceColor: CubeColor, cornerSticker: CubeColor, onUpDownFace: boolean): number {
    if (!onUpDownFace) {
        return 0; // The U/D color is on a side face, which we can define as oriented
    }
    // If the sticker on the U/D face is the U/D color, it's oriented.
    if (cornerSticker === upDownFaceColor) {
        return 0;
    }
    // This logic assumes a standard color scheme where F/B are twisted relative to L/R
    if (upDownFaceColor === 'white') { // Assuming U face is white
        if (cornerSticker === 'green' || cornerSticker === 'blue') return 1; // CW
        if (cornerSticker === 'red' || cornerSticker === 'orange') return 2; // CCW
    } else if (upDownFaceColor === 'yellow') { // Assuming D face is yellow
        if (cornerSticker === 'green' || cornerSticker === 'blue') return 1; // CW
        if (cornerSticker === 'red' || cornerSticker === 'orange') return 2; // CCW
    }
    return 1; // Default twisted
}

export function validateCubeState(state: CubeState): ValidationResult {
    const errors: string[] = [];
    const colorCounts: Record<CubeColor, number> = {
        white: 0, red: 0, green: 0, yellow: 0, orange: 0, blue: 0
    };

    // 1. Sticker Count
    for (const face of FACE_ORDER) {
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                colorCounts[state[face][r][c] as CubeColor]++;
            }
        }
    }
    const colorCountErrors = Object.entries(colorCounts)
        .filter(([, count]) => count !== 9)
        .map(([color]) => `Invalid number of ${color} stickers (should be 9)`);
    errors.push(...colorCountErrors);

    // 2. Center Pieces
    const centerColors = new Set<CubeColor>();
    for (const face of FACE_ORDER) {
        centerColors.add(state[face][1][1] as CubeColor);
    }
    if (centerColors.size !== 6) {
        errors.push('Invalid center pieces. Each center must be a unique color.');
    }

    // Define edges and corners by their sticker locations
    const EDGES = [
        sortPieceColors([state.U[1][2], state.R[0][1]] as CubeColor[]), sortPieceColors([state.U[2][1], state.F[0][1]] as CubeColor[]),
        sortPieceColors([state.U[1][0], state.L[0][1]] as CubeColor[]), sortPieceColors([state.U[0][1], state.B[0][1]] as CubeColor[]),
        sortPieceColors([state.D[1][2], state.R[2][1]] as CubeColor[]), sortPieceColors([state.D[2][1], state.F[2][1]] as CubeColor[]),
        sortPieceColors([state.D[1][0], state.L[2][1]] as CubeColor[]), sortPieceColors([state.D[0][1], state.B[2][1]] as CubeColor[]),
        sortPieceColors([state.F[1][2], state.R[1][0]] as CubeColor[]), sortPieceColors([state.F[1][0], state.L[1][2]] as CubeColor[]),
        sortPieceColors([state.B[1][0], state.R[1][2]] as CubeColor[]), sortPieceColors([state.B[1][2], state.L[1][0]] as CubeColor[]),
    ];

    const CORNERS = [
        sortPieceColors([state.U[2][2], state.R[0][2], state.F[0][2]] as CubeColor[]), sortPieceColors([state.U[2][0], state.F[0][0], state.L[0][2]] as CubeColor[]),
        sortPieceColors([state.U[0][0], state.L[0][0], state.B[0][2]] as CubeColor[]), sortPieceColors([state.U[0][2], state.B[0][0], state.R[0][0]] as CubeColor[]),
        sortPieceColors([state.D[2][2], state.F[2][2], state.R[2][2]] as CubeColor[]), sortPieceColors([state.D[2][0], state.L[2][2], state.F[2][0]] as CubeColor[]),
        sortPieceColors([state.D[0][0], state.B[2][2], state.L[2][0]] as CubeColor[]), sortPieceColors([state.D[0][2], state.R[2][0], state.B[2][0]] as CubeColor[]),
    ];

    // 3. Edge Piece Validation
    const edgeCounts = EDGES.reduce((acc, piece) => {
        acc[piece] = (acc[piece] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    let foundEdges = 0;
    for (const piece in edgeCounts) {
        foundEdges += edgeCounts[piece];
        if (edgeCounts[piece] > 1) {
            errors.push(`Duplicate edge piece found: ${piece.split('').join('-')}`);
        }
        // Check for impossible edges (e.g., white-yellow)
        if ((piece.includes('white') && piece.includes('yellow')) ||
            (piece.includes('green') && piece.includes('blue')) ||
            (piece.includes('red') && piece.includes('orange'))) {
            errors.push(`Impossible edge piece found: ${piece.split('').join('-')}`);
        }
    }
    if (foundEdges !== 12) {
        errors.push(`Invalid number of unique edge pieces found: ${foundEdges}/12`);
    }
    
    // 4. Corner Piece Validation
    const cornerCounts = CORNERS.reduce((acc, piece) => {
        acc[piece] = (acc[piece] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    
    let foundCorners = 0;
    for (const piece in cornerCounts) {
        foundCorners += cornerCounts[piece];
        if (cornerCounts[piece] > 1) {
            errors.push(`Duplicate corner piece found: ${piece.split('').join('-')}`);
        }
        // Check for impossible corners
        if ((piece.includes('white') && piece.includes('yellow')) ||
            (piece.includes('green') && piece.includes('blue')) ||
            (piece.includes('red') && piece.includes('orange'))) {
            errors.push(`Impossible corner piece found: ${piece.split('').join('-')}`);
        }
    }
    if (foundCorners !== 8) {
        errors.push(`Invalid number of unique corner pieces found: ${foundCorners}/8`);
    }

    // 5. Corner Orientation Parity
    let cornerOrientationSum = 0;
    cornerOrientationSum += getCornerOrientation('white', state.U[2][2] as CubeColor, true);
    cornerOrientationSum += getCornerOrientation('white', state.U[2][0] as CubeColor, true);
    cornerOrientationSum += getCornerOrientation('white', state.U[0][0] as CubeColor, true);
    cornerOrientationSum += getCornerOrientation('white', state.U[0][2] as CubeColor, true);
    cornerOrientationSum += getCornerOrientation('yellow', state.D[2][2] as CubeColor, true);
    cornerOrientationSum += getCornerOrientation('yellow', state.D[2][0] as CubeColor, true);
    cornerOrientationSum += getCornerOrientation('yellow', state.D[0][0] as CubeColor, true);
    cornerOrientationSum += getCornerOrientation('yellow', state.D[0][2] as CubeColor, true);
    if (cornerOrientationSum % 3 !== 0) {
        errors.push('Invalid corner orientation parity. One or more corners may be twisted.');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}
