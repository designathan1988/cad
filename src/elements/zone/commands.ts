// Commands on zones. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../project/doc';
import type { Command } from '../../core/store';
import type { Zone } from './schema';

/** A zone of rooms: each room in one zone only, so the rooms leave the zones they were in. */
export const addZone = (zone: Zone): Command<Doc> => ({
  label: 'cmd.addZone',
  apply: (doc) => {
    if (zone.rooms.length === 0) return doc;
    const others = doc.zones.map((z) => ({ ...z, rooms: z.rooms.filter((r) => !zone.rooms.includes(r)) })).filter((z) => z.rooms.length > 0);
    return { ...doc, zones: [...others, zone] };
  },
});

export type ZonePatch = Partial<Pick<Zone, 'name' | 'category' | 'color'>>;

export const updateZones = (ids: readonly string[], patch: ZonePatch): Command<Doc> => ({
  label: 'cmd.updateZone',
  apply: (doc) => {
    if (patch.name !== undefined && patch.name.trim() === '') return doc;
    let changed = false;
    const zones = doc.zones.map((z) => {
      if (!ids.includes(z.id)) return z;
      // Its name as shown: without the spaces typed round it.
      const next = { ...z, ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) };
      if (JSON.stringify(next) === JSON.stringify(z)) return z;
      changed = true;
      return next;
    });
    return changed ? { ...doc, zones } : doc;
  },
});
