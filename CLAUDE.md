# Spectro-Cube

Rubik's Cube scanner and solver web app. Uses a phone/webcam camera to scan each face of a physical cube, validates the state, then solves it with animated 3D playback.

## Tech Stack

- **React 19** + **TypeScript 5.8** + **Vite 6**
- **Three.js** for 3D cube rendering, **GSAP** for animations, **Framer Motion** for UI transitions
- **cubing.js** for Kociemba solving algorithm (run in Web Workers for non-blocking solve)
- **Tailwind CSS v4** for styling (glass morphism dark theme)
- **Vitest** + **React Testing Library** for tests

## Commands

```bash
npm run dev       # Dev server on http://0.0.0.0:3000
npm run build     # Production build to /dist
npm run preview   # Preview production build
npm test          # Run all tests (vitest run)
npm run lint      # Type check (tsc --noEmit)
npm run clean     # Remove dist/
```

## Project Structure

```
src/
  App.tsx                      # Root: 3-phase wizard (Scan -> Verify -> Solve)
  components/
    Scanner.tsx                # Phase 1: camera-based HSV color detection per face
    Verifier.tsx               # Phase 2: cube state validation + manual correction
    Solver.tsx                 # Phase 3: ThinkBar sequence + move-by-move playback
    ThinkBar.tsx               # Cinematic 20s solving animation UI
    CubeRenderer.tsx           # React bridge to Three.js engine
    CanvasOverlay.tsx          # 2D grid overlay for manual color override
  engine/
    ThreeCube.ts               # 3D cube: 26 cubies, 54 facelets, rotation animations
    ThinkBarOrchestrator.ts    # 3-phase orchestration: validate -> solve -> ghost preview
    CubeStateManager.ts        # Reactive state bridge (CV -> State -> Renderer)
    ColorBlindMode.ts          # Accessibility: face labels (U/D/L/R/F/B)
    solverPool.worker.ts       # Web Worker for parallel Kociemba solving
  lib/
    cubeUtils.ts               # Color detection, validation, KPattern conversion, types
    solver.worker.ts           # Solver worker implementation
  services/
    GlareDetector.ts           # Camera glare detection via HSV brightness analysis
    HapticService.ts           # Vibration feedback patterns
```

## App Flow

1. **Scan** - Camera scans 6 faces sequentially (U, F, R, B, L, D). HSV color detection classifies each sticker. Auto-capture when colors stabilize.
2. **Verify** - 5-point validation (sticker count, center integrity, edge/corner validity, parity). Interactive 3D cube with per-face editing.
3. **Solve** - ThinkBar orchestrates: validation reveal (0-5s), parallel Kociemba solve across 8 orientations (5-15s), ghost solve preview (15-20s). Then step-by-step animated playback.

## Key Patterns

- **No external state library** - custom CubeStateManager with observer pattern
- **Web Workers** for solving to keep UI responsive
- **All components have matching .test.tsx/.test.ts files** (15 test files)
- Dark theme with glass morphism (`bg-zinc-900/40 backdrop-blur-xl`)
- Mobile-first: back camera default, haptic feedback, touch-friendly

## Deployment

GitHub Pages at `https://Kasper166.github.io/Rubiks-Cube-Solver/` (base path: `/Rubiks-Cube-Solver/`).

## Change Log

### 2026-04-09 — Bug fixes & debug mode
**Bug fixes (8 total):**
- `Scanner.tsx` — Stale closures in `detect()` rAF loop fixed by mirroring state into refs (`facingModeRef`, `manualOverridesRef`, `currentFaceRef`, etc.)
- `Scanner.tsx` — Canvas now draws only the guide area (not the full stretched frame) so top/bottom row sampling aligns with what the user sees on screen. Uses `videoContainerRef` to compute the guide's position in video-frame coordinates at runtime.
- `Scanner.tsx` — `facingMode: { ideal: ... }` so laptop cameras (user-facing only) no longer fail to start
- `CanvasOverlay.tsx` — Color picker popover was clipped by `overflow-hidden` parent; added `popoverDirection` prop (default `'above'`) so it opens upward
- `cubeUtils.ts` — Dark achromatic pixels (`v < 15 && s < 25`) correctly fall back to `'blue'`; saturated dark pixels now use hue-based classification instead of always returning `'blue'`
- `solver.worker.ts` — Wrong field name (`solution` → `moves`) in `postMessage` payload
- `ThinkBarOrchestrator.ts` — Added error logging to silent `worker.onerror` callback
- `ThinkBar.tsx` — Missing `threeCube`, `onComplete`, `onError` deps in `useEffect`
- `Verifier.tsx` — `initialState` deep-cloned on init to prevent shared-reference mutations
- `package.json` / `tsconfig.json` — Removed `@types/jest`, switched to `@testing-library/jest-dom/vitest`, added `skipLibCheck` to fix type conflicts with vitest globals
- `Solver.tsx` — Move-list buttons now guard against jumping index during animation

**New feature:**
- `Scanner.tsx` — CV debug mode (`🐛` button): shows the exact image the algorithm samples, sampling points with detected colours, override/forced indicators, unique colour count, and glare %. Useful for diagnosing scan issues on any device.
