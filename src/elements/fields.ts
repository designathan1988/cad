// The field schema the elements' properties are described with (elements/*/fields.ts build these; the
// ui/fields renderer turns them into rows). A data contract, not chrome: this lives with the elements.

import type { IconName } from '../i18n/icons';
import type { MessageKey } from '../i18n/messages';

interface Common<T> {
  readonly id: string;
  readonly label: MessageKey;
  /** What the label's {placeholders} say ("Side {n}"). */
  readonly labelVars?: Readonly<Record<string, string | number>>;
  /** Drawn before the label, to tell the fields apart at a glance; by default the one FIELD_ICONS gives its id. */
  readonly icon?: IconName;
  /** The label over the control, both across the panel: a segmented control with words needs the width. */
  readonly wide?: boolean;
  /** Indented under the field before it. */
  readonly sub?: boolean;
  /** Shown only for these selections (default: always). */
  readonly when?: (items: readonly T[]) => boolean;
  /** Some selected element sets this value over its type's; `reset` gives it back to the type. */
  readonly own?: (items: readonly T[]) => boolean;
  readonly reset?: () => void;
  /** What the value comes from when not set (a room's height: its level's), for the way back and the note. */
  readonly ownWords?: { readonly reset: MessageKey; readonly note: MessageKey };
}

/** `short`: what a segmented button shows under its icon, the full label being its name and tooltip. */
export type FieldOption = { readonly value: string; readonly label: string; readonly short?: string; readonly icon?: IconName; readonly thumb?: string; readonly keywords?: string };

export type Field<T> =
  /** `min`: the lowest value, or one that depends on what is selected (an arc's radius: half its chord). */
  | (Common<T> & {
      readonly kind: 'number';
      readonly get: (x: T) => number;
      readonly set: (v: number) => void;
      readonly min?: number | ((items: readonly T[]) => number);
      /** What the value is in, after it: metres unless said ("°" for an angle). */
      readonly unit?: string;
      /** Places shown after the decimal mark (2 unless said; 0 for a count). */
      readonly decimals?: number;
    })
  | (Common<T> & { readonly kind: 'text'; readonly get: (x: T) => string; readonly set: (v: string) => void; /** Shown while it is empty: what empty means, or an example. */ readonly placeholder?: string })
  | (Common<T> & {
      readonly kind: 'select' | 'segmented' | 'search';
      readonly get: (x: T) => string;
      readonly set: (v: string) => void;
      readonly options: readonly FieldOption[];
      /** Segmented: the label beside each icon, not only as its name. */
      readonly labelled?: boolean;
    })
  | (Common<T> & { readonly kind: 'readout'; readonly text: (items: readonly T[]) => string })
  /** A note across the whole row. */
  | (Common<T> & { readonly kind: 'note'; readonly text: (items: readonly T[]) => string })
  /** A button across the whole row, named by what it does. */
  | (Common<T> & { readonly kind: 'action'; readonly run: () => void; readonly enabled?: (items: readonly T[]) => boolean });

export interface FieldState<T> {
  readonly field: Field<T>;
  /** The common value (a readout's text); null when the selected elements differ. */
  readonly value: number | string | null;
}
