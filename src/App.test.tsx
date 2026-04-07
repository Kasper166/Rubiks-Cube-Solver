import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

vi.mock('./components/Scanner', () => ({
  default: () => <div data-testid="mock-scanner">Scanner View</div>
}));

describe('App', () => {
  it('App gracefully renders and defaults to Scanner phase', () => {
    render(<App />);
    expect(screen.getByTestId('mock-scanner')).toBeInTheDocument();
  });
});
