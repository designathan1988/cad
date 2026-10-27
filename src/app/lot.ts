// The lot (docs/plano-de-escopo.md, phase 12: "dados do lote e quadro de áreas"): where it is, its
// registry, its zone and the parameters the zone's line in the municipal law gives it (occupancy,
// floor-area ratio, permeable share, setbacks, height), and the table of areas measured on the model
// (lot-areas.ts). The parameters are the professional's to enter from the law; the app checks the model
// against them and cites the law. Pure.

/** The lot's data, kept in the project. */
export interface Lot {
  readonly address: string;
  readonly city: string;
  /** Two letters ("SP"). */
  readonly state: string;
  /** The registry's number (matrícula) and the city's tax number of the lot. */
  readonly registry: string;
  readonly taxNumber: string;
  /** Its zone ("ZM", "ZER-1") and the law and table its parameters come from. */
  readonly zone: string;
  readonly law: string;
  /** Its area (m²) when no terrain gives its outline. */
  readonly area?: number;
  /** Which side of the terrain's outline is on the street (its index, from 0). */
  readonly frontEdge: number;
  /** Most of the lot the building may cover, % (taxa de ocupação). */
  readonly maxOccupancy?: number;
  /** Most built area over the lot's (coeficiente de aproveitamento). */
  readonly maxFloorRatio?: number;
  /** Least of the lot kept permeable, % (taxa de permeabilidade). */
  readonly minPermeability?: number;
  /** Least setbacks from the front, the sides and the back (m). */
  readonly front?: number;
  readonly side?: number;
  readonly back?: number;
  /** Most height of the building above its lowest floor (m). */
  readonly maxHeight?: number;
  /** Who it is for and who answers for it, as the sheets' title block says them: the owner, the office,
   * the professional in charge, their registration (CAU, CREA) and the record of their responsibility
   * (RRT, ART). */
  readonly owner?: string;
  readonly firm?: string;
  readonly responsible?: string;
  readonly license?: string;
  readonly record?: string;
  /** The office's logo, drawn in the title block: a PNG or JPEG as a data URL, reduced (app/logo-image.ts). */
  readonly logo?: string;
}

/** The largest logo kept (characters of its data URL): about 450 kB of picture. */
export const LOGO_MAX = 600_000;
export const isLogo = (v: unknown): v is string => typeof v === 'string' && v.length <= LOGO_MAX && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(v);

/** The title block's fields of the lot: who it is for and who answers for it. */
export const OFFICE_FIELDS = ['owner', 'firm', 'responsible', 'license', 'record'] as const;

export const DEFAULT_LOT: Lot = { address: '', city: '', state: '', registry: '', taxNumber: '', zone: '', law: 'Lei 16.402/2016 (LPUOS), Quadro 3', frontEdge: 0 };

const text = (v: unknown) => typeof v === 'string';
const opt = (v: unknown) => v === undefined || (typeof v === 'number' && Number.isFinite(v) && v >= 0);

export const isLot = (l: unknown): l is Lot => {
  if (typeof l !== 'object' || l === null) return false;
  const x = l as Record<string, unknown>;
  return (
    ['address', 'city', 'state', 'registry', 'taxNumber', 'zone', 'law'].every((k) => text(x[k])) &&
    typeof x.frontEdge === 'number' &&
    Number.isInteger(x.frontEdge) &&
    x.frontEdge >= 0 &&
    ['area', 'maxOccupancy', 'maxFloorRatio', 'minPermeability', 'front', 'side', 'back', 'maxHeight'].every((k) => opt(x[k])) &&
    OFFICE_FIELDS.every((k) => x[k] === undefined || text(x[k])) &&
    (x.logo === undefined || isLogo(x.logo))
  );
};

/** The project's lot: its own, else an empty one. */
export const lotOf = (doc: { readonly lot?: Lot }): Lot => doc.lot ?? DEFAULT_LOT;
