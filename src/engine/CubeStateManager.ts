/**
 * CubeStateManager — The Live-Sync Bridge
 * 
 * Central reactive state manager that bridges:
 *   CV Worker → Global Cube State → Three.js Renderer
 *   Manual UI Overrides → Global Cube State → Three.js Renderer
 * 
 * Implements useSyncExternalStore-compatible API for React integration.
 */

export type FaceName = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';

export interface Sticker {
  color: string | null;   // Hex color code, null = unscanned
  label: string | null;   // 'white', 'red', etc.
  confidence: number;     // 0..1
  source: 'cv' | 'manual' | null;
}

export interface FaceData {
  stickers: Sticker[][];  // 3×3
  scanned: boolean;
  scanTimestamp: number | null;
}

export interface SolverState {
  phase: 'idle' | 'validating' | 'solving' | 'ghostSolve' | 'complete' | 'error';
  validationResult: { isValid: boolean; checks: { name: string; passed: boolean }[] } | null;
  solutions: { moves: string[]; orientation: number }[];
  bestSolution: string[] | null;
  ghostSolveProgress: number;
  error: string | null;
}

export interface AppSettings {
  colorBlindMode: boolean;
  hapticEnabled: boolean;
  glareThreshold: number;
}

export interface GlobalCubeState {
  version: number;
  timestamp: number;
  faces: Record<FaceName, FaceData>;
  solver: SolverState;
  settings: AppSettings;
}

export type StateListener = (state: GlobalCubeState) => void;
export type FaceletChangeListener = (
  face: FaceName, row: number, col: number, 
  oldColor: string | null, newColor: string | null
) => void;

const FACE_NAMES: FaceName[] = ['U', 'R', 'F', 'D', 'L', 'B'];

const NULL_STICKER: Sticker = { color: null, label: null, confidence: 0, source: null };

function createEmptyFace(): FaceData {
  return {
    stickers: Array.from({ length: 3 }, () =>
      Array.from({ length: 3 }, () => ({ ...NULL_STICKER }))
    ),
    scanned: false,
    scanTimestamp: null,
  };
}

function createInitialState(): GlobalCubeState {
  const faces = {} as Record<FaceName, FaceData>;
  for (const f of FACE_NAMES) {
    faces[f] = createEmptyFace();
  }
  return {
    version: 0,
    timestamp: Date.now(),
    faces,
    solver: {
      phase: 'idle',
      validationResult: null,
      solutions: [],
      bestSolution: null,
      ghostSolveProgress: 0,
      error: null,
    },
    settings: {
      colorBlindMode: false,
      hapticEnabled: true,
      glareThreshold: 240,
    },
  };
}

export const COLOR_HEX_MAP: Record<string, string> = {
  white:  '#FFFFFF',
  red:    '#B7121F',
  green:  '#009B48',
  yellow: '#FFD500',
  orange: '#FF5800',
  blue:   '#0046AD',
};

export const GREY_HEX = '#808080';

export class CubeStateManager {
  private state: GlobalCubeState;
  private listeners: Set<StateListener> = new Set();
  private faceletListeners: Set<FaceletChangeListener> = new Set();

  constructor(initialState?: GlobalCubeState) {
    this.state = initialState ?? createInitialState();
  }

  // ─── React useSyncExternalStore API ───────────────────

  getSnapshot = (): GlobalCubeState => this.state;

  subscribe = (listener: StateListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  onFaceletChange = (listener: FaceletChangeListener): (() => void) => {
    this.faceletListeners.add(listener);
    return () => this.faceletListeners.delete(listener);
  };

  // ─── Mutations ────────────────────────────────────────

  /**
   * Ingest a full face scan from the CV pipeline.
   */
  ingestFaceData(
    face: FaceName,
    colors: (string | null)[][],  // 3×3 label names
    confidences?: number[][]
  ): void {
    const faceData = this.state.faces[face];
    
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const label = colors[r]?.[c] ?? null;
        const oldColor = faceData.stickers[r][c].color;
        const newColor = label ? (COLOR_HEX_MAP[label] ?? null) : null;

        faceData.stickers[r][c] = {
          color: newColor,
          label,
          confidence: confidences?.[r]?.[c] ?? (label ? 0.8 : 0),
          source: label ? 'cv' : null,
        };

        if (oldColor !== newColor) {
          this.notifyFaceletChange(face, r, c, oldColor, newColor);
        }
      }
    }

