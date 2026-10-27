// The office's logo (the lot's, app/lot.ts) as an image the sheets draw (app/sheets.ts): decoded once and
// kept. A canvas draws only a decoded image, and the sheets are drawn at once, so the first drawing may
// come before it: it is drawn again when it is ready, and the PDF waits for it.

const cache = new Map<string, HTMLImageElement>();

/** The logo, decoded; null while it is not (then `ready` is called once it is) or when there is none. */
export function logoImage(url: string | undefined, ready?: () => void): HTMLImageElement | null {
  if (!url) return null;
  let img = cache.get(url);
  if (!img) {
    img = new Image();
    if (ready) img.addEventListener('load', ready, { once: true });
    img.src = url;
    cache.set(url, img);
  } else if (!img.complete && ready) img.addEventListener('load', ready, { once: true });
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** Waits for the logo to be decoded; false when it cannot be (a broken image): the sheets go without it. */
export async function logoReady(url: string | undefined): Promise<boolean> {
  if (!url) return true;
  logoImage(url);
  try {
    await cache.get(url)!.decode();
    return true;
  } catch {
    return false;
  }
}

/** Reduces a picture to fit a title block's logo (at most `w` × `h` px), as PNG, or JPEG when that is smaller. */
export async function shrinkLogo(file: Blob, w = 800, h = 400): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, w / bitmap.width, h / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * k));
  canvas.height = Math.max(1, Math.round(bitmap.height * k));
  const ctx = canvas.getContext('2d')!;
  // On white: a JPEG has no transparency, and the title block is white.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const png = canvas.toDataURL('image/png');
  const jpeg = canvas.toDataURL('image/jpeg', 0.9);
  return jpeg.length < png.length ? jpeg : png;
}
