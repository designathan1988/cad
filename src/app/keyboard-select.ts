// Choosing elements without a mouse (ref/chat.txt:242): the element Tab (or Shift+Tab) goes to from
// the selection, in the order of the level's elements, going round. Pure.

export function stepSelection(order: readonly string[], selected: readonly string[], dir: 1 | -1): string | null {
  if (order.length === 0) return null;
  const at = selected.map((id) => order.indexOf(id)).filter((i) => i >= 0);
  if (at.length === 0) return dir === 1 ? order[0]! : order[order.length - 1]!;
  const from = dir === 1 ? Math.max(...at) : Math.min(...at);
  return order[(from + dir + order.length) % order.length]!;
}
