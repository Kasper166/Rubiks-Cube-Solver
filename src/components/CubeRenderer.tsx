/**
 * CubeRenderer — React bridge for the Three.js cube engine.
 * 
 * Mounts the WebGL canvas, manages lifecycle, and syncs
 * React state with the Three.js scene via CubeStateManager.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { ThreeCube } from '../engine/ThreeCube';
import type { FaceName } from '../engine/CubeStateManager';

interface CubeRendererProps {
  /** Color state to display: { U: [['#FFFFFF',...]], ... } */
  colors?: Record<string, (string | null)[][]>;
  /** Enable auto-rotation */
  autoRotate?: boolean;
  /** Enable color-blind text overlays */
  colorBlindMode?: boolean;
  /** Expose the ThreeCube instance to parent */
  onReady?: (cube: ThreeCube) => void;
  /** Additional CSS classes */
  className?: string;
}

export default function CubeRenderer({
  colors,
  autoRotate = true,
  colorBlindMode = false,
  onReady,
  className = '',
}: CubeRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<ThreeCube | null>(null);

  // Initialize Three.js
  useEffect(() => {
    if (!containerRef.current) return;

    const cube = new ThreeCube(containerRef.current);
    cubeRef.current = cube;
    onReady?.(cube);

    return () => {
      cube.dispose();
      cubeRef.current = null;
    };
  }, []); // Mount once

  // Sync colors
  useEffect(() => {
    if (!cubeRef.current || !colors) return;
    cubeRef.current.updateAllFacelets(colors as Record<FaceName, (string | null)[][]>);
  }, [colors]);

  // Sync auto-rotate
  useEffect(() => {
    cubeRef.current?.setAutoRotate(autoRotate);
  }, [autoRotate]);

  // Sync color-blind mode
  useEffect(() => {
    cubeRef.current?.setColorBlindMode(colorBlindMode);
  }, [colorBlindMode]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative ${className}`}
      role="img"
      aria-label="Interactive 3D Rubik's Cube visualization"
    />
  );
}
