// Single source of every geometric tolerance. Changing a value here requires a new ADR.

/** Wall ends closer than this meet (m). */
export const POINT_TOLERANCE = 1e-3;
/** Directions closer than this to 0° or 180° are treated as in line (degrees). */
export const COLLINEAR_ANGLE = 0.6;
/** A miter reaching further than this multiple of the thicker wall is cut square. */
export const MITER_LIMIT = 10;
/** Walls shorter than this are invalid (m). */
export const MIN_WALL_LENGTH = 1e-3;
/** The least height, width or thickness a building element is given, however it is set (m): never 0 or less. */
export const MIN_ELEMENT_SIZE = 0.01;
/** Pieces smaller than this are dropped (m²). */
export const AREA_EPSILON = 1e-9;
/** Largest gap between an arc face and its chords (m). See docs/adr/0001-arc-sag.md. */
export const ARC_SAG = 5e-4;

// The 3D faces' and edges' own scales (they compare merged outlines, not joints): a face only touches
// when it is within a tenth of the point tolerance, and lengths shorter than this are nothing.
export const FACE_TOUCH = 1e-4;
export const LENGTH_EPS = 1e-6;
/** Layer seams' collinearity, tighter than the point tolerance (a seam is drawn, not joined). */
export const SEAM_TOL = 1e-7;
/** A sector's arm is off its face by less than this (join/sectors.ts). */
export const OFF_FACE = 1e-9;
