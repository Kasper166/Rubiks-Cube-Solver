
export type FaceName = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
export type CubeColor = 'white' | 'red' | 'green' | 'yellow' | 'orange' | 'blue';

export const FACE_ORDER: FaceName[] = ['U', 'R', 'F', 'D', 'L', 'B'];

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

export type CubeState = {
  [face in FaceName]: CubeColor[][];
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

  if (s < 20 && v > 70) return 'white';
  if (v < 20) return 'blue'; // Dark blue fallback or just very dark

  if (h < 15 || h > 345) return 'red';
  if (h >= 15 && h < 45) return 'orange';
  if (h >= 45 && h < 75) return 'yellow';
  if (h >= 75 && h < 160) return 'green';
  if (h >= 160 && h < 260) return 'blue';

  return 'white';
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
  // cubing.js uses a specific format or we can use Kociemba notation
  // UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB
  const colorToChar: Record<CubeColor, string> = {
    white: 'U',
    red: 'R',
    green: 'F',
    yellow: 'D',
    orange: 'L',
    blue: 'B',
  };

  let def = '';
  for (const face of FACE_ORDER) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        def += colorToChar[state[face][r][c]];
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

export function validateCubeState(state: CubeState): ValidationResult {
    const errors: string[] = [];
    const colorCounts: Record<CubeColor, number> = {
        white: 0, red: 0, green: 0, yellow: 0, orange: 0, blue: 0
    };

    // 1. Sticker Count
    for (const face of FACE_ORDER) {
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                colorCounts[state[face][r][c]]++;
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
        centerColors.add(state[face][1][1]);
    }
    if (centerColors.size !== 6) {
        errors.push('Invalid center pieces. Each center must be a unique color.');
    }

    // Define edges and corners by their sticker locations
    const EDGES = [
        sortPieceColors([state.U[1][2], state.R[0][1]]), sortPieceColors([state.U[2][1], state.F[0][1]]),
        sortPieceColors([state.U[1][0], state.L[0][1]]), sortPieceColors([state.U[0][1], state.B[0][1]]),
        sortPieceColors([state.D[1][2], state.R[2][1]]), sortPieceColors([state.D[2][1], state.F[2][1]]),
        sortPieceColors([state.D[1][0], state.L[2][1]]), sortPieceColors([state.D[0][1], state.B[2][1]]),
        sortPieceColors([state.F[1][2], state.R[1][0]]), sortPieceColors([state.F[1][0], state.L[1][2]]),
        sortPieceColors([state.B[1][0], state.R[1][2]]), sortPieceColors([state.B[1][2], state.L[1][0]]),
    ];

    const CORNERS = [
        sortPieceColors([state.U[2][2], state.R[0][2], state.F[0][2]]), sortPieceColors([state.U[2][0], state.F[0][0], state.L[0][2]]),
        sortPieceColors([state.U[0][0], state.L[0][0], state.B[0][2]]), sortPieceColors([state.U[0][2], state.B[0][0], state.R[0][0]]),
        sortPieceColors([state.D[2][2], state.F[2][2], state.R[2][2]]), sortPieceColors([state.D[2][0], state.L[2][2], state.F[2][0]]),
        sortPieceColors([state.D[0][0], state.B[2][2], state.L[2][0]]), sortPieceColors([state.D[0][2], state.R[2][0], state.B[2][0]]),
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

    // TODO: Add parity checks (permutation and orientation) for a fully robust validation

    return {
        isValid: errors.length === 0,
        errors,
    };
}
