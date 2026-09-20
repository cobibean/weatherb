import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HowWeatherbWorksModal } from '../how-weatherb-works-modal';

afterEach(cleanup);
describe('How it works guide', () => {
  it('supports next, back, direct steps, completion, and resets when reopened', async () => {
    render(<HowWeatherbWorksModal />);
    const trigger = screen.getByRole('button', { name: /How it works/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Connect Wallet' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Browse Markets' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '5. Collect Winnings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(trigger);
    expect(screen.getByRole('heading', { name: 'Browse Markets' })).toBeInTheDocument();
  });
  it('closes with Escape and restores focus to the trigger', async () => {
    render(<HowWeatherbWorksModal />);
    const trigger = screen.getByRole('button', { name: /How it works/i });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
