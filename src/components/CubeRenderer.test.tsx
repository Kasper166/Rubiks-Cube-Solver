import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CubeRenderer from './CubeRenderer';

vi.mock('../engine/ThreeCube', () => {
  return {
    ThreeCube: class {
        dispose = vi.fn();
        startAnimationLoop = vi.fn();
        updateAllFacelets = vi.fn();
        setAutoRotate = vi.fn();
        setColorBlindMode = vi.fn();
        executeMove = vi.fn();
    }
  };
});



describe('CubeRenderer', () => {
  it('renders gracefully', () => {
    const fakeColors = {
      U: Array(3).fill(Array(3).fill('#FFFFFF')),
      R: Array(3).fill(Array(3).fill('#FF0000')),
      F: Array(3).fill(Array(3).fill('#00FF00')),
      D: Array(3).fill(Array(3).fill('#FFFF00')),
      L: Array(3).fill(Array(3).fill('#FFA500')),
      B: Array(3).fill(Array(3).fill('#0000FF'))
    };

    const { container } = render(<CubeRenderer colors={fakeColors} autoRotate={false} />);
    expect(container).toBeInTheDocument();
  });
});
