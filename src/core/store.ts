// The only way the project changes: a command turns one immutable version into the next. Each
// dispatch is one undo step, whatever it changed.

export interface Command<D> {
  /** Message key of what the user did, for the undo tooltip. */
  readonly label: string;
  readonly apply: (doc: D) => D;
}

export interface Store<D> {
  readonly get: () => D;
  readonly dispatch: (command: Command<D>) => void;
  readonly undo: () => boolean;
  readonly redo: () => boolean;
  readonly canUndo: () => boolean;
  readonly canRedo: () => boolean;
  /** The label of what Ctrl+Z would undo, and of what Ctrl+Shift+Z would redo; null when none. */
  readonly undoLabel: () => string | null;
  readonly redoLabel: () => string | null;
  /** Replaces the document and clears history, as when a project is opened. */
  readonly reset: (doc: D) => void;
  readonly subscribe: (listener: (doc: D) => void) => () => void;
}

export function createStore<D>(initial: D): Store<D> {
  let doc = initial;
  let past: D[] = [];
  let future: D[] = [];
  // The label of each step, beside the version it leads away from (past) or back to (future).
  let pastLabels: string[] = [];
  let futureLabels: string[] = [];
  const listeners = new Set<(doc: D) => void>();
  const emit = () => listeners.forEach((l) => l(doc));
  return {
    get: () => doc,
    dispatch(command) {
      const next = command.apply(doc);
      if (next === doc) return;
      past.push(doc);
      pastLabels.push(command.label);
      future = [];
      futureLabels = [];
      doc = next;
      emit();
    },
    undo() {
      const prev = past.pop();
      if (prev === undefined) return false;
      future.push(doc);
      futureLabels.push(pastLabels.pop() ?? '');
      doc = prev;
      emit();
      return true;
    },
    redo() {
      const next = future.pop();
      if (next === undefined) return false;
      past.push(doc);
      pastLabels.push(futureLabels.pop() ?? '');
      doc = next;
      emit();
      return true;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    undoLabel: () => pastLabels.at(-1) ?? null,
    redoLabel: () => futureLabels.at(-1) ?? null,
    reset(next) {
      doc = next;
      past = [];
      future = [];
      pastLabels = [];
      futureLabels = [];
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
