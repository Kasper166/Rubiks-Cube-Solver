import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Verifier from './Verifier';
import { INITIAL_CUBE_STATE, CubeState, CubeColor } from '../lib/cubeUtils';

// Mock CubeRenderer
vi.mock('./CubeRenderer', () => ({
  default: () => <div data-testid="cube-renderer-mock">CubeRenderer</div>
}));

describe('Verifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Verifier should validate an already-solved cube and allow proceeding', () => {
    const handleConfirm = vi.fn();
    render(
      <Verifier
        initialState={INITIAL_CUBE_STATE}
        onConfirm={handleConfirm}
        onBack={vi.fn()}
      />
    );

    // Should say it's valid
    expect(screen.getByText('Everything looks perfect! Ready for the solver.')).toBeInTheDocument();
    
    const confirmBtn = screen.getByRole('button', { name: /Solve Cube/i });
    expect(confirmBtn).not.toBeDisabled();
    
    fireEvent.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledWith(INITIAL_CUBE_STATE);
  });

  it('Verifier should disable confirmation and show errors when condition invalid state is provided', () => {
    // Break the cube slightly
    const brokenState: CubeState = JSON.parse(JSON.stringify(INITIAL_CUBE_STATE));
    // Make Top Face all Red (illegal)
    brokenState.U = Array(3).fill(null).map(() => Array(3).fill('red'));

    render(
      <Verifier
        initialState={brokenState}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />
    );

    // Confirmation button should be disabled
    const confirmBtn = screen.getByRole('button', { name: /Solve Cube/i });
    expect(confirmBtn).toBeDisabled();

    // Check that some errors appear
    const invalidCountErrors = screen.getAllByText(/Invalid number of .* stickers/i);
    expect(invalidCountErrors.length).toBeGreaterThan(0);
  });

  it('Verifier should update validation dynamically when manual override fixes an issue', async () => {
    // Start with 1 sticker incorrectly placed. U face has 1 red sticker replacing a white sticker.
    const brokenState: CubeState = JSON.parse(JSON.stringify(INITIAL_CUBE_STATE));
    brokenState.U[0][0] = 'red';

    render(
      <Verifier
        initialState={brokenState}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />
    );

    // Not valid yet
    const solveBtn = screen.getByRole('button', { name: /Solve Cube/i });
    expect(solveBtn).toBeDisabled();

    // Click Manual Edit
    fireEvent.click(screen.getByText('Manual Edit'));
    
    // Select White color - match by text in the palette
    await waitFor(() => {
        const whiteBtn = screen.getByRole('button', { name: /white/i });
        fireEvent.click(whiteBtn);
    });

    // Find the sticker buttons in the 2D editor grid. 
    // They are w-10 h-10 buttons.
    await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const stickerButtons = buttons.filter(b => b.className.includes('w-10 h-10'));
        expect(stickerButtons.length).toBe(9);
        
        act(() => {
            fireEvent.click(stickerButtons[0]);
        });
    });

    // Now it should be valid again
    await waitFor(() => {
        expect(screen.getByRole('button', { name: /Solve Cube/i })).not.toBeDisabled();
        expect(screen.queryByText(/Invalid number of .* stickers/i)).not.toBeInTheDocument();
    });
  });
});