    faceData.scanned = true;
    faceData.scanTimestamp = Date.now();
    this.bump();
  }

  /**
   * Manual override from the Tap-to-Correct UI.
   */
  manualOverride(face: FaceName, row: number, col: number, label: string): void {
    const oldColor = this.state.faces[face].stickers[row][col].color;
    const newColor = COLOR_HEX_MAP[label] ?? null;

    this.state.faces[face].stickers[row][col] = {
      color: newColor,
      label,
      confidence: 1.0,
      source: 'manual',
    };

    if (oldColor !== newColor) {
      this.notifyFaceletChange(face, row, col, oldColor, newColor);
    }
    this.bump();
  }

  /**
   * Load a complete cube state (e.g., from cubeUtils CubeState format).
   */
  loadFromLegacyState(legacyState: Record<string, string[][]>): void {
    for (const face of FACE_NAMES) {
      if (legacyState[face]) {
        const colors = legacyState[face];
        this.ingestFaceData(face, colors);
      }
    }
  }

  /**
   * Update solver state (called during Think Bar orchestration).
   */
  updateSolver(partial: Partial<SolverState>): void {
    this.state.solver = { ...this.state.solver, ...partial };
    this.bump();
  }

  /**
   * Update settings.
   */
  updateSettings(partial: Partial<AppSettings>): void {
    this.state.settings = { ...this.state.settings, ...partial };
    this.bump();
  }

  /**
   * Full reset.
   */
  reset(): void {
    this.state = createInitialState();
    this.notify();
  }

  // ─── Derived Getters ──────────────────────────────────

  /**
   * Get the display color for a facelet.
   * Returns GREY_HEX for null/unscanned stickers.
   */
  getDisplayColor(face: FaceName, row: number, col: number): string {
    return this.state.faces[face].stickers[row][col].color ?? GREY_HEX;
  }

  /**
   * Check if all 6 faces have been scanned.
   */
  isComplete(): boolean {
    return FACE_NAMES.every(f => this.state.faces[f].scanned);
  }

  /**
   * Convert to Kociemba-compatible definition string.
   * Format: URFDLB, each face read row-by-row, top-left to bottom-right.
   * Each character is the face letter corresponding to the center color.
   */
  toDefinitionString(): string {
    const centerLabels: Record<string, FaceName> = {};
    for (const face of FACE_NAMES) {
      const centerLabel = this.state.faces[face].stickers[1][1].label;
      if (centerLabel) {
        centerLabels[centerLabel] = face;
      }
    }

    let def = '';
    for (const face of FACE_NAMES) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const label = this.state.faces[face].stickers[r][c].label;
          def += label ? (centerLabels[label] ?? 'U') : 'U';
        }
      }
    }
    return def;
  }

  /**
   * Convert to legacy CubeState format for backward compat.
   */
  toLegacyState(): Record<string, string[][]> {
    const result: Record<string, string[][]> = {};
    for (const face of FACE_NAMES) {
      result[face] = this.state.faces[face].stickers.map(row =>
        row.map(s => s.label ?? 'white')
      );
    }
    return result;
  }

  // ─── Internal ─────────────────────────────────────────

  private bump(): void {
    this.state = {
      ...this.state,
      version: this.state.version + 1,
      timestamp: Date.now(),
    };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private notifyFaceletChange(
    face: FaceName, row: number, col: number,
    oldColor: string | null, newColor: string | null
  ): void {
    for (const listener of this.faceletListeners) {
      listener(face, row, col, oldColor, newColor);
    }
  }
}
