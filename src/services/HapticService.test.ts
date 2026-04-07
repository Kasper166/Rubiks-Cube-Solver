import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Haptic } from './HapticService';

describe('HapticService', () => {
  let originalVibrate: any;

  beforeEach(() => {
    // Preserve original and clear mocks internally
    originalVibrate = window.navigator.vibrate;
    // Mock vibrate
    if (window.navigator) {
        window.navigator.vibrate = vi.fn();
    }
  });

  afterEach(() => {
    if (window.navigator) {
        window.navigator.vibrate = originalVibrate;
    }
  });

  it('should call navigator.vibrate when light haptic is triggered', () => {
    Haptic.light();
    expect(window.navigator.vibrate).toHaveBeenCalledWith(15);
  });

  it('should call navigator.vibrate when medium haptic is triggered', () => {
    Haptic.medium();
    expect(window.navigator.vibrate).toHaveBeenCalledWith(50);
  });

  it('should invoke success pattern correctly', () => {
    Haptic.success();
    // success pattern in implementation is [50, 30, 50]
    expect(window.navigator.vibrate).toHaveBeenCalledWith([50, 30, 50]);
  });
});
