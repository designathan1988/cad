// The persisted shape of the 3D view preference (session/view/view-3d.ts owns the live state and
// re-exports this type).
import type { SectionBox, SectionLine } from '../model/section-box';
import type { LevelsShown, RenderQuality, VisualStyle } from '../session/view/view-3d';

export interface View3D {
  readonly levels: LevelsShown;
  readonly explode: boolean;
  readonly cut: boolean;
  readonly xray: boolean;
  /** The section box: only what is inside it shows; null when off (section-box.ts). */
  readonly box: SectionBox | null;
  /** Parallel (orthographic) instead of in perspective: elevations and sections. */
  readonly ortho: boolean;
  /** A vertical section through a line in plan (section-box.ts); null when none. */
  readonly section: SectionLine | null;
  readonly style: VisualStyle;
  readonly quality: RenderQuality;
  /** How bright the whole view is, and how strong the sun is against the sky (1: as drawn; LIGHT_RANGE). */
  readonly brightness: number;
  readonly sun: number;
}
