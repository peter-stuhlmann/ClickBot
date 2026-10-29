import { ALL_MARKINGS_ON, type AnalyticsMarking } from '@click-bot/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AnalyticsMarkingForm } from './AnalyticsMarkingForm';

function Harness({
  start = ALL_MARKINGS_ON,
  onChange = () => {},
}: {
  start?: AnalyticsMarking;
  onChange?: (marking: AnalyticsMarking) => void;
}) {
  const [marking, setMarking] = useState(start);
  return (
    <AnalyticsMarkingForm
      marking={marking}
      onChange={(next) => {
        setMarking(next);
        onChange(next);
      }}
    />
  );
}

const switchNamed = (name: string) => screen.getByRole('switch', { name });

describe('AnalyticsMarkingForm', () => {
  it('starts with every marking on and no warning', () => {
    render(<Harness />);
    for (const name of [
      'Bot-Läufe in GA4 markieren',
      'Debug-Modus',
      'Interner Traffic',
      'Bot-Kennung',
      'Laufnummer',
    ]) {
      expect(switchNamed(name)).toBeChecked();
    }
    expect(
      screen.queryByRole('region', { name: /Markierung eingeschränkt|wie echte Besuche/ }),
    ).not.toBeInTheDocument();
  });

  it('switches a single marking off and says what that means', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(switchNamed('Debug-Modus'));

    expect(onChange).toHaveBeenLastCalledWith({ ...ALL_MARKINGS_ON, debugMode: false });
    expect(switchNamed('Bot-Läufe in GA4 markieren')).not.toBeChecked();
    expect(screen.getByRole('region', { name: 'Markierung eingeschränkt' })).toHaveTextContent(
      'Aus: Debug-Modus. Die Ereignisse erscheinen in den normalen GA4-Berichten.',
    );
  });

  it('switches all markings off and on with the main switch, with a clear warning when off', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(switchNamed('Bot-Läufe in GA4 markieren'));
    expect(onChange).toHaveBeenLastCalledWith({
      debugMode: false,
      internalTraffic: false,
      botFlag: false,
      runNumber: false,
    });
    expect(switchNamed('Laufnummer')).not.toBeChecked();
    expect(
      screen.getByRole('region', { name: 'Bot-Läufe zählen in GA4 wie echte Besuche' }),
    ).toHaveTextContent('Jeder Report vermerkt es.');

    await user.click(switchNamed('Bot-Läufe in GA4 markieren'));
    expect(onChange).toHaveBeenLastCalledWith(ALL_MARKINGS_ON);
  });

  it('turns everything on with the main switch when only some markings are on', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness start={{ ...ALL_MARKINGS_ON, botFlag: false }} onChange={onChange} />);
    await user.click(switchNamed('Bot-Läufe in GA4 markieren'));
    expect(onChange).toHaveBeenLastCalledWith(ALL_MARKINGS_ON);
  });

  it('does not repeat the report hint for the debug mode when it is on', () => {
    render(<Harness start={{ ...ALL_MARKINGS_ON, runNumber: false }} />);
    expect(screen.getByRole('region', { name: 'Markierung eingeschränkt' })).not.toHaveTextContent(
      'normalen GA4-Berichten',
    );
  });
});
