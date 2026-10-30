import { describe, expect, it } from 'vitest';
import { AVATAR_SIZE, avatarUrl, squareCrop } from './avatar';

describe('avatarUrl', () => {
  it('carries the time of the picture, so a new picture gets a new address', () => {
    const id = '5b0c6a52-8a8b-4f0e-9a51-2f7e1c3d4b5a';
    expect(avatarUrl(id, new Date('2026-11-05T12:30:00Z'))).toBe(`/avatar/${id}?v=1793881800000`);
  });

  it('is null without a picture', () => {
    expect(avatarUrl('5b0c6a52-8a8b-4f0e-9a51-2f7e1c3d4b5a', null)).toBeNull();
  });
});

describe('squareCrop', () => {
  it('cuts the middle square out of a landscape photo and shrinks it', () => {
    expect(squareCrop(1200, 800)).toEqual({ x: 200, y: 0, side: 800, size: AVATAR_SIZE });
  });

  it('cuts the middle square out of a portrait photo', () => {
    expect(squareCrop(600, 900)).toEqual({ x: 0, y: 150, side: 600, size: AVATAR_SIZE });
  });

  it('does not blow up a small picture', () => {
    expect(squareCrop(100, 120)).toEqual({ x: 0, y: 10, side: 100, size: 100 });
  });

  it('keeps whole pixels for odd sizes', () => {
    expect(squareCrop(301, 300)).toEqual({ x: 0, y: 0, side: 300, size: AVATAR_SIZE });
  });
});
