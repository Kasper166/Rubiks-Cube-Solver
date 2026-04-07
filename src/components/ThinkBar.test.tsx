import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ThinkBar from './ThinkBar';
import { INITIAL_CUBE_STATE } from '../lib/cubeUtils';

vi.mock('../engine/ThinkBarOrchestrator', () => ({
  orchestrateThinkBar: vi.fn().mockImplementation(() => new Promise(() => {})) // Never resolves to keep it in thinking state for simple render test
}));


describe('ThinkBar', () => {
  it('renders gracefully', () => {
    const { container } = render(
      <ThinkBar 
        cubeState={INITIAL_CUBE_STATE} 
        threeCube={null} 
        onComplete={vi.fn()} 
        onError={vi.fn()} 
      />
    );
    expect(container).toBeInTheDocument();
  });
});
