// The console's errors and the page's uncaught ones, kept for the diagnostics panel (F7): seen in the
// app itself, without opening the browser's tools.

export interface LoggedError {
  readonly at: number;
  readonly text: string;
}

const MAX = 50;
const errors: LoggedError[] = [];
let onChange: () => void = () => {};

function add(text: string): void {
  errors.push({ at: Date.now(), text });
  if (errors.length > MAX) errors.shift();
  onChange();
}

/** Starts keeping them; `changed` is called on each new one. */
export function watchErrors(changed: () => void): void {
  onChange = changed;
  window.addEventListener('error', (e) => add(e.error instanceof Error ? (e.error.stack ?? e.error.message) : e.message));
  window.addEventListener('unhandledrejection', (e) => add(e.reason instanceof Error ? (e.reason.stack ?? e.reason.message) : String(e.reason)));
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    original(...args);
    add(args.map((a) => (a instanceof Error ? (a.stack ?? a.message) : typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };
}

export const loggedErrors = (): readonly LoggedError[] => errors;

export function clearErrors(): void {
  errors.length = 0;
  onChange();
}
