import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { DepthTag, StatusTag } from '~/components/ui/Primitives';

/**
 * These two badges are the only place the app says "this player may not play"
 * and "this player may not start". Both stay silent when they have nothing to
 * add — a badge on every row is a badge on no row.
 */
describe('StatusTag', () => {
  it('renders nothing for a healthy active player', () => {
    const { container } = render(<StatusTag status="Active" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when Sleeper knows no status at all', () => {
    const { container } = render(<StatusTag />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows an injury designation even when the player is listed Active', () => {
    render(<StatusTag status="Active" injuryStatus="Questionable" />);
    expect(screen.getByTestId('status-tag')).toHaveTextContent('Questionable');
  });

  it('shows a non-active roster status on its own', () => {
    render(<StatusTag status="Injured Reserve" />);
    expect(screen.getByTestId('status-tag')).toHaveTextContent('Injured Reserve');
  });

  it('marks season-threatening designations as severe and day-to-day ones as not', () => {
    const { unmount } = render(<StatusTag injuryStatus="Out" />);
    expect(screen.getByTestId('status-tag').dataset.severe).toBe('true');
    unmount();

    render(<StatusTag injuryStatus="Questionable" />);
    expect(screen.getByTestId('status-tag').dataset.severe).toBe('false');
  });
});

describe('DepthTag', () => {
  it('renders nothing when the player is not on a depth chart', () => {
    const { container } = render(<DepthTag />);
    expect(container).toBeEmptyDOMElement();
  });

  it('labels the starter DC1', () => {
    render(<DepthTag rank={1} />);
    const tag = screen.getByTestId('depth-tag');
    expect(tag).toHaveTextContent('DC1');
    expect(tag.title).toMatch(/Listed first/);
  });

  it('labels a backup by his rank', () => {
    render(<DepthTag rank={3} />);
    expect(screen.getByTestId('depth-tag')).toHaveTextContent('DC3');
  });
});
