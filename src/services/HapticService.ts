/**
 * HapticService — Provides typed vibration patterns for UX feedback.
 * Falls back silently on devices that don't support navigator.vibrate.
 */

function vibrate(pattern: number | number[]): void {
  try {
    navigator?.vibrate?.(pattern);
  } catch {
    // Silently fail on unsupported platforms
  }
}

export const Haptic = {
  /** Quick tap — scan confirmation, button press */
  light: () => vibrate(15),

  /** Standard feedback — face captured, sticker changed */
  medium: () => vibrate(50),

  /** Strong feedback — solve complete, major action */
  heavy: () => vibrate(100),

  /** Double-pulse — success pattern */
  success: () => vibrate([50, 30, 50]),

  /** Triple-pulse — error/warning pattern */
  error: () => vibrate([100, 50, 100, 50, 100]),

  /** Gentle ramp — Think Bar phase transition */
  phaseTransition: () => vibrate([20, 40, 60]),
} as const;
