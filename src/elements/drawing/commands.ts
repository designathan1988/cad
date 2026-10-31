// The drawing settings' commands: one undo step each.

import { type DrawingSettings, isDrawingSettings } from './schema';
import type { Command } from '../../core/store';
import { type Doc, drawingOf } from '../../project/doc';

export const setDrawing = (drawing: DrawingSettings): Command<Doc> => ({
  label: 'cmd.setDrawing',
  apply: (doc) => (!isDrawingSettings(drawing) || JSON.stringify(drawingOf(doc)) === JSON.stringify(drawing) ? doc : { ...doc, drawing }),
});
