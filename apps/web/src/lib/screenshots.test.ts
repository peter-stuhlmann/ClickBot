import { describe, expect, it } from 'vitest';
import { screenshotAnchor, screenshotStepOf } from './screenshots';

describe('screenshot anchors', () => {
  it('reads the step back from a link to its anchor', () => {
    expect(screenshotStepOf(`#${screenshotAnchor(13)}`)).toBe(13);
  });

  it.each(['', '#', '#bildschirmfoto-', '#bildschirmfoto-0', '#bildschirmfoto-2a', '#abschnitt-2'])(
    'is no screenshot link: %j',
    (href) => {
      expect(screenshotStepOf(href)).toBeNull();
    },
  );
});
