// One stroke icon set: 24 × 24, stroke 2, round caps, drawn once here and used everywhere.

const paths = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  chevronDown: 'm6 9 6 6 6-6',
  chevronRight: 'm9 6 6 6-6 6',
  cube: 'M21 16V8l-9-5-9 5v8l9 5zM3.3 7.5 12 12l8.7-4.5M12 22V12',
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
  walk: 'M13 4a1 1 0 1 0 0-.01M10 21l2-6-2-3 1-5 3 3 3 1M7 12l2-4 2-1',
  command: 'M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3',
  keyboard: 'M2 6h20v12H2zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  folder: 'M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  panel: 'M3 4h18v16H3zM15 4v16',
  sidebar: 'M3 4h18v16H3zM9 4v16',
  pointer: 'M4 4l7 17 2.5-7.5L21 11z',
  wall: 'M3 6h18M3 18h18M6 6v12M10 6v12M14 6v12M18 6v12',
  slab: 'M2 12l10-5 10 5-10 5zM2 12v2l10 5 10-5v-2',
  door: 'M6 21V3h10v18M6 21h12M13 12h.01M16 3l3 2v16',
  window: 'M4 4h16v16H4zM12 4v16M4 12h16',
  room: 'M3 3h18v18H3zM3 12h7M14 3v7M14 14v7',
  dimension: 'M3 12h18M3 8v8M21 8v8M7 12l-2-2M7 12l-2 2M17 12l2-2M17 12l2 2',
  ruler: 'M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
  close: 'M6 6l12 12M18 6 6 18',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6',
  arrowUp: 'M12 19V5M5 12l7-7 7 7',
  arrowDown: 'M12 5v14M19 12l-7 7-7-7',
  plus: 'M12 5v14M5 12h14',
  fileNew: 'M14 3H6v18h12V7zM14 3v4h4M12 11v6M9 14h6',
  zoomSel: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M11 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 13l2 2',
  frame: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  magnet: 'M6 4h4v8a2 2 0 0 0 4 0V4h4v8a6 6 0 0 1-12 0zM6 8h4M14 8h4',
  refCenter: 'M4 7h16M4 17h16M4 12h3M10 12h4M17 12h3',
  refExterior: 'M4 7h16M4 17h16M4 7.5h16',
  refInterior: 'M4 7h16M4 17h16M4 16.5h16',
  warning: 'M12 3 2 20h20zM12 9v5M12 17h.01',
  flip: 'M7 4 3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7',
  swing: 'M5 20V4M5 4a15 15 0 0 1 15 16H5',
  center: 'M12 3v18M7 8l-4 4 4 4M17 8l4 4-4 4',
  distribute: 'M4 4v16M20 4v16M8 9h3v6H8zM13 9h3v6h-3z',
  guide: 'M3 21l3-3M9 15l3-3M15 9l3-3M20 4l1-1',
} as const;

export type IconName = keyof typeof paths;

/** An icon's drawing, for composing it into something else (ui/cursors.ts). */
export const iconPath = (name: IconName): string => paths[name];

export function icon(name: IconName, size = 18): string {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
}
