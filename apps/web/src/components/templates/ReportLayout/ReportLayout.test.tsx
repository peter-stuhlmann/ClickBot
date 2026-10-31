import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportLayout } from './ReportLayout';

describe('ReportLayout', () => {
  it('places header, figures, content and details', () => {
    render(
      <ReportLayout
        header={<h1>Durchlauf 7</h1>}
        stats={<p>8,4 s</p>}
        aside={<p>Bildschirmfoto</p>}
      >
        <p>Ablauf</p>
      </ReportLayout>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Durchlauf 7' })).toBeVisible();
    expect(screen.getByText('8,4 s')).toBeVisible();
    expect(screen.getByText('Ablauf')).toBeVisible();
    expect(screen.getByRole('complementary', { name: 'Details' })).toHaveTextContent(
      'Bildschirmfoto',
    );
  });

  it('uses the full width without details', () => {
    render(
      <ReportLayout header={<h1>Durchlauf 8</h1>} stats={null}>
        <p>Ablauf</p>
      </ReportLayout>,
    );
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('names the detail column after its content', () => {
    render(
      <ReportLayout header={null} stats={null} aside={<p>Kunde</p>} asideLabel="Filter">
        <p>Durchläufe</p>
      </ReportLayout>,
    );
    expect(screen.getByRole('complementary', { name: 'Filter' })).toHaveTextContent('Kunde');
    expect(screen.getByRole('complementary', { name: 'Filter' })).toHaveClass('xl:w-110');
  });

  it('can put the details above a wide table, sticky while it scrolls, e.g. filters', () => {
    render(
      <ReportLayout
        header={null}
        stats={null}
        aside={<p>Projekt</p>}
        asideLabel="Filter"
        asideOnTop
      >
        <p>Durchläufe</p>
      </ReportLayout>,
    );
    const filters = screen.getByRole('complementary', { name: 'Filter' });
    expect(filters.compareDocumentPosition(screen.getByText('Durchläufe'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(filters).toHaveClass('lg:sticky');
  });
});
