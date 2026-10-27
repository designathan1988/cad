// The object editor (phase 4: no code): a definition edited as a draft, then saved in one undo step
// (every object of it follows), or dropped. Its name and category; tabs for its parameters, parts,
// handles, types and rules, each a table of fields; numbers and formulas typed as in the formulas
// (elements/object/formula.ts: 60cm, largura/2, if(fundo, 1, 0)), the names of the parameters offered
// as one types. Beside them a live 3D preview turned by dragging, sliders that flex each parameter (the
// Revit test: does it still hold?), and what does not work out.

import { creaseEdges, cutGeometries, pieceGeometry } from '../elements/kinds/object';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { App } from '../app/app';
import { addDefinition, updateDefinition } from '../elements/object/commands';
import { evaluateObject } from '../elements/object/evaluate';
import { words } from '../elements/object/fields';
import { evaluateFormula, parseFormula } from '../elements/object/formula';
import type { DefinitionCategory, Expr, HandleDef, ObjectDefinition, ParamDef, ParamKind, Part, RuleDef, Words } from '../elements/object/schema';
import { isDefinition } from '../elements/object/valid';
import { el } from './controls';
import { getLang, materialLabel, t, type MessageKey } from './i18n';
import { icon } from './icons';

type Tab = 'params' | 'parts' | 'handles' | 'types' | 'rules';
const TABS: readonly Tab[] = ['params', 'parts', 'handles', 'types', 'rules'];
const KINDS: readonly ParamKind[] = ['length', 'number', 'integer', 'bool', 'choice', 'material'];
const CATEGORIES: readonly DefinitionCategory[] = ['furniture', 'casework', 'fixture', 'equipment', 'lighting', 'plant', 'generic'];
const NAME = /^[A-Za-z_À-ÿ][\wÀ-ÿ]*$/;

/** A number or formula as typed: a plain number stays a number, the rest a formula. */
const exprOf = (text: string): Expr => {
  const s = text.trim();
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s;
};
const exprText = (e: Expr | undefined): string => (e === undefined ? '' : String(e));

