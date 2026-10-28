import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportLayout } from './ReportLayout';

describe('ReportLayout', () => {
  it('places header, figures, content and details', () => {
    render(
      <ReportLayout header={<h1>Lauf #7</h1>} stats={<p>8,4 s</p>} aside={<p>Bildschirmfoto</p>}>
        <p>Ablauf</p>
      </ReportLayout>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Lauf #7' })).toBeVisible();
    expect(screen.getByText('8,4 s')).toBeVisible();
    expect(screen.getByText('Ablauf')).toBeVisible();
    expect(screen.getByRole('complementary', { name: 'Details' })).toHaveTextContent(
      'Bildschirmfoto',
    );
  });

  it('uses the full width without details', () => {
    render(
      <ReportLayout header={<h1>Lauf #8</h1>} stats={null}>
        <p>Ablauf</p>
      </ReportLayout>,
    );
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});
