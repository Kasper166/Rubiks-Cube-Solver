import { KPattern } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

export type FaceName = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
export type CubeColor = 'white' | 'red' | 'green' | 'yellow' | 'orange' | 'blue';

export const FACE_ORDER: FaceName[] = ['U', 'F', 'R', 'B', 'L', 'D'];
export const KOCIEMBA_FACE_ORDER: FaceName[] = ['U', 'R', 'F', 'D', 'L', 'B'];

export const ROTATION_GUIDANCE: Record<FaceName, { text: string; alg: string }> = {
  U: { text: "Scan the Top face (White center)", alg: "" },
  F: { text: "Rotate DOWN to show Front (Green center)", alg: "x'" },
  R: { text: "Rotate LEFT to show Right (Red center)", alg: "y" },
  B: { text: "Rotate LEFT to show Back (Blue center)", alg: "y" },
  L: { text: "Rotate LEFT to show Left (Orange center)", alg: "y" },
  D: { text: "Rotate UP to show Bottom (Yellow center)", alg: "x" },
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
  for (const face of KOCIEMBA_FACE_ORDER) {
    colorToFace[state[face][1][1]] = face;
  }

  let def = '';
  // Standard Kociemba facelet string order: U, R, F, D, L, B
  for (const face of KOCIEMBA_FACE_ORDER) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const color = state[face][r][c];
        def += colorToFace[color] || 'U';
      }
    }
  }
  return def;
}

// Reid / Kociemba format piece mapping from cubing.js internals
const reidEdgeOrder = "UF UR UB UL DF DR DB DL FR FL BR BL".split(" ");
const reidCornerOrder = "UFR URB UBL ULF DRF DFL DLB DBR".split(" ");

// Map from facelet index to [orbit, piece_at_position, sticker_index]
const map: [number, number, number][] = [
  [1, 2, 0], [0, 2, 0], [1, 1, 0], [0, 3, 0], [2, 0, 0], [0, 1, 0], [1, 3, 0], [0, 0, 0], [1, 0, 0],
  [1, 0, 2], [0, 1, 1], [1, 1, 1], [0, 8, 1], [2, 3, 0], [0, 10, 1], [1, 4, 1], [0, 5, 1], [1, 7, 2],
  [1, 3, 2], [0, 0, 1], [1, 0, 1], [0, 9, 0], [2, 2, 0], [0, 8, 0], [1, 5, 1], [0, 4, 1], [1, 4, 2],
  [1, 5, 0], [0, 4, 0], [1, 4, 0], [0, 7, 0], [2, 5, 0], [0, 5, 0], [1, 6, 0], [0, 6, 0], [1, 7, 0],
  [1, 2, 2], [0, 3, 1], [1, 3, 1], [0, 11, 1], [2, 1, 0], [0, 9, 1], [1, 6, 1], [0, 7, 1], [1, 5, 2],
  [1, 1, 2], [0, 2, 1], [1, 2, 1], [0, 10, 0], [2, 4, 0], [0, 11, 0], [1, 7, 1], [0, 6, 1], [1, 6, 2]
];

function rotateLeft(s: string, i: number): string {
  return s.slice(i) + s.slice(0, i);
}

/**
 * Converts a 54-char Kociemba facelet string to a KPattern object.
 * This is necessary because @cubing/search expects a KPattern, not a string.
 */
export async function faceletsToKPattern(facelets: string): Promise<KPattern> {
    const k = await cube3x3x3.kpuzzle();
    
    // Create actual data structure
    const data: any = {
        EDGES: { pieces: new Array(12), orientation: new Array(12) },
        CORNERS: { pieces: new Array(8), orientation: new Array(8) },
        CENTERS: { pieces: [0, 1, 2, 3, 4, 5], orientation: [0, 0, 0, 0, 0, 0], orientationMod: [1, 1, 1, 1, 1, 1] }
    };

    // stickersByPiece[orbit][pos][stickerIndex] = color
    const stickersByPiece: string[][][] = [
        new Array(12).fill(0).map(() => new Array(2)),
        new Array(8).fill(0).map(() => new Array(3)),
        new Array(6).fill(0).map(() => new Array(1))
    ];

    for (let i = 0; i < 54; i++) {
        const [orbit, perm, ori] = map[i];
        stickersByPiece[orbit][perm][ori] = facelets[i];
    }

    // Solve Edges
    for (let i = 0; i < 12; i++) {
        const stickers = stickersByPiece[0][i].join("");
        let found = false;
        for (let p = 0; p < 12; p++) {
            for (let o = 0; o < 2; o++) {
                if (rotateLeft(reidEdgeOrder[p], o) === stickers) {
                    data.EDGES.pieces[i] = p;
                    data.EDGES.orientation[i] = o;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
    }

    // Solve Corners
    for (let i = 0; i < 8; i++) {
        const stickers = stickersByPiece[1][i].join("");
        let found = false;
        for (let p = 0; p < 8; p++) {
            for (let o = 0; o < 3; o++) {
                if (rotateLeft(reidCornerOrder[p], o) === stickers) {
                    data.CORNERS.pieces[i] = p;
                    data.CORNERS.orientation[i] = o;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
    }

    return new KPattern(k, data);
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
