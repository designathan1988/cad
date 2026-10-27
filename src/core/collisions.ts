// Whether collisions are on (app/collision.ts): read by the panels that set heights (nothing below the
// floor while on). The app keeps it with its preferences and sets it here.

let on = true;

export const collisionsOn = (): boolean => on;
export const setCollisions = (value: boolean): void => {
  on = value;
};
