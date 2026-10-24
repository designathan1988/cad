// Editing a stack of layers, from the exterior face to the interior: function, thickness and material
// of each, moving one toward either face, adding and removing. Generic over the layer, so wall types
// use it now and floor and slab types can later (ref/chat.txt:87, 135). It only reads the layers and
// reports the next list; the stack operations are in elements/layers/stack.ts.

import { addLayer, moveLayer, removeLayer, setLayer } from '../elements/layers/stack';
import { coreLayersOf } from '../elements/wall/geometry/shape';
import { LAYER_PRIORITY, type LayerFunction } from '../elements/wall/schema';
import { el, numberField, select } from './controls';
import { textField } from './fields';
import { num, t, type MessageKey } from './i18n';
import { icon, type IconName } from './icons';
import { layerBands } from './swatch';

export interface EditableLayer {
  readonly thickness: number;
  readonly function: LayerFunction;
  readonly materialId: string;
}

const FUNCTIONS = Object.keys(LAYER_PRIORITY) as LayerFunction[];

export function layerEditor<L extends EditableLayer>(layers: readonly L[], onChange: (next: readonly L[]) => void): HTMLElement {
  const box = el('div', { class: 'layer-editor' });
  const [core0, core1] = coreLayersOf(layers);
  const total = layers.reduce((s, l) => s + l.thickness, 0);

  // The stack as it stands, exterior on the left: the thumbnail, large.
  const bands = layerBands(layers, 240)
    .map((b) => `<rect x="${b.x}" y="0" width="${b.w}" height="24" fill="${b.fill}"/>`)
    .join('');
  const preview = el('div', { class: 'layer-preview' });
  preview.insertAdjacentHTML('beforeend', `<svg width="240" height="24" viewBox="0 0 240 24" aria-hidden="true">${bands}</svg>`);
  preview.append(el('div', { class: 'layer-ends' }, el('span', {}, t('types.exterior')), el('span', {}, t('types.interior'))));

  const grid = el('div', { class: 'layer-grid', role: 'group', 'aria-label': t('types.layers') });
  grid.append(
    el('span', { class: 'layer-head' }, '#'),
    el('span', { class: 'layer-head' }, t('types.function')),
    el('span', { class: 'layer-head' }, t('types.thickness')),
    el('span', { class: 'layer-head' }, t('types.material')),
    el('span', { class: 'layer-head' }, t('types.core')),
    el('span', { class: 'layer-head' }),
  );
  const button = (glyph: IconName, label: string, focus: string, enabled: boolean, run: () => void, why?: string) => {
    const b = el('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: why ? `${label}: ${why.charAt(0).toLowerCase()}${why.slice(1)}` : label });
    b.innerHTML = icon(glyph, 16);
    b.dataset.focus = focus;
    b.disabled = !enabled;
    b.addEventListener('click', run);
    return b;
  };
  layers.forEach((l, i) => {
    const n = String(i + 1);
    const which = t('types.layerN', { n });
    const fn = select(
      FUNCTIONS.map((f) => ({ value: f, label: t(`fn.${f}` as MessageKey) })),
      l.function,
      (v) => onChange(setLayer(layers, i, { function: v } as Partial<L>)),
    );
    fn.querySelector('select')!.setAttribute('aria-label', `${t('types.function')}: ${which}`);
    const thick = numberField(l.thickness, (v) => onChange(setLayer(layers, i, { thickness: v } as Partial<L>)), 0.001);
    thick.querySelector('input')!.setAttribute('aria-label', `${t('types.thickness')}: ${which}`);
    const material = textField(l.materialId, (v) => v.trim() !== '' && onChange(setLayer(layers, i, { materialId: v.trim() } as Partial<L>)));
    material.querySelector('input')!.setAttribute('aria-label', `${t('types.material')}: ${which}`);
    const inCore = i >= core0 && i <= core1;
    // Not by colour alone: a mark, and its words for screen readers.
    const core = el('span', { class: 'layer-core' }, inCore ? '●' : '');
    if (inCore) core.append(el('span', { class: 'sr-only' }, t('types.isCore')));
    const actions = el(
      'div',
      { class: 'layer-actions' },
      button('arrowUp', t('types.moveUp', { n }), `up:${i}`, i > 0, () => onChange(moveLayer(layers, i, i - 1))),
      button('arrowDown', t('types.moveDown', { n }), `down:${i}`, i < layers.length - 1, () => onChange(moveLayer(layers, i, i + 1))),
      button('trash', t('types.remove', { n }), `remove:${i}`, layers.length > 1, () => onChange(removeLayer(layers, i)), layers.length > 1 ? undefined : t('types.cantRemoveLast')),
    );
    grid.append(el('span', { class: 'layer-n' }, n), fn, thick, material, core, actions);
  });

  const add = el('button', { type: 'button', class: 'icon-btn text-btn' });
  add.innerHTML = icon('plus', 16);
  add.append(t('types.addLayer'));
  add.dataset.focus = 'addLayer';
  add.addEventListener('click', () => onChange(addLayer(layers, layers.length - 1)));

  box.append(
    el('h3', {}, t('types.layers')),
    preview,
    grid,
    el('div', { class: 'layer-foot' }, add, el('span', { class: 'layer-total', role: 'status' }, t('types.total', { t: num(total, 3) }))),
  );
  return box;
}
