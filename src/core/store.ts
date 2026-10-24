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
  /** Replaces the document and clears history, as when a project is opened. */
  readonly reset: (doc: D) => void;
  readonly subscribe: (listener: (doc: D) => void) => () => void;
}

export function createStore<D>(initial: D): Store<D> {
  let doc = initial;
  let past: D[] = [];
  let future: D[] = [];
  const listeners = new Set<(doc: D) => void>();
  const emit = () => listeners.forEach((l) => l(doc));
  return {
    get: () => doc,
    dispatch(command) {
      const next = command.apply(doc);
      if (next === doc) return;
      past.push(doc);
      future = [];
      doc = next;
      emit();
    },
    undo() {
      const prev = past.pop();
      if (prev === undefined) return false;
      future.push(doc);
      doc = prev;
      emit();
      return true;
    },
    redo() {
      const next = future.pop();
      if (next === undefined) return false;
      past.push(doc);
      doc = next;
      emit();
      return true;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    reset(next) {
      doc = next;
      past = [];
      future = [];
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
