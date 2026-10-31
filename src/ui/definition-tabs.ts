import type { App } from '../session/app';
import { words } from '../elements/object/fields';
import { evaluateFormula } from '../elements/object/formula';
import type { Expr, HandleDef, ObjectDefinition, ParamDef, ParamKind, Part, RuleDef } from '../elements/object/schema';
import { el } from './controls';
import { materialLabel, type MessageKey, t } from '../i18n/messages';
import type { EditorState } from './definition-editor';
import type { EditorKit } from './definition-kit';



/** What the tabs use of the editor run around them. */
export interface TabDeps {
  readonly ed: EditorState;
  readonly kit: EditorKit;
  readonly set: (next: ObjectDefinition) => void;
  readonly draw: () => void;
}

export function editorTabs(app: App, d: TabDeps) {
  const { ed, set, draw } = d;
  const { input, choose, remove, addButton, wordsIn, replaceAt, head, materialOptions } = d.kit;
  // ---------- tabs ----------
  const paramsTab = (): HTMLElement[] => {
    const rows = ed.draft.params.map((p, i) => {
      const upd = (q: Partial<ParamDef>) => set({ ...ed.draft, params: replaceAt(ed.draft.params, i, { ...p, ...q } as ParamDef) });
      const numberIn = (key: 'default' | 'min' | 'max', label: string) =>
        input(
          p[key] === undefined ? '' : String(p[key]),
          (v) => {
            if (v.trim() === '' && key !== 'default') {
              const { [key]: _gone, ...rest } = p;
              set({ ...ed.draft, params: replaceAt(ed.draft.params, i, rest as ParamDef) });
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
        input(p.formula ?? '', (v) => (v.trim() === '' ? set({ ...ed.draft, params: replaceAt(ed.draft.params, i, withoutKey(p, 'formula')) }) : upd({ formula: v.trim() })), `p${i}:formula`, t('ed.formula'), 'ed-names'),
        remove(t('ed.removeParam', { name: p.name }), `p${i}:remove`, () => set({ ...ed.draft, params: ed.draft.params.filter((_, k) => k !== i) })),
      );
    });
    return [
      head('ed-params', t('ed.name'), t('ed.label'), t('ed.kind'), t('ed.default'), t('ed.min'), t('ed.max'), t('ed.formula'), ''),
      ...rows,
      addButton(t('ed.addParam'), 'addParam', () => {
        let n = ed.draft.params.length + 1;
        while (ed.draft.params.some((p) => p.name === `p${n}`)) n++;
        set({ ...ed.draft, params: [...ed.draft.params, { name: `p${n}`, label: { pt: `Parâmetro ${n}`, en: `Parameter ${n}` }, kind: 'length', default: 0.5, min: 0, max: 10, step: 0.005 }] });
      }),
      el('p', { class: 'mat-note' }, t('ed.paramsNote')),
    ];
  };

  /** A parameter renamed, and every formula that names it with it. */
  const renameParam = (i: number, name: string) => {
    const old = ed.draft.params[i]!.name;
    if (name === old || name === '') return draw();
    const re = new RegExp(`(?<![\\wÀ-ÿ])${old}(?![\\wÀ-ÿ])`, 'g');
    const swap = (e: Expr): Expr => (typeof e === 'string' ? e.replace(re, name) : e);
    const swapAll = <T>(x: T): T => JSON.parse(JSON.stringify(x), (k, v) => (typeof v === 'string' && ['x', 'y', 'z', 'w', 'd', 'h', 'r', 'r2', 'count', 'dx', 'dy', 'dz', 'when', 'angle', 'formula', 'watts', 'kelvin'].includes(k) ? swap(v) : v)) as T;
    set({
      ...ed.draft,
      params: ed.draft.params.map((p, k) => (k === i ? { ...p, name } : swapAll(p))),
      parts: swapAll(ed.draft.parts).map((p) => (p.material === old ? { ...p, material: name } : p)),
      handles: ed.draft.handles.map((h) => ({ ...h, param: h.param === old ? name : h.param, at: h.at.map(swap) as unknown as HandleDef['at'] })),
      types: ed.draft.types.map((ty) => ({ ...ty, values: Object.fromEntries(Object.entries(ty.values).map(([k, v]) => [k === old ? name : k, v])) })),
      ...(ed.draft.rules ? { rules: ed.draft.rules.map((r) => ({ ...r, when: swap(r.when) as string })) } : {}),
      ...(ed.draft.light ? { light: swapAll(ed.draft.light) } : {}),
    });
  };

  const partsTab = (): HTMLElement[] => {
    const defs = app.store.get().definitions.filter((d) => d.id !== ed.draft.id);
    const cards = ed.draft.parts.map((p, i) => {
      const upd = (q: Partial<Part>) => set({ ...ed.draft, parts: replaceAt(ed.draft.parts, i, { ...p, ...q } as Part) });
      const ex = (key: string, label: string) =>
        el('label', { class: 'ed-cell' }, el('span', {}, label), input(exprText((p as unknown as Record<string, Expr>)[key]), (v) => upd({ [key]: exprOf(v) } as Partial<Part>), `k${i}:${key}`, `${label}: ${t('ed.part')} ${i + 1}`, 'ed-names'));
      // A cylinder's top radius: empty, the base's (a cylinder); another, a cone or a lampshade.
      const top =
        p.kind === 'cylinder'
          ? el(
              'label',
              { class: 'ed-cell' },
              el('span', {}, t('ed.r2')),
              input(exprText(p.r2), (v) => (v.trim() === '' ? set({ ...ed.draft, parts: replaceAt(ed.draft.parts, i, withoutKey(p, 'r2') as Part) }) : upd({ r2: exprOf(v) } as Partial<Part>)), `k${i}:r2`, `${t('ed.r2')}: ${t('ed.part')} ${i + 1}`, 'ed-names'),
            )
          : null;
      // A box's edges' radius: empty, square; another, a cushion's or an appliance's rounded ones.
      // A box's optional edges' radius and leaning: empty, none (square, upright).
      const optional = (key: 'round' | 'tilt' | 'roll' | 'turn' | 'd', label: string) =>
        el(
          'label',
          { class: 'ed-cell' },
          el('span', {}, label),
          input(exprText((p as unknown as Record<string, Expr | undefined>)[key]), (v) => (v.trim() === '' ? set({ ...ed.draft, parts: replaceAt(ed.draft.parts, i, withoutKey(p, key) as Part) }) : upd({ [key]: exprOf(v) } as Partial<Part>)), `k${i}:${key}`, `${label}: ${t('ed.part')} ${i + 1}`, 'ed-names'),
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
          : p.kind === 'box' ? [ex('w', t('ed.w')), ex('d', t('ed.d')), ex('h', t('ed.h')), round!, optional('tilt', t('ed.tilt')), optional('roll', t('ed.roll')), optional('turn', t('ed.turn'))] : p.kind === 'mesh' ? [ex('w', t('ed.w')), ex('d', t('ed.d')), ex('h', t('ed.h'))] : p.kind === 'cylinder' ? [ex('r', t('ed.r')), top!, ex('h', t('ed.h')), optional('tilt', t('ed.tilt')), optional('roll', t('ed.roll')), optional('turn', t('ed.turn'))] : p.kind === 'sphere' ? [ex('r', t('ed.r')), optional('d', t('ed.ry')), ex('h', t('ed.h')), optional('tilt', t('ed.tilt')), optional('roll', t('ed.roll')), optional('turn', t('ed.turn'))] : [ex('angle', t('ed.angle'))];
      const rep = p.repeat;
      const repIn = (key: 'count' | 'dx' | 'dy' | 'dz', label: string) =>
        el(
          'label',
          { class: 'ed-cell' },
          el('span', {}, label),
          input(exprText(rep?.[key]), (v) => {
            const next = { ...(rep ?? { count: 1 }), [key]: exprOf(v) };
            if (key === 'count' && v.trim() === '') return set({ ...ed.draft, parts: replaceAt(ed.draft.parts, i, withoutKey(p, 'repeat') as Part) });
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
                  box.addEventListener('change', () => (box.checked ? upd({ cut: true }) : set({ ...ed.draft, parts: replaceAt(ed.draft.parts, i, withoutKey(p, 'cut') as Part) })));
                  return el('label', { class: 'ed-cut', title: t('ed.cutTip') }, box, el('span', {}, t('ed.cut')));
                })(),
              ]),
          remove(t('ed.removePart', { n: i + 1 }), `k${i}:remove`, () => set({ ...ed.draft, parts: ed.draft.parts.filter((_, k) => k !== i) })),
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
    const light = ed.draft.light;
    const lightCard = light
      ? el(
          'div',
          { class: 'ed-card', role: 'group', 'aria-label': t('ed.light') },
          el('div', { class: 'ed-card-head' }, el('b', {}, t('ed.light')), remove(t('ed.removeLight'), 'light:remove', () => set(withoutKey(ed.draft, 'light')))),
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
                input(exprText(light[key]), (v) => (key === 'kelvin' && v.trim() === '' ? set({ ...ed.draft, light: withoutKey(light, 'kelvin') }) : set({ ...ed.draft, light: { ...light, [key]: exprOf(v) } })), `light:${key}`, `${label}: ${t('ed.light')}`, 'ed-names'),
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
        addButton(t('ed.addBox'), 'addBox', () => set({ ...ed.draft, parts: [...ed.draft.parts, blank('box')] })),
        addButton(t('ed.addCylinder'), 'addCyl', () => set({ ...ed.draft, parts: [...ed.draft.parts, blank('cylinder')] })),
        addButton(t('ed.addSphere'), 'addSphere', () => set({ ...ed.draft, parts: [...ed.draft.parts, blank('sphere')] })),
        addButton(t('ed.addProfile'), 'addProfile', () => set({ ...ed.draft, parts: [...ed.draft.parts, blank('profile')] })),
        addButton(t('ed.addRevolve'), 'addRevolve', () => set({ ...ed.draft, parts: [...ed.draft.parts, blank('revolve')] })),
        ...(defs.length ? [addButton(t('ed.addObject'), 'addObj', () => set({ ...ed.draft, parts: [...ed.draft.parts, blank('object')] }))] : []),
        ...(light ? [] : [addButton(t('ed.addLight'), 'addLight', () => set({ ...ed.draft, light: { x: 0, y: 0, z: 2, watts: 9, kelvin: 3000 } }))]),
      ),
      el('p', { class: 'mat-note' }, t('ed.partsNote')),
    ];
  };

  const handlesTab = (): HTMLElement[] => {
    const params = ed.draft.params.filter((p) => p.formula === undefined && p.kind !== 'material' && p.kind !== 'bool' && p.kind !== 'choice');
    const rows = ed.draft.handles.map((h, i) => {
      const upd = (q: Partial<HandleDef>) => set({ ...ed.draft, handles: replaceAt(ed.draft.handles, i, { ...h, ...q }) });
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
        remove(t('ed.removeHandle', { n: i + 1 }), `h${i}:remove`, () => set({ ...ed.draft, handles: ed.draft.handles.filter((_, k) => k !== i) })),
      );
    });
    return [
      head('ed-handles', t('ed.param'), t('ed.axis'), t('ed.sign'), 'x', 'y', 'z', t('ed.shift'), ''),
      ...rows,
      ...(params.length ? [addButton(t('ed.addHandle'), 'addHandle', () => set({ ...ed.draft, handles: [...ed.draft.handles, { param: params[0]!.name, axis: 'x', at: [0, 0, 0], shift: 0.5 }] }))] : []),
      el('p', { class: 'mat-note' }, t('ed.handlesNote')),
    ];
  };

  const typesTab = (): HTMLElement[] => {
    const params = ed.draft.params.filter((p) => p.formula === undefined);
    const rows = ed.draft.types.map((ty, i) => {
      const upd = (q: Partial<typeof ty>) => set({ ...ed.draft, types: replaceAt(ed.draft.types, i, { ...ty, ...q }) });
      return el(
        'div',
        { class: 'ed-card', role: 'group', 'aria-label': words(ty.name) },
        el(
          'div',
          { class: 'ed-card-head' },
          el('b', {}, `${i + 1}.`),
          wordsIn(ty.name, (w) => upd({ name: w }), `t${i}:name`, t('ed.name')),
          remove(t('ed.removeType', { name: words(ty.name) }), `t${i}:remove`, () => ed.draft.types.length > 1 && set({ ...ed.draft, types: ed.draft.types.filter((_, k) => k !== i) })),
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
        let n = ed.draft.types.length + 1;
        while (ed.draft.types.some((x) => x.id === `type${n}`)) n++;
        set({ ...ed.draft, types: [...ed.draft.types, { id: `type${n}`, name: { pt: `Tipo ${n}`, en: `Type ${n}` }, values: {} }] });
      }),
      el('p', { class: 'mat-note' }, t('ed.typesNote')),
    ];
  };

  const rulesTab = (): HTMLElement[] => {
    const rules = ed.draft.rules ?? [];
    const rows = rules.map((r, i) => {
      const upd = (q: Partial<RuleDef>) => set({ ...ed.draft, rules: replaceAt(rules, i, { ...r, ...q }) });
      return el(
        'div',
        { class: 'ed-row ed-rules', role: 'group', 'aria-label': `${t('ed.rule')} ${i + 1}` },
        input(r.when, (v) => upd({ when: v.trim() }), `r${i}:when`, t('ed.when'), 'ed-names'),
        wordsIn(r.message, (w) => upd({ message: w }), `r${i}:message`, t('ed.message')),
        remove(t('ed.removeRule', { n: i + 1 }), `r${i}:remove`, () => set({ ...ed.draft, rules: rules.filter((_, k) => k !== i) })),
      );
    });
    return [
      head('ed-rules', t('ed.when'), t('ed.message'), ''),
      ...rows,
      addButton(t('ed.addRule'), 'addRule', () => set({ ...ed.draft, rules: [...rules, { when: '0', message: { pt: 'Mensagem', en: 'Message' } }] })),
      el('p', { class: 'mat-note' }, t('ed.rulesNote')),
    ];
  };
  return { paramsTab, partsTab, handlesTab, typesTab, rulesTab };
}

export const KINDS: readonly ParamKind[] = ['length', 'number', 'integer', 'bool', 'choice', 'material'];

/** A number or formula as typed: a plain number stays a number, the rest a formula. */
export const exprOf = (text: string): Expr => {
  const s = text.trim();
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s;
};

export const exprText = (e: Expr | undefined): string => (e === undefined ? '' : String(e));

export const withoutKey = <T extends object>(x: T, key: string): T => {
  const { [key]: _gone, ...rest } = x as Record<string, unknown>;
  return rest as T;
};
