import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CanvasOverlay from './CanvasOverlay';

describe('CanvasOverlay', () => {
  it('renders gracefully without crashing', () => {
    const { container } = render(
      <CanvasOverlay 
        colors={Array(3).fill(Array(3).fill('#FFFFFF'))} 
        onStickerChange={() => {}} 
      />
    );
    expect(container).toBeInTheDocument();
  });
});
