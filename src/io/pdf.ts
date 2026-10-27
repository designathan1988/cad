// A PDF of pictures, one a page (phase 9: the plan printed at its scale; phase 10: a set of sheets):
// each page the paper's size in points, its picture over all of it, its pixels compressed (FlateDecode,
// by the browser's own CompressionStream, no library). PDF 1.4, read by every viewer and printer.

/** Points (1/72 in) a millimetre. */
const PT_PER_MM = 72 / 25.4;

const ascii = (s: string) => new TextEncoder().encode(s);

/** The bytes compressed as a zlib stream (what FlateDecode reads). */
export async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A text as a PDF string in UTF-16 (hex, with its byte order mark): "Térreo" kept as it is written. */
export const pdfText = (s: string) => `<FEFF${Array.from({ length: s.length }, (_, i) => s.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')).join('')}>`;

/** A page: its picture's pixels compressed (RGB, 3 bytes a pixel, rows from the top), its size, and the paper's (mm). */
export interface PdfPage {
  readonly data: Uint8Array;
  readonly w: number;
  readonly h: number;
  readonly mmW: number;
  readonly mmH: number;
}

/** The PDF of an RGB picture `w` × `h` on a page `mmW` × `mmH`. Its title in the document's information. */
export async function pdfOfRgb(rgb: Uint8Array, w: number, h: number, mmW: number, mmH: number, title: string): Promise<Uint8Array> {
  return pdfOfPages([await pageOfRgb(rgb, w, h, mmW, mmH)], title);
}

/** A page of an RGB picture, compressed now: a set of sheets keeps each page small until the PDF is written. */
export async function pageOfRgb(rgb: Uint8Array, w: number, h: number, mmW: number, mmH: number): Promise<PdfPage> {
  if (rgb.length !== w * h * 3) throw new Error('pageOfRgb: the picture is not w × h × 3 bytes');
  return { data: await deflate(rgb), w, h, mmW, mmH };
}

/** The PDF of pages, each a picture over the whole of its paper (sheets of a set: phase 10). */
export function pdfOfPages(pages: readonly PdfPage[], title: string): Uint8Array {
  if (pages.length === 0) throw new Error('pdfOfPages: no pages');
  // Objects: 1 the catalog, 2 the pages, then for each page its page, contents and image, the information last.
  const pageObj = (i: number) => 3 + i * 3;
  const objects: Uint8Array[][] = [
    [ascii('<< /Type /Catalog /Pages 2 0 R >>')],
    [ascii(`<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`)],
  ];
  pages.forEach((p, i) => {
    const W = (p.mmW * PT_PER_MM).toFixed(2);
    const H = (p.mmH * PT_PER_MM).toFixed(2);
    const content = ascii(`q\n${W} 0 0 ${H} 0 0 cm\n/Im0 Do\nQ\n`);
    const data = p.data;
    objects.push(
      [ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${pageObj(i) + 2} 0 R >> >> /Contents ${pageObj(i) + 1} 0 R >>`)],
      [ascii(`<< /Length ${content.length} >>\nstream\n`), content, ascii('\nendstream')],
      [ascii(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${data.length} >>\nstream\n`), data, ascii('\nendstream')],
    );
  });
  objects.push([ascii(`<< /Title ${pdfText(title)} /Producer (cad2) >>`)]);
  const parts: Uint8Array[] = [ascii('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')];
  let at = parts[0]!.length;
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(at);
    const chunk = [ascii(`${i + 1} 0 obj\n`), ...body, ascii('\nendobj\n')];
    for (const c of chunk) at += c.length;
    parts.push(...chunk);
  });
  const xref = at;
  parts.push(ascii(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`));
  parts.push(ascii(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  const out = new Uint8Array(parts.reduce((n, q) => n + q.length, 0));
  let k = 0;
  for (const q of parts) {
    out.set(q, k);
    k += q.length;
  }
  return out;
}

/** A canvas's pixels as RGB. */
export function rgbOfCanvas(canvas: HTMLCanvasElement): Uint8Array {
  const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  const rgb = new Uint8Array(canvas.width * canvas.height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i]!;
    rgb[j + 1] = data[i + 1]!;
    rgb[j + 2] = data[i + 2]!;
  }
  return rgb;
}

/** A canvas as a PDF page `mmW` × `mmH`. */
export async function pdfOfCanvas(canvas: HTMLCanvasElement, mmW: number, mmH: number, title: string): Promise<Blob> {
  return new Blob([(await pdfOfRgb(rgbOfCanvas(canvas), canvas.width, canvas.height, mmW, mmH, title)) as BlobPart], { type: 'application/pdf' });
}
