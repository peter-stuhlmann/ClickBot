import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TotpQr } from './TotpQr';

describe('TotpQr', () => {
  it('shows the QR code and the key in groups of four for typing', () => {
    render(<TotpQr qrDataUrl="data:image/png;base64,AAAA" secret="GEZDGNBVGY3TQOJQ" />);
    expect(screen.getByRole('img', { name: 'QR-Code für die Authenticator-App' })).toHaveAttribute(
      'src',
      'data:image/png;base64,AAAA',
    );
    expect(screen.getByText('GEZD GNBV GY3T QOJQ')).toBeVisible();
  });
});
