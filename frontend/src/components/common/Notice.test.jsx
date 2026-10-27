import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Notice from './Notice';

describe('Notice', () => {
  it('exposes errors as alerts and success messages as status updates', () => {
    const { rerender } = render(<Notice>Trip could not be booked</Notice>);
    expect(screen.getByRole('alert')).toHaveTextContent('Trip could not be booked');

    rerender(<Notice type="success">Booking confirmed</Notice>);
    expect(screen.getByRole('status')).toHaveTextContent('Booking confirmed');
  });

  it('renders nothing when there is no message', () => {
    const { container } = render(<Notice />);
    expect(container).toBeEmptyDOMElement();
  });
});