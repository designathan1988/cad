// The pictures of a store's cards (objects, openings, floors, presets, wall types): those not made yet are made
// one at a time after the store is drawn, so it shows at once, and each goes into its card
// (`img[data-picture="<id>"]`) when ready.

export interface PictureQueue<T> {
  /** Forget what was waiting: the store is drawn again. */
  clear(): void;
  /** One more card waiting for its picture. */
  add(item: T): void;
  /** Make the waiting pictures, one per task, until none are left or the store has closed. */
  work(): void;
}

export function pictureQueue<T>(host: () => HTMLElement, idOf: (item: T) => string, make: (item: T) => string | null | undefined): PictureQueue<T> {
  let pending: T[] = [];
  let working = false;
  return {
    clear: () => {
      pending = [];
    },
    add: (item) => {
      pending.push(item);
    },
    work: () => {
      if (working) return;
      working = true;
      const step = () => {
        const item = pending.shift();
        const back = host();
        if (item === undefined || !back.querySelector('.objs-store')) {
          working = false;
          return;
        }
        const src = make(item);
        const img = back.querySelector<HTMLImageElement>(`img[data-picture="${CSS.escape(idOf(item))}"]`);
        if (img && src) {
          img.src = src;
          img.classList.remove('is-loading');
        }
        setTimeout(step, 0);
      };
      setTimeout(step, 0);
    },
  };
}
