import '@testing-library/jest-dom';
import { vi } from 'vitest';
import * as React from 'react';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
(globalThis as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Navigator.vibrate
if (typeof navigator !== 'undefined' && !navigator.vibrate) {
    (navigator as any).vibrate = vi.fn();
}

// Mock ImageData for GlareDetector tests
if (typeof globalThis.ImageData === 'undefined') {
    (globalThis as any).ImageData = class ImageData {
        width: number;
        height: number;
        data: Uint8ClampedArray;
        constructor(data: Uint8ClampedArray, width: number, height: number) {
            this.data = data;
            this.width = width;
            this.height = height;
        }
    };
}

// HTMLCanvasElement methods mock
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    drawImage: vi.fn(),
    getImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray(4 * 300 * 300),
    }),
    setTransform: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
}) as any;
(HTMLCanvasElement.prototype as any).toBuffer = vi.fn() as any;
HTMLCanvasElement.prototype.toDataURL = vi.fn() as any;


// Disable framer-motion animations
vi.mock('framer-motion', () => {
  const Dummy = React.forwardRef((props: any, ref: any) => {
    const { initial, animate, exit, transition, whileHover, whileTap, layoutId, ...rest } = props;
    return React.createElement('div', { ref, ...rest });
  });

  return {
    AnimatePresence: ({ children }: any) => {
      const childrenArray = React.Children.toArray(children).filter(Boolean);
      return React.createElement(React.Fragment, null, childrenArray);
    },
    motion: new Proxy(Dummy, {
      get: (target, prop) => {
        if (typeof prop === 'string' && /^[a-z]+$/.test(prop)) {
             return React.forwardRef((props: any, ref: any) => {
                const { initial, animate, exit, transition, whileHover, whileTap, layoutId, ...rest } = props;
                return React.createElement(prop, { ref, ...rest });
             });
        }
        return target;
      }
    }),
    useAnimation: () => ({ start: vi.fn(), stop: vi.fn(), set: vi.fn() }),
    useReducedMotion: () => true,
    useScroll: () => ({ scrollY: { get: () => 0 }, scrollYProgress: { get: () => 0 } }),
    useTransform: () => 0,
    useSpring: () => 0,
  };
});



