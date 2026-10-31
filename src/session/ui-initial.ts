// The session's state when the app starts: the preferences remembered in this browser, else the defaults,
// over the project opened (its first level, wall type and the like).

import { OPENING_MODELS } from '../elements/opening/style';
import { OPENING_DEFAULTS } from '../elements/opening/schema';
import type { UiState } from './state';
import { OPENING_IDLE } from '../elements/opening/tool';
import { MEASURE_IDLE } from '../elements/measure/tool';
import { IDLE } from '../elements/wall/tool';
import { DIMENSION_IDLE } from '../tools/dimension-tool';
import { type Doc, startLevel } from '../project/doc';
import { loadPrefs } from '../project/persist';
import { readView3D } from './view/view-3d';
import { NO_DRAFT } from '../elements/tool-draft';

export function initialUi(doc: Doc, prefs: ReturnType<typeof loadPrefs>): UiState {
  return {
    view: prefs.view ?? 'plan',
    tool: 'select',
    draft: NO_DRAFT,
    selection: new Set(),
    hover: null,
    roomSpace: null,
    tapToConfirm: false,
    levelId: startLevel(doc, prefs.levelId),
    theme: prefs.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    panelOpen: prefs.panelOpen ?? true,
    panelPeek: false,
    browserOpen: prefs.browserOpen ?? false,
    hidden: new Set(),
    temp: null,
    snaps: prefs.snaps !== false,
    collisions: prefs.collisions !== false,
    snapParts: prefs.snapParts ?? 3,
    snapSkip: [],
    lock: null,
    acquired: [],
    drawFrom: null,
    smart: null,
    overridesOn: true,
    guideMode: 'line',
    defaults: { wallTypeId: doc.wallTypes[0]!.id, referenceLine: 'centerline', baseOffset: 0, top: { kind: 'level', offset: 0 } },
    wall: IDLE,
    opening: OPENING_IDLE,
    // A new door or window is made with a make (style.ts) so all of it can be changed: a panelled oak door, a two-pane sliding window.
    openingDefaults: { door: { ...OPENING_DEFAULTS.door, style: OPENING_MODELS.find((m) => m.id === 'doorPanelsOak')!.style }, window: { ...OPENING_DEFAULTS.window, style: OPENING_MODELS.find((m) => m.id === 'winSliding2')!.style } },
    snap: null,
    cursor: null,
    error: null,
    info: null,
    drag: null,
    measure: MEASURE_IDLE,
    measureMode: 'distance',
    dimension: DIMENSION_IDLE,
    calibrate: null,
    objectDef: 'def_table',
    objectAngle: 0,
    doorFlip: { swing: false, hinge: false },
    opened: new Set(),
    markMode: 'angle',
    viewDen: null,
    guide: null,
    view3d: readView3D(prefs.view3d),
    modify: null,
    refLines: prefs.refLines ?? false,
    openingTags: prefs.openingTags ?? true,
    wallFlip: false,
    dimEdit: null,
  };
}
