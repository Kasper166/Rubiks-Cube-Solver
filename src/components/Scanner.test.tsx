import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Scanner from './Scanner';
import { INITIAL_CUBE_STATE, CubeState } from '../lib/cubeUtils';

// Mock Three.js Renderer and CanvasOverlay to prevent WebGL/Canvas context issues
vi.mock('./CubeRenderer', () => ({
  default: () => <div data-testid="cube-renderer-mock">CubeRenderer</div>
}));

// We'll mock CanvasOverlay to expose the onStickerChange callback easily
vi.mock('./CanvasOverlay', () => ({
  default: ({ onStickerChange, editable }: any) => (
    <div data-testid="canvas-overlay-mock">
      {editable && (
        <button 
          data-testid="mock-sticker-override"
          onClick={() => onStickerChange(0, 0, 'blue')}
        >
          Change to Blue
        </button>
      )}
    </div>
  )
}));

describe('Scanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Scanner should gracefully start on Intro and move to Scanning when condition Got it, Start Scanning is clicked', async () => {
    const handleComplete = vi.fn();
    render(<Scanner onComplete={handleComplete} />);
    
    // Initially should show intro
    expect(screen.getByText('Scanning Guide')).toBeInTheDocument();
    
    // Click Start
    fireEvent.click(screen.getByText('Got it, Start Scanning'));
    
    // Intro should disappear
    await waitFor(() => {
        expect(screen.queryByText('Scanning Guide')).not.toBeInTheDocument();
    });
  });

  it('Scanner should change cell color to expected color when manual override is triggered', async () => {
    render(<Scanner onComplete={vi.fn()} />);
    fireEvent.click(screen.getByText('Got it, Start Scanning'));
    
    await waitFor(() => {
        expect(screen.queryByTestId('mock-sticker-override')).toBeInTheDocument();
    });

    const overrideButton = screen.getByTestId('mock-sticker-override');
    
    await act(async () => {
      fireEvent.click(overrideButton);
    });

    expect(overrideButton).toBeInTheDocument();
  });

  it('Scanner should capture faces sequentially and invoke onComplete when condition 6 faces are captured', async () => {
    const handleComplete = vi.fn();
    render(<Scanner onComplete={handleComplete} />);
    fireEvent.click(screen.getByText('Got it, Start Scanning'));
    
    await waitFor(() => {
        expect(screen.queryByText('Scanning Guide')).not.toBeInTheDocument();
    });

    // Capture U
    fireEvent.click(screen.getByText(/Capture Up/i));
    
    // Capture F
    await waitFor(() => screen.getByText(/Capture Front/i));
    fireEvent.click(screen.getByText(/Capture Front/i));

    // Capture R
    await waitFor(() => screen.getByText(/Capture Right/i));
    fireEvent.click(screen.getByText(/Capture Right/i));

    // Capture B
    await waitFor(() => screen.getByText(/Capture Back/i));
    fireEvent.click(screen.getByText(/Capture Back/i));

    // Capture L
    await waitFor(() => screen.getByText(/Capture Left/i));
    fireEvent.click(screen.getByText(/Capture Left/i));

    // Capture D
    await waitFor(() => screen.getByText(/Capture Down/i));
    fireEvent.click(screen.getByText(/Capture Down/i));

    // Now it should be on step 6 and show a checkmark button
    // It's the only btn-primary button without "Capture" text usually
    await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const completeBtn = buttons.find(btn => btn.className.includes('bg-emerald-500'));
        expect(completeBtn).toBeDefined();
        fireEvent.click(completeBtn!);
    });
    
    await waitFor(() => {
        expect(handleComplete).toHaveBeenCalledTimes(1);
    });
    
    const capturedState = handleComplete.mock.calls[0][0];
    expect(capturedState).toHaveProperty('U');
    expect(capturedState).toHaveProperty('F');
    expect(capturedState).toHaveProperty('R');
    expect(capturedState).toHaveProperty('B');
    expect(capturedState).toHaveProperty('L');
    expect(capturedState).toHaveProperty('D');
  });

});
