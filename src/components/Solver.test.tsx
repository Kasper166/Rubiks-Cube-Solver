import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Solver from './Solver';
import { INITIAL_CUBE_STATE } from '../lib/cubeUtils';

// Mock ThreeCube class to prevent webgl failures
const mockExecuteMove = vi.fn().mockResolvedValue(undefined);
const mockUpdateAllFacelets = vi.fn();
class MockThreeCube {
  executeMove = mockExecuteMove;
  updateAllFacelets = mockUpdateAllFacelets;
}

// Mock child components
vi.mock('./CubeRenderer', () => ({
  default: ({ onReady }: any) => {
    // Mount with a micro-delay to simulate async readiness
    Promise.resolve().then(() => onReady(new MockThreeCube()));
    return <div data-testid="cube-renderer-mock">CubeRenderer</div>;
  }
}));

vi.mock('./ThinkBar', () => ({
  default: ({ onComplete }: any) => {
    // Immediately complete thinking phase with a 3-step mock solution
    React.useEffect(() => {
        onComplete(['U', 'R', 'F2']);
    }, [onComplete]);
    return <div data-testid="thinkbar-mock">ThinkBar</div>;
  }
}));

describe('Solver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Solver should render correctly and transition to ready phase with solution', async () => {
    render(<Solver cubeState={INITIAL_CUBE_STATE} onReset={vi.fn()} />);
    
    // Wait for the ThinkBar mock to resolve and transition to 'ready' phase
    await waitFor(() => {
      expect(screen.getByText('Solution Master')).toBeInTheDocument();
    });
    
    // Verify move list rendered
    expect(screen.getByText('U')).toBeInTheDocument();
    expect(screen.getByText('R')).toBeInTheDocument();
    expect(screen.getByText('F2')).toBeInTheDocument();
  });

  it('Solver should increment step index correctly when stepping forward manually', async () => {
    render(<Solver cubeState={INITIAL_CUBE_STATE} onReset={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Solution Master')).toBeInTheDocument();
    });

    const stepForwardBtn = screen.getByRole('button', { name: /Step forward/i });
    // We can query by the text showing the current step index
    expect(screen.getByText('0')).toHaveClass('text-white font-bold');

    await act(async () => {
      fireEvent.click(stepForwardBtn!);
    });

    // It should now be step 1
    expect(screen.getByText('1')).toHaveClass('text-white font-bold');
    expect(mockExecuteMove).toHaveBeenCalledWith('U', expect.any(Number));
  });

  it('Solver should completely reset current move index and animations when replay is clicked', async () => {
    render(<Solver cubeState={INITIAL_CUBE_STATE} onReset={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Solution Master')).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole('button');
    // Using simple approach: just click the first move in the list to jump to it
    const moveButton = screen.getByText('F2').closest('button');
    
    await act(async () => {
      fireEvent.click(moveButton!);
    });

    // Should be at step 2 (index 2)
    expect(screen.getByText('2')).toHaveClass('text-white font-bold');

    // Click "Replay Solution" or Reset Playback button
    const resetPlaybackBtn = screen.getByRole('button', { name: /Reset playback/i });

    await act(async () => {
      fireEvent.click(resetPlaybackBtn);
    });

    // Should be fully reset to 0
    expect(screen.getByText('0')).toHaveClass('text-white font-bold');
    expect(mockUpdateAllFacelets).toHaveBeenCalled();
  });

  it('Solver should not corrupt step counter on rapid play pause interleaving', async () => {
    render(<Solver cubeState={INITIAL_CUBE_STATE} onReset={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Solution Master')).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole('button');
    const playPauseBtn = buttons.find(b => b.innerHTML.includes('Play') || b.innerHTML.includes('Pause')) || buttons[3];

    // Rapidly toggle play pause
    await act(async () => {
      fireEvent.click(playPauseBtn);
      fireEvent.click(playPauseBtn);
      fireEvent.click(playPauseBtn);
      fireEvent.click(playPauseBtn);
    });

    // Since step duration is 600ms, rapid pressing shouldn't instantaneously advance it 4 times.
    // It should just remain at 0 or 1 safely without throwing.
    const stepEl = screen.getByText(/^[01]$/);
    expect(stepEl).toHaveClass('text-white font-bold');
  });

});
