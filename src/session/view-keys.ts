// The view by keyboard (pure): + and − zoom about the middle of the view; Shift+arrows move the plan
// (or turn the 3D view) by 80 px a press. Plain arrows move the selection (tools/nudge.ts); Ctrl and
// Alt combinations belong to other shortcuts; in a tool waiting for a measure, − is the measure's sign.

export type ViewKey = { readonly zoom: number } | { readonly pan: { readonly x: number; readonly y: number } };

const PAN_PX = 80;
const ZOOM = 1.25;

export function viewKey(key: string, m: { shift: boolean; ctrl: boolean; alt: boolean; typing: boolean }): ViewKey | null {
  if (m.ctrl || m.alt) return null;
  if (key === '+' || key === '=') return { zoom: ZOOM };
  if (key === '-' && !m.typing) return { zoom: 1 / ZOOM };
  if (!m.shift) return null;
  // The content follows the arrow's opposite, as dragging the view would: left shows what is left.
  const pan: Record<string, { x: number; y: number }> = {
    ArrowLeft: { x: PAN_PX, y: 0 },
    ArrowRight: { x: -PAN_PX, y: 0 },
    ArrowUp: { x: 0, y: PAN_PX },
    ArrowDown: { x: 0, y: -PAN_PX },
  };
  return pan[key] ? { pan: pan[key]! } : null;
}
