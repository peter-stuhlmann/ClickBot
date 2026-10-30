/** Edge length of stored profile pictures, in pixels: sharp at 80 CSS pixels on 3× screens. */
export const AVATAR_SIZE = 256;

/** The address of a profile picture; its time in the URL lets browsers cache it for good. */
export function avatarUrl(userId: string, updatedAt: Date | null): string | null {
  return updatedAt ? `/avatar/${userId}?v=${updatedAt.getTime()}` : null;
}

/** The middle square of a picture (x, y, side) and the edge length it is shrunk to, never grown. */
export function squareCrop(width: number, height: number) {
  const side = Math.min(width, height);
  return {
    x: Math.floor((width - side) / 2),
    y: Math.floor((height - side) / 2),
    side,
    size: Math.min(side, AVATAR_SIZE),
  };
}

/**
 * Turns any picture the browser can read (also HEIC on Apple devices) into a small square WebP,
 * or PNG where the browser cannot write WebP. Rejects pictures the browser cannot read.
 */
export async function squareImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { x, y, side, size } = squareCrop(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d')?.drawImage(bitmap, x, y, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Bild nicht lesbar'))),
      'image/webp',
      0.9,
    ),
  );
}
