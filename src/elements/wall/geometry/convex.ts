// The exact clipping core (spec §4) lives in model/clip.ts: half-plane Sutherland-Hodgman is not
// wall-specific geometry (the section box clips with it too). This file keeps the engine API.
export * from '../../../model/clip';
