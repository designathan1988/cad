// A stack of layers, listed from one face to the other: what wall types have now, and floor and slab
// types will have (ref/chat.txt:87, 135). Pure operations, each returning a new list (or the same list
// when nothing changes), so every editor of layers shares them.

export interface StackLayer {
  readonly thickness: number;
}

export type StackProblem = 'noLayers' | 'badThickness';

/** Why a stack cannot be used: no layer, or a layer whose thickness is not a positive number. */
export function stackProblem(layers: readonly StackLayer[]): StackProblem | null {
  if (layers.length === 0) return 'noLayers';
  return layers.every((l) => Number.isFinite(l.thickness) && l.thickness > 0) ? null : 'badThickness';
}

/** A copy of layer `at`, right after it: a new layer starts from its neighbour. */
export function addLayer<L extends StackLayer>(layers: readonly L[], at: number): L[] {
  const src = layers[at] ?? layers[layers.length - 1];
  if (!src) return [...layers];
  return [...layers.slice(0, at + 1), { ...src }, ...layers.slice(at + 1)];
}

/** Without layer `at`; the last layer is never removed. */
export function removeLayer<L extends StackLayer>(layers: readonly L[], at: number): readonly L[] {
  if (layers.length <= 1 || at < 0 || at >= layers.length) return layers;
  return layers.filter((_, i) => i !== at);
}

/** Layer `from` moved to place `to`; out of the list, the same list. */
export function moveLayer<L extends StackLayer>(layers: readonly L[], from: number, to: number): readonly L[] {
  if (from === to || from < 0 || to < 0 || from >= layers.length || to >= layers.length) return layers;
  const out = [...layers];
  const [moved] = out.splice(from, 1);
  out.splice(to, 0, moved!);
  return out;
}

/** Layer `at` with some of its values changed. */
export function setLayer<L extends StackLayer>(layers: readonly L[], at: number, patch: Partial<L>): readonly L[] {
  if (at < 0 || at >= layers.length) return layers;
  return layers.map((l, i) => (i === at ? { ...l, ...patch } : l));
}
