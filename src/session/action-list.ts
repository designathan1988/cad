// The actions by name (actions.ts), as the bars, the menus, the keys and the tips read them:
// within a render built once and shared, outside one built fresh (F-0011), and each one's key as the user has it.

import type { Action } from './actions';
import type { App } from './app';

/**
 * Every action by name. Within a render built once and shared (the title tips, the bars
 * and the context entries each built all of them, every frame of a drag or an orbit); outside one built
 * fresh, so what a key or a click runs is never from a state gone by.
 */
export function actionsNow(app: App): Action[] {
  if (!app.actionCache.rendering) return app.buildActions();
  return (app.actionCache.frame ??= app.buildActions());
}

/**
 * An action's key as the user has it now (actions.ts through keymap.ts), for a text or a tip that teaches it,
 * so a key changed in the keys dialog is the one said everywhere; the action's name in quotes when it has none.
 */
export function keyName(app: App, id: string): string {
  const a = actionsNow(app).find((x) => x.id === id);
  return a?.keys ?? `“${a?.label ?? id}”`;
}

/** A render, with the actions it builds shared by its readers and let go after it. */
export function renderSharing(app: App, render: () => void): void {
  app.actionCache.rendering = true;
  app.actionCache.frame = null;
  try {
    render();
  } finally {
    app.actionCache.rendering = false;
    app.actionCache.frame = null;
  }
}