export function editDefinition(app: App, start: ObjectDefinition, isNew: boolean, done: () => void): void {
  const back = app.shell.helpBack;
  let draft: ObjectDefinition = structuredClone(start) as ObjectDefinition;
  let tab: Tab = 'params';
  /** The sliders' values (flexing, not saved), and the preview's turn and tilt. */
  let flex: Record<string, number> = {};
  let yaw = -0.6;
  let pitch = 0.45;
  let preview: Preview | null = null;

  const close = () => {
    window.removeEventListener('keydown', onKey, true);
    preview?.dispose();
    back.hidden = true;
    back.replaceChildren();
    done();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    close();
  };
  const set = (next: ObjectDefinition) => {
    draft = next;
    draw();
  };

  /** What does not work out in the draft: names, then the evaluation's problems, then its rules. */
  const problems = (): string[] => {
    const out: string[] = [];
    const names = draft.params.map((p) => p.name);
    for (const p of draft.params) if (!NAME.test(p.name)) out.push(t('ed.badName', { name: p.name || '—' }));
    for (const n of new Set(names)) if (names.filter((x) => x === n).length > 1) out.push(t('ed.twice', { name: n }));
    if (draft.types.length === 0) out.push(t('ed.noType'));
    const doc = app.store.get();
    const ev = evaluateObject(draft, previewInstance(), { definitions: [...doc.definitions.filter((d) => d.id !== draft.id), draft], materials: doc.materials });
    out.push(...ev.problems, ...ev.warnings.map(words));
    return out;
  };
  const previewInstance = () => ({ id: 'object_editor', levelId: '', definitionId: draft.id, typeId: draft.types[0]?.id ?? '', at: { x: 0, y: 0 }, angle: 0, elevation: 0, values: flex });

  // ---------- fields ----------
  const input = (value: string, onCommit: (v: string) => void, focus: string, label: string, list?: string, cls = 'text-field ed-in') => {
    const i = el('input', { type: 'text', class: cls, autocomplete: 'off', spellcheck: 'false', 'aria-label': label, ...(list ? { list } : {}) });
    i.value = value;
    i.dataset.focus = focus;
    i.title = label;
    // A formula that does not read is marked as it is typed; committed on leaving the field or Enter.
    i.addEventListener('input', () => i.classList.toggle('invalid', i.value.trim() !== '' && !/^-?\d+(\.\d+)?$/.test(i.value.trim()) && list === 'ed-names' && !parseFormula(i.value).ok));
    i.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') i.blur();
    });
    i.addEventListener('change', () => onCommit(i.value));
    return i;
  };
  const choose = <T extends string>(options: readonly { value: T; label: string }[], value: T, onChange: (v: T) => void, focus: string, label: string) => {
    const s = el('select', { class: 'ed-select', 'aria-label': label });
    for (const o of options) s.append(new Option(o.label, o.value, o.value === value, o.value === value));
    s.dataset.focus = focus;
    s.addEventListener('change', () => onChange(s.value as T));
    return s;
  };
  const remove = (label: string, focus: string, run: () => void) => {
    const b = el('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label });
    b.innerHTML = icon('trash', 16);
    b.dataset.focus = focus;
    b.addEventListener('click', run);
    return b;
  };
  const addButton = (label: string, focus: string, run: () => void) => {
    const b = el('button', { type: 'button', class: 'icon-btn text-btn' });
    b.innerHTML = icon('plus', 16);
    b.append(label);
    b.dataset.focus = focus;
    b.addEventListener('click', run);
    return b;
  };
  const wordsIn = (w: Words, onCommit: (w: Words) => void, focus: string, label: string) => {
    const lang = getLang();
    return input(lang === 'pt' ? w.pt : w.en, (v) => onCommit(lang === 'pt' ? { ...w, pt: v.trim() } : { ...w, en: v.trim() }), focus, label);
  };
  const replaceAt = <T>(list: readonly T[], i: number, x: T): T[] => list.map((y, k) => (k === i ? x : y));
  /** A table's column heads, laid out as its rows (`cls`). */
  const head = (cls: string, ...cols: string[]) => el('div', { class: `ed-row ${cls} ed-head`, 'aria-hidden': 'true' }, ...cols.map((c) => el('span', {}, c)));
  const materialOptions = () => [
    ...draft.params.filter((p) => p.kind === 'material').map((p) => ({ value: p.name, label: `${t('ed.param')}: ${words(p.label)}` })),
    ...app.store.get().materials.map((m) => ({ value: m.id, label: materialLabel(m) })),
  ];

  // ---------- tabs ----------
  const paramsTab = (): HTMLElement[] => {
    const rows = draft.params.map((p, i) => {
      const upd = (q: Partial<ParamDef>) => set({ ...draft, params: replaceAt(draft.params, i, { ...p, ...q } as ParamDef) });
      const numberIn = (key: 'default' | 'min' | 'max', label: string) =>
        input(
          p[key] === undefined ? '' : String(p[key]),
          (v) => {
            if (v.trim() === '' && key !== 'default') {
              const { [key]: _gone, ...rest } = p;
              set({ ...draft, params: replaceAt(draft.params, i, rest as ParamDef) });
              return;
            }
            if (p.kind === 'material' && key === 'default') return upd({ default: v.trim() });
            const n = evaluateFormula(v, {});
            if (n.ok) upd({ [key]: n.value } as Partial<ParamDef>);
            else draw();
          },
          `p${i}:${key}`,
          label,
        );
      return el(
        'div',
        { class: 'ed-row ed-params', role: 'group', 'aria-label': p.name },
        input(p.name, (v) => renameParam(i, v.trim()), `p${i}:name`, t('ed.name')),
        wordsIn(p.label, (w) => upd({ label: w }), `p${i}:label`, t('ed.label')),
        choose(KINDS.map((k) => ({ value: k, label: t(`ed.kind.${k}` as MessageKey) })), p.kind, (k) => upd({ kind: k, default: k === 'material' ? 'wood' : typeof p.default === 'number' ? p.default : 0 }), `p${i}:kind`, t('ed.kind')),
        p.kind === 'material'
          ? choose(app.store.get().materials.map((m) => ({ value: m.id, label: materialLabel(m) })), String(p.default), (v) => upd({ default: v }), `p${i}:default`, t('ed.default'))
          : numberIn('default', t('ed.default')),
        p.kind === 'material' || p.kind === 'bool' ? el('span') : numberIn('min', t('ed.min')),
        p.kind === 'material' || p.kind === 'bool' ? el('span') : numberIn('max', t('ed.max')),
        input(p.formula ?? '', (v) => (v.trim() === '' ? set({ ...draft, params: replaceAt(draft.params, i, withoutKey(p, 'formula')) }) : upd({ formula: v.trim() })), `p${i}:formula`, t('ed.formula'), 'ed-names'),
        remove(t('ed.removeParam', { name: p.name }), `p${i}:remove`, () => set({ ...draft, params: draft.params.filter((_, k) => k !== i) })),
      );
    });
    return [
      head('ed-params', t('ed.name'), t('ed.label'), t('ed.kind'), t('ed.default'), t('ed.min'), t('ed.max'), t('ed.formula'), ''),
      ...rows,
      addButton(t('ed.addParam'), 'addParam', () => {
        let n = draft.params.length + 1;
        while (draft.params.some((p) => p.name === `p${n}`)) n++;
        set({ ...draft, params: [...draft.params, { name: `p${n}`, label: { pt: `Parâmetro ${n}`, en: `Parameter ${n}` }, kind: 'length', default: 0.5, min: 0, max: 10, step: 0.005 }] });
      }),
      el('p', { class: 'mat-note' }, t('ed.paramsNote')),
    ];
  };

  /** A parameter renamed, and every formula that names it with it. */
  const renameParam = (i: number, name: string) => {
    const old = draft.params[i]!.name;
    if (name === old || name === '') return draw();
    const re = new RegExp(`(?<![\\wÀ-ÿ])${old}(?![\\wÀ-ÿ])`, 'g');
    const swap = (e: Expr): Expr => (typeof e === 'string' ? e.replace(re, name) : e);
    const swapAll = <T>(x: T): T => JSON.parse(JSON.stringify(x), (k, v) => (typeof v === 'string' && ['x', 'y', 'z', 'w', 'd', 'h', 'r', 'r2', 'count', 'dx', 'dy', 'dz', 'when', 'angle', 'formula', 'watts', 'kelvin'].includes(k) ? swap(v) : v)) as T;
    set({
      ...draft,
      params: draft.params.map((p, k) => (k === i ? { ...p, name } : swapAll(p))),
      parts: swapAll(draft.parts).map((p) => (p.material === old ? { ...p, material: name } : p)),
      handles: draft.handles.map((h) => ({ ...h, param: h.param === old ? name : h.param, at: h.at.map(swap) as unknown as HandleDef['at'] })),
      types: draft.types.map((ty) => ({ ...ty, values: Object.fromEntries(Object.entries(ty.values).map(([k, v]) => [k === old ? name : k, v])) })),
      ...(draft.rules ? { rules: draft.rules.map((r) => ({ ...r, when: swap(r.when) as string })) } : {}),
      ...(draft.light ? { light: swapAll(draft.light) } : {}),
    });
  };

  const partsTab = (): HTMLElement[] => {
    const defs = app.store.get().definitions.filter((d) => d.id !== draft.id);
    const cards = draft.parts.map((p, i) => {
      const upd = (q: Partial<Part>) => set({ ...draft, parts: replaceAt(draft.parts, i, { ...p, ...q } as Part) });
      const ex = (key: string, label: string) =>
        el('label', { class: 'ed-cell' }, el('span', {}, label), input(exprText((p as unknown as Record<string, Expr>)[key]), (v) => upd({ [key]: exprOf(v) } as Partial<Part>), `k${i}:${key}`, `${label}: ${t('ed.part')} ${i + 1}`, 'ed-names'));
      // A cylinder's top radius: empty, the base's (a cylinder); another, a cone or a lampshade.
      const top =
        p.kind === 'cylinder'
          ? el(
              'label',
              { class: 'ed-cell' },
              el('span', {}, t('ed.r2')),
              input(exprText(p.r2), (v) => (v.trim() === '' ? set({ ...draft, parts: replaceAt(draft.parts, i, withoutKey(p, 'r2') as Part) }) : upd({ r2: exprOf(v) } as Partial<Part>)), `k${i}:r2`, `${t('ed.r2')}: ${t('ed.part')} ${i + 1}`, 'ed-names'),
            )
          : null;
      // A box's edges' radius: empty, square; another, a cushion's or an appliance's rounded ones.
      // A box's optional edges' radius and leaning: empty, none (square, upright).
      const optional = (key: 'round' | 'tilt' | 'roll' | 'turn', label: string) =>
        el(
          'label',
          { class: 'ed-cell' },
          el('span', {}, label),
          input(exprText((p as unknown as Record<string, Expr | undefined>)[key]), (v) => (v.trim() === '' ? set({ ...draft, parts: replaceAt(draft.parts, i, withoutKey(p, key) as Part) }) : upd({ [key]: exprOf(v) } as Partial<Part>)), `k${i}:${key}`, `${label}: ${t('ed.part')} ${i + 1}`, 'ed-names'),
        );
      const round = p.kind === 'box' ? optional('round', t('ed.round')) : null;
      const size =
        p.kind === 'profile' || p.kind === 'revolve'
          ? [
              ...(p.kind === 'profile' ? [ex('h', t('ed.h'))] : []),
              (() => {
                // One corner a line, its x and y as formulas split by ';' (a formula's own commas stay).
                const area = el('textarea', { class: 'ed-points', rows: '4', spellcheck: 'false', 'data-focus': `k${i}:points`, 'aria-label': `${t('ed.points')}: ${t('ed.part')} ${i + 1}` }) as HTMLTextAreaElement;
                area.value = p.points.map(([a, b]) => `${exprText(a)}; ${exprText(b)}`).join('\n');
                area.addEventListener('change', () => {
                  const points = area.value
                    .split('\n')
                    .map((line) => line.split(';'))
                    .filter((xy) => xy.length === 2 && xy[0]!.trim() !== '' && xy[1]!.trim() !== '')
                    .map(([a, b]) => [exprOf(a!), exprOf(b!)] as const);
                  if (points.length >= (p.kind === 'revolve' ? 2 : 3)) upd({ points } as Partial<Part>);
                  else area.value = p.points.map(([a, b]) => `${exprText(a)}; ${exprText(b)}`).join('\n');
                });
                return el('label', { class: 'ed-cell ed-points-cell' }, el('span', {}, t(p.kind === 'revolve' ? 'ed.revolvePoints' : 'ed.points')), area);
              })(),
            ]
          : p.kind === 'box' ? [ex('w', t('ed.w')), ex('d', t('ed.d')), ex('h', t('ed.h')), round!, optional('tilt', t('ed.tilt')), optional('roll', t('ed.roll')), optional('turn', t('ed.turn'))] : p.kind === 'mesh' ? [ex('w', t('ed.w')), ex('d', t('ed.d')), ex('h', t('ed.h'))] : p.kind === 'cylinder' ? [ex('r', t('ed.r')), top!, ex('h', t('ed.h')), optional('tilt', t('ed.tilt')), optional('roll', t('ed.roll')), optional('turn', t('ed.turn'))] : p.kind === 'sphere' ? [ex('r', t('ed.r')), ex('h', t('ed.h'))] : [ex('angle', t('ed.angle'))];
      const rep = p.repeat;
      const repIn = (key: 'count' | 'dx' | 'dy' | 'dz', label: string) =>
        el(
          'label',
          { class: 'ed-cell' },
          el('span', {}, label),
          input(exprText(rep?.[key]), (v) => {
            const next = { ...(rep ?? { count: 1 }), [key]: exprOf(v) };
            if (key === 'count' && v.trim() === '') return set({ ...draft, parts: replaceAt(draft.parts, i, withoutKey(p, 'repeat') as Part) });
            upd({ repeat: next as NonNullable<Part['repeat']> });
          }, `k${i}:${key}`, `${label}: ${t('ed.part')} ${i + 1}`, 'ed-names'),
        );
      return el(
        'div',
        { class: 'ed-card', role: 'group', 'aria-label': `${t('ed.part')} ${i + 1}` },
        el(
          'div',
          { class: 'ed-card-head' },
          el('b', {}, `${i + 1}. ${t(`ed.partKind.${p.kind}` as MessageKey)}`),
          wordsIn(p.name ?? { pt: '', en: '' }, (w) => upd({ name: w }), `k${i}:name`, t('ed.name')),
          p.kind === 'object'
            ? choose(defs.map((d) => ({ value: d.id, label: words(d.name) })), p.definition, (v) => upd({ definition: v } as Partial<Part>), `k${i}:def`, t('ed.definition'))
            : choose(materialOptions(), p.material ?? 'plaster', (v) => upd({ material: v }), `k${i}:mat`, t('ed.material')),
          // A void: taken out of the other parts (an object's part is never one).
          ...(p.kind === 'object'
            ? [el('span', {})]
            : [
                (() => {
                  const box = el('input', { type: 'checkbox', 'data-focus': `k${i}:cut` }) as HTMLInputElement;
                  box.checked = p.cut === true;
                  box.addEventListener('change', () => (box.checked ? upd({ cut: true }) : set({ ...draft, parts: replaceAt(draft.parts, i, withoutKey(p, 'cut') as Part) })));
                  return el('label', { class: 'ed-cut', title: t('ed.cutTip') }, box, el('span', {}, t('ed.cut')));
                })(),
              ]),
          remove(t('ed.removePart', { n: i + 1 }), `k${i}:remove`, () => set({ ...draft, parts: draft.parts.filter((_, k) => k !== i) })),
        ),
        el('div', { class: 'ed-grid' }, ex('x', 'x'), ex('y', 'y'), ex('z', 'z'), ...size),
        el('div', { class: 'ed-grid' }, repIn('count', t('ed.count')), repIn('dx', 'dx'), repIn('dy', 'dy'), repIn('dz', 'dz'), ex('when', t('ed.when'))),
      );
    });
    const blank = (kind: Exclude<Part['kind'], 'mesh'>): Part =>
      kind === 'box'
        ? { kind, name: { pt: 'Caixa', en: 'Box' }, x: 0, y: 0, z: 0, w: 0.2, d: 0.2, h: 0.2 }
        : kind === 'cylinder'
          ? { kind, name: { pt: 'Cilindro', en: 'Cylinder' }, x: 0, y: 0, z: 0, r: 0.1, h: 0.2 }
          : kind === 'revolve'
            ? { kind, name: { pt: 'Revolução', en: 'Revolve' }, x: 0, y: 0, z: 0, points: [[0.1, 0], [0.15, 0.1], [0.08, 0.3], [0.12, 0.4]] }
          : kind === 'profile'
            ? { kind, name: { pt: 'Perfil', en: 'Profile' }, x: 0, y: 0, z: 0, points: [[0, 0], [0.4, 0], [0.4, 0.2], [0.2, 0.4], [0, 0.4]], h: 0.1 }
          : kind === 'sphere'
            ? { kind, name: { pt: 'Esfera', en: 'Sphere' }, x: 0, y: 0, z: 0, r: 0.1, h: 0.2 }
            : { kind, name: { pt: 'Objeto', en: 'Object' }, definition: defs[0]?.id ?? '', x: 0, y: 0, z: 0 };
    // Its light, a luminaire's: where (as a part's x, y, z), its power and its colour temperature.
    const light = draft.light;
    const lightCard = light
      ? el(
          'div',
          { class: 'ed-card', role: 'group', 'aria-label': t('ed.light') },
          el('div', { class: 'ed-card-head' }, el('b', {}, t('ed.light')), remove(t('ed.removeLight'), 'light:remove', () => set(withoutKey(draft, 'light')))),
          el(
            'div',
            { class: 'ed-grid' },
            ...(
              [
                ['x', 'x'],
                ['y', 'y'],
                ['z', 'z'],
                ['watts', t('ed.watts')],
                ['kelvin', t('ed.kelvin')],
              ] as const
            ).map(([key, label]) =>
              el(
                'label',
                { class: 'ed-cell' },
                el('span', {}, label),
                input(exprText(light[key]), (v) => (key === 'kelvin' && v.trim() === '' ? set({ ...draft, light: withoutKey(light, 'kelvin') }) : set({ ...draft, light: { ...light, [key]: exprOf(v) } })), `light:${key}`, `${label}: ${t('ed.light')}`, 'ed-names'),
              ),
            ),
          ),
        )
      : null;
    return [
      ...cards,
      ...(lightCard ? [lightCard] : []),
      el(
        'div',
        { class: 'ed-adds' },
        addButton(t('ed.addBox'), 'addBox', () => set({ ...draft, parts: [...draft.parts, blank('box')] })),
        addButton(t('ed.addCylinder'), 'addCyl', () => set({ ...draft, parts: [...draft.parts, blank('cylinder')] })),
        addButton(t('ed.addSphere'), 'addSphere', () => set({ ...draft, parts: [...draft.parts, blank('sphere')] })),
        addButton(t('ed.addProfile'), 'addProfile', () => set({ ...draft, parts: [...draft.parts, blank('profile')] })),
        addButton(t('ed.addRevolve'), 'addRevolve', () => set({ ...draft, parts: [...draft.parts, blank('revolve')] })),
        ...(defs.length ? [addButton(t('ed.addObject'), 'addObj', () => set({ ...draft, parts: [...draft.parts, blank('object')] }))] : []),
        ...(light ? [] : [addButton(t('ed.addLight'), 'addLight', () => set({ ...draft, light: { x: 0, y: 0, z: 2, watts: 9, kelvin: 3000 } }))]),
      ),
      el('p', { class: 'mat-note' }, t('ed.partsNote')),
    ];
  };

  const handlesTab = (): HTMLElement[] => {
    const params = draft.params.filter((p) => p.formula === undefined && p.kind !== 'material' && p.kind !== 'bool' && p.kind !== 'choice');
    const rows = draft.handles.map((h, i) => {
      const upd = (q: Partial<HandleDef>) => set({ ...draft, handles: replaceAt(draft.handles, i, { ...h, ...q }) });
      return el(
        'div',
        { class: 'ed-row ed-handles', role: 'group', 'aria-label': `${t('ed.handle')} ${i + 1}` },
        choose(params.map((p) => ({ value: p.name, label: words(p.label) })), h.param, (v) => upd({ param: v }), `h${i}:param`, t('ed.param')),
        choose((['x', 'y', 'z'] as const).map((a) => ({ value: a, label: a })), h.axis, (v) => upd({ axis: v }), `h${i}:axis`, t('ed.axis')),
        choose([{ value: '1', label: '+' }, { value: '-1', label: '−' }], String(h.sign ?? 1), (v) => upd({ sign: v === '-1' ? -1 : 1 }), `h${i}:sign`, t('ed.sign')),
        ...[0, 1, 2].map((k) => input(exprText(h.at[k]), (v) => upd({ at: replaceAt(h.at, k, exprOf(v)) as unknown as HandleDef['at'] }), `h${i}:at${k}`, `${t('ed.at')} ${'xyz'[k]}`, 'ed-names')),
        input(String(h.shift ?? 0), (v) => {
          const n = evaluateFormula(v, {});
          if (n.ok) upd({ shift: n.value });
          else draw();
        }, `h${i}:shift`, t('ed.shift')),
        remove(t('ed.removeHandle', { n: i + 1 }), `h${i}:remove`, () => set({ ...draft, handles: draft.handles.filter((_, k) => k !== i) })),
      );
    });
    return [
      head('ed-handles', t('ed.param'), t('ed.axis'), t('ed.sign'), 'x', 'y', 'z', t('ed.shift'), ''),
      ...rows,
      ...(params.length ? [addButton(t('ed.addHandle'), 'addHandle', () => set({ ...draft, handles: [...draft.handles, { param: params[0]!.name, axis: 'x', at: [0, 0, 0], shift: 0.5 }] }))] : []),
      el('p', { class: 'mat-note' }, t('ed.handlesNote')),
    ];
  };

  const typesTab = (): HTMLElement[] => {
    const params = draft.params.filter((p) => p.formula === undefined);
    const rows = draft.types.map((ty, i) => {
      const upd = (q: Partial<typeof ty>) => set({ ...draft, types: replaceAt(draft.types, i, { ...ty, ...q }) });
      return el(
        'div',
        { class: 'ed-card', role: 'group', 'aria-label': words(ty.name) },
        el(
          'div',
          { class: 'ed-card-head' },
          el('b', {}, `${i + 1}.`),
          wordsIn(ty.name, (w) => upd({ name: w }), `t${i}:name`, t('ed.name')),
          remove(t('ed.removeType', { name: words(ty.name) }), `t${i}:remove`, () => draft.types.length > 1 && set({ ...draft, types: draft.types.filter((_, k) => k !== i) })),
        ),
        el(
          'div',
          { class: 'ed-grid' },
          ...params.map((p) =>
            el(
              'label',
              { class: 'ed-cell' },
              el('span', {}, words(p.label)),
              p.kind === 'material'
                ? choose([{ value: '', label: '—' }, ...app.store.get().materials.map((m) => ({ value: m.id, label: materialLabel(m) }))], String(ty.values[p.name] ?? ''), (v) => {
                    const { [p.name]: _gone, ...rest } = ty.values;
                    upd({ values: v === '' ? rest : { ...rest, [p.name]: v } });
                  }, `t${i}:${p.name}`, `${words(p.label)}: ${words(ty.name)}`)
                : input(ty.values[p.name] === undefined ? '' : String(ty.values[p.name]), (v) => {
                    const { [p.name]: _gone, ...rest } = ty.values;
                    if (v.trim() === '') return upd({ values: rest });
                    const n = evaluateFormula(v, {});
                    if (n.ok) upd({ values: { ...rest, [p.name]: n.value } });
                    else draw();
                  }, `t${i}:${p.name}`, `${words(p.label)}: ${words(ty.name)}`),
            ),
          ),
        ),
      );
    });
    return [
      ...rows,
      addButton(t('ed.addType'), 'addType', () => {
        let n = draft.types.length + 1;
        while (draft.types.some((x) => x.id === `type${n}`)) n++;
        set({ ...draft, types: [...draft.types, { id: `type${n}`, name: { pt: `Tipo ${n}`, en: `Type ${n}` }, values: {} }] });
      }),
      el('p', { class: 'mat-note' }, t('ed.typesNote')),
    ];
  };

  const rulesTab = (): HTMLElement[] => {
    const rules = draft.rules ?? [];
    const rows = rules.map((r, i) => {
      const upd = (q: Partial<RuleDef>) => set({ ...draft, rules: replaceAt(rules, i, { ...r, ...q }) });
      return el(
        'div',
        { class: 'ed-row ed-rules', role: 'group', 'aria-label': `${t('ed.rule')} ${i + 1}` },
        input(r.when, (v) => upd({ when: v.trim() }), `r${i}:when`, t('ed.when'), 'ed-names'),
        wordsIn(r.message, (w) => upd({ message: w }), `r${i}:message`, t('ed.message')),
        remove(t('ed.removeRule', { n: i + 1 }), `r${i}:remove`, () => set({ ...draft, rules: rules.filter((_, k) => k !== i) })),
      );
    });
    return [
      head('ed-rules', t('ed.when'), t('ed.message'), ''),
      ...rows,
      addButton(t('ed.addRule'), 'addRule', () => set({ ...draft, rules: [...rules, { when: '0', message: { pt: 'Mensagem', en: 'Message' } }] })),
      el('p', { class: 'mat-note' }, t('ed.rulesNote')),
    ];
  };

  // ---------- the dialog ----------
  const draw = () => {
    const a = document.activeElement;
    const key = a instanceof HTMLElement && back.contains(a) ? a.dataset.focus : undefined;
    const names = el('datalist', { id: 'ed-names' }, ...draft.params.map((p) => new Option(p.name)));
    const tabs = el('div', { class: 'segmented ed-tabs', role: 'tablist' });
    for (const x of TABS) {
      const b = el('button', { type: 'button', role: 'tab', 'aria-selected': String(x === tab), 'aria-pressed': String(x === tab) }, t(`ed.tab.${x}` as MessageKey));
      b.dataset.focus = `tab:${x}`;
      b.addEventListener('click', () => {
        tab = x;
        draw();
      });
      tabs.append(b);
    }
    const body = el('div', { class: 'ed-body' }, ...(tab === 'params' ? paramsTab() : tab === 'parts' ? partsTab() : tab === 'handles' ? handlesTab() : tab === 'types' ? typesTab() : rulesTab()));
    // The preview: the draft with the sliders' values, turned by dragging. One for the whole edit (a
    // browser keeps few WebGL contexts): its canvas moves into each drawing of the dialog.
    const canvas = preview?.canvasEl ?? el('canvas', { class: 'ed-preview', 'aria-label': t('ed.preview') });
    const sliders = el('div', { class: 'ed-sliders', role: 'group', 'aria-label': t('ed.flex') });
    const doc = app.store.get();
    const evNow = evaluateObject(draft, previewInstance(), { definitions: [...doc.definitions.filter((d) => d.id !== draft.id), draft], materials: doc.materials });
    for (const p of draft.params) {
      if (p.formula !== undefined || p.kind === 'material' || p.kind === 'choice') continue;
      const v = evNow.env[p.name] ?? 0;
      const lo = p.min ?? Math.min(0, v);
      const hi = p.max ?? Math.max(1, v * 2);
      const r = el('input', { type: 'range', min: String(lo), max: String(hi), step: String(p.kind === 'integer' || p.kind === 'bool' ? 1 : (hi - lo) / 200), 'aria-label': words(p.label) });
      r.value = String(v);
      r.dataset.focus = `flex:${p.name}`;
      r.addEventListener('input', () => {
        flex = { ...flex, [p.name]: Number(r.value) };
        preview?.update(draft, flex);
      });
      r.addEventListener('change', () => draw());
      sliders.append(el('label', { class: 'ed-slider' }, el('span', {}, words(p.label)), r));
    }
    const said = problems();
    const status = el('div', { class: said.length ? 'ed-problems' : 'ed-ok', role: 'status' }, said.length ? said.join(' · ') : t('ed.allGood'));
    const nameRow = el(
      'div',
      { class: 'ed-name' },
      el('label', { class: 'ed-cell' }, el('span', {}, `${t('ed.name')} (pt)`), input(draft.name.pt, (v) => set({ ...draft, name: { ...draft.name, pt: v.trim() || draft.name.pt } }), 'name:pt', `${t('ed.name')} (pt)`)),
      el('label', { class: 'ed-cell' }, el('span', {}, `${t('ed.name')} (en)`), input(draft.name.en, (v) => set({ ...draft, name: { ...draft.name, en: v.trim() || draft.name.en } }), 'name:en', `${t('ed.name')} (en)`)),
      el('label', { class: 'ed-cell' }, el('span', {}, t('ed.category')), choose(CATEGORIES.map((c) => ({ value: c, label: t(`ed.cat.${c}` as MessageKey) })), draft.category, (v) => set({ ...draft, category: v }), 'category', t('ed.category'))),
      // Its folder in the library: any name, the project's others offered; empty, its category's.
      el(
        'label',
        { class: 'ed-cell' },
        el('span', {}, t('ed.folder')),
        input(draft.folder ?? '', (v) => set(v.trim() === '' ? withoutKey(draft, 'folder') : { ...draft, folder: v.trim() }), 'folder', t('ed.folder'), 'ed-folders'),
        el('datalist', { id: 'ed-folders' }, ...[...new Set(doc.definitions.flatMap((d) => (d.folder ? [d.folder] : [])))].map((f) => new Option(f))),
      ),
    );
    const saveBtn = el('button', { type: 'button', class: 'icon-btn text-btn primary' }, t('ed.save'));
    saveBtn.dataset.focus = 'save';
    const savable = isDefinition(draft) && draft.params.every((p) => NAME.test(p.name)) && new Set(draft.params.map((p) => p.name)).size === draft.params.length;
    saveBtn.toggleAttribute('disabled', !savable);
    saveBtn.addEventListener('click', () => {
      app.store.dispatch(isNew ? addDefinition(draft) : updateDefinition(draft));
      isNew = false;
      close();
    });
    const cancel = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('ed.cancel'));
    cancel.dataset.focus = 'cancel';
    cancel.addEventListener('click', close);
    back.replaceChildren(
      el(
        'div',
        { class: 'dialog dialog-xl ed-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('ed.title', { name: words(draft.name) }) },
        el('h2', {}, t('ed.title', { name: words(draft.name) })),
        nameRow,
        el('div', { class: 'ed-main' }, el('div', { class: 'ed-left' }, tabs, body, names), el('div', { class: 'ed-right' }, canvas, sliders, status)),
        el('div', { class: 'actions' }, el('span', { class: 'spacer' }), cancel, saveBtn),
      ),
    );
    back.hidden = false;
    preview ??= new Preview(canvas, () => [yaw, pitch], (y, p) => {
      yaw = y;
      pitch = p;
    });
    preview.update(draft, flex);
    const target = (key && back.querySelector<HTMLElement>(`[data-focus="${CSS.escape(key)}"]`)) || back.querySelector<HTMLElement>(`[data-focus="tab:${tab}"]`);
    target?.focus();
  };

  /** The 3D preview of the draft: its pieces in their materials, lit, framed, turned by dragging. */
  class Preview {
    private readonly renderer: THREE.WebGLRenderer;
    private readonly scene = new THREE.Scene();
    private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
    private readonly group = new THREE.Group();
    private centre = new THREE.Vector3();
    private radius = 1;
    get canvasEl(): HTMLCanvasElement {
      return this.canvas;
    }
    constructor(
      private readonly canvas: HTMLCanvasElement,
      private readonly view: () => [number, number],
      private readonly turned: (yaw: number, pitch: number) => void,
    ) {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(window.devicePixelRatio || 1);
      // A room's light around it, as the realistic 3D has: what metals, mirrors and glazes reflect.
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environmentIntensity = 0.4;
      pmrem.dispose();
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 0.9));
      const sun = new THREE.DirectionalLight(0xffffff, 1.4);
      sun.position.set(3, 6, 4);
      this.scene.add(sun, this.group);
      let from: { x: number; y: number } | null = null;
      canvas.addEventListener('pointerdown', (e) => {
        from = { x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!from) return;
        const [y, p] = this.view();
        this.turned(y - (e.clientX - from.x) * 0.01, Math.max(-0.1, Math.min(1.4, p + (e.clientY - from.y) * 0.01)));
        from = { x: e.clientX, y: e.clientY };
        this.render();
      });
      canvas.addEventListener('pointerup', () => (from = null));
    }
    update(def: ObjectDefinition, values: Record<string, number>): void {
      const doc = app.store.get();
      const ev = evaluateObject(def, { ...previewInstance(), values }, { definitions: [...doc.definitions.filter((d) => d.id !== def.id), def], materials: doc.materials });
      for (const c of [...this.group.children]) {
        const m = c as THREE.Mesh;
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
        this.group.remove(c);
      }
      const box = new THREE.Box3();
      // The solid parts with the voids taken out, and each void a faint ghost to place it by.
      const drawn = [...cutGeometries(ev.pieces), ...ev.pieces.filter((p) => p.cut).map((piece) => ({ piece, geometry: pieceGeometry(piece) }))];
      for (const { piece: p, geometry: g } of drawn) {
        const mesh = new THREE.Mesh(g, p.cut ? new THREE.MeshStandardMaterial({ color: 0xd04040, transparent: true, opacity: 0.18, depthWrite: false }) : new THREE.MeshStandardMaterial({ color: p.material.color, roughness: p.material.roughness, metalness: p.material.metalness }));
        const edges = new THREE.LineSegments(g.userData.cut ? creaseEdges(g, 30) : new THREE.EdgesGeometry(g, 30), new THREE.LineBasicMaterial({ color: 0x2b2f36, transparent: true, opacity: 0.5 }));
        mesh.add(edges);
        this.group.add(mesh);
        box.expandByObject(mesh);
      }
      if (!box.isEmpty()) {
        box.getCenter(this.centre);
        this.radius = Math.max(0.2, box.getSize(new THREE.Vector3()).length() / 2);
      }
      this.render();
    }
    render(): void {
      const w = this.canvas.clientWidth || 320;
      const h = this.canvas.clientHeight || 240;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      const [yaw, pitch] = this.view();
      const dist = this.radius / Math.sin((this.camera.fov * Math.PI) / 360) * 1.15;
      this.camera.position.set(this.centre.x + dist * Math.cos(pitch) * Math.sin(yaw), this.centre.y + dist * Math.sin(pitch), this.centre.z + dist * Math.cos(pitch) * Math.cos(yaw));
      this.camera.lookAt(this.centre);
      this.camera.updateProjectionMatrix();
      this.renderer.render(this.scene, this.camera);
    }
    dispose(): void {
      for (const c of this.group.children) {
        const m = c as THREE.Mesh;
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      this.renderer.dispose();
      // Given back to the browser now, not when it is collected: the next editor gets a context.
      this.renderer.forceContextLoss();
    }
  }

  window.addEventListener('keydown', onKey, true);
  draw();
}

const withoutKey = <T extends object>(x: T, key: string): T => {
  const { [key]: _gone, ...rest } = x as Record<string, unknown>;
  return rest as T;
};
