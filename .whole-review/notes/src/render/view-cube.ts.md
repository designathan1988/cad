# src/render/view-cube.ts
Lines: 66
Summary: The 3D view's orientation cube: six CSS-3D button faces (front, right, top, back, left, bottom) in a box turned by matrix3d to follow the camera, plus a home button. Clicking a face reports the direction the camera should look from; the vertical faces are nudged off the pole so the camera's up stays defined.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: a CSS 3D cube turning with the camera; a face click looks from that side
- 3-5 imports: three, the icon set, i18n t()
- 7-15 FACES: label key, three.js direction where the camera sits, and the CSS transform placing the face 30 px out from the centre
- 17-21 ViewCube fields: root, inner box, face buttons, home button
- 23-45 constructor: the wrapper, the cube and its inner box, one button per face (top/bottom given a 0.0001 z nudge), the home button with its icon, labels set
- 47-55 relabel: text, title and aria-label of each face and the home button from i18n (called on language change)
- 57-65 update: the inverse camera quaternion as a rotation matrix (column-major, like CSS matrix3d), conjugated by diag(1,-1,1,1) to flip the y axis for CSS, written as matrix3d

## Contracts, state and data flow
- Holds only DOM; the caller (app.ts) gives onFace/onHome and calls update with the camera after every frame (frame.ts:268, app.ts:363).
- Uses the quaternion rather than matrixWorldInverse so it is right before the scene renders.

## Depends on / used by
- uses: three (Vector3, Matrix4, Quaternion), ui/icons, ui/i18n
- used by: app/app.ts (357-363, 385-386, 1406-1407), app/frame.ts:268

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/matrix3d : the 16 values are column-major, last column the translation, which matches three.js Matrix4.elements (lines 57-65)
