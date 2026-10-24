// Where a card pointing at a part of the screen goes: beside it on the first side with room (right,
// left, below, above), level with it as far as the window allows, never over it. A target with no
// size (hidden) gets the card in the middle of the window.

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export type CalloutSide = 'right' | 'left' | 'below' | 'above' | 'center';

const GAP = 12;
const MARGIN = 8;

export function placeCallout(target: Rect, card: { w: number; h: number }, view: { w: number; h: number }): { x: number; y: number; side: CalloutSide } {
  const centre = { x: (view.w - card.w) / 2, y: (view.h - card.h) / 2, side: 'center' as const };
  if (target.w <= 0 || target.h <= 0) return centre;
  const clampX = (x: number) => Math.min(Math.max(MARGIN, x), view.w - card.w - MARGIN);
  const clampY = (y: number) => Math.min(Math.max(MARGIN, y), view.h - card.h - MARGIN);
  const tries: { side: CalloutSide; fits: boolean; x: number; y: number }[] = [
    { side: 'right', fits: target.x + target.w + GAP + card.w <= view.w - MARGIN, x: target.x + target.w + GAP, y: clampY(target.y) },
    { side: 'left', fits: target.x - GAP - card.w >= MARGIN, x: target.x - GAP - card.w, y: clampY(target.y) },
    { side: 'below', fits: target.y + target.h + GAP + card.h <= view.h - MARGIN, x: clampX(target.x + target.w - card.w), y: target.y + target.h + GAP },
    { side: 'above', fits: target.y - GAP - card.h >= MARGIN, x: clampX(target.x), y: target.y - GAP - card.h },
  ];
  const t = tries.find((x) => x.fits);
  return t ? { x: t.x, y: t.y, side: t.side } : centre;
}
