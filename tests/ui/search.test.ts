import { describe, expect, it } from 'vitest';
import { searchEntries } from '../../src/ui/search';

const entries = [
  { id: 'wall', label: 'Parede', keywords: 'wall desenhar' },
  { id: 'door', label: 'Porta', keywords: 'door' },
  { id: 'window', label: 'Janela', keywords: 'window' },
  { id: 'plan', label: 'Vista: Planta', keywords: '2d' },
  { id: 'level', label: 'Ir para o pavimento Térreo', keywords: '' },
  { id: 'theme', label: 'Alternar tema claro / escuro', keywords: 'dark light' },
];

const ids = (q: string) => searchEntries(entries, q).map((e) => e.id);

describe('palette search', () => {
  it('empty: everything, in the given order', () => {
    expect(ids('')).toEqual(entries.map((e) => e.id));
    expect(ids('   ')).toEqual(entries.map((e) => e.id));
  });

  it('ignores case and accents', () => {
    expect(ids('terreo')).toEqual(['level']);
    expect(ids('TÉRREO')).toEqual(['level']);
  });

  it('every word must match, in any order, in the label or the keywords', () => {
    expect(ids('escuro tema')).toEqual(['theme']);
    expect(ids('dark')).toEqual(['theme']);
    expect(ids('tema janela')).toEqual([]);
  });

  it('a label starting with the query ranks before one containing it', () => {
    // "pa": Parede starts with it; Vista: Planta and Ir para o pavimento have words starting with it.
    expect(ids('pa')[0]).toBe('wall');
    expect(ids('pa')).toContain('plan');
  });

  it('letters of one word in order, with gaps, still match; never across words', () => {
    expect(ids('prd')).toEqual(['wall']);
    expect(ids('jnl')).toEqual(['window']);
    // t-e-r-r-e-o could be picked across "alTERnaR tEma clarO": it is not.
    expect(ids('trro')).toEqual(['level']);
  });
});
