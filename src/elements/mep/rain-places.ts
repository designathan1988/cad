// NBR 10844 (1989) table 5, "Chuvas intensas no Brasil" (Otto Pfafstetter): the rain of 5 minutes (mm/h) at
// 98 stations, for a return of 1, 5 and 25 years. Where a station's record was short, the 5- or 25-year
// value stands for the years given (the norm's figures in brackets); none: not given. Read from the 1989
// text as published, to confirm in the edition in force. Pure data.

export interface RainPlace {
  readonly name: string;
  readonly i1: number;
  readonly i5: number;
  readonly i25: number | null;
  /** The years the 5- or the 25-year value stands for, when not those. */
  readonly years5?: number;
  readonly years25?: number;
}

export type RainReturn = 1 | 5 | 25;

export const RAIN_PLACES: readonly RainPlace[] = [
  { name: 'Alegrete/RS', i1: 174, i5: 238, i25: 313, years25: 17 },
  { name: 'Alto Itatiaia/RJ', i1: 124, i5: 164, i25: 240 },
  { name: 'Alto Tapajós/PA', i1: 168, i5: 229, i25: 267, years25: 21 },
  { name: 'Alto Teresópolis/RJ', i1: 114, i5: 137, i25: null, years5: 3 },
  { name: 'Aracaju/SE', i1: 116, i5: 122, i25: 126 },
  { name: 'Avaré/SP', i1: 115, i5: 144, i25: 170 },
  { name: 'Bagé/RS', i1: 126, i5: 204, i25: 234, years25: 10 },
  { name: 'Barbacena/MG', i1: 156, i5: 222, i25: 265, years25: 12 },
  { name: 'Barra do Corda/MA', i1: 120, i5: 128, i25: 152, years25: 20 },
  { name: 'Bauru/SP', i1: 110, i5: 120, i25: 148, years25: 9 },
  { name: 'Belém/PA', i1: 138, i5: 157, i25: 185, years25: 20 },
  { name: 'Belo Horizonte/MG', i1: 132, i5: 227, i25: 230, years25: 12 },
  { name: 'Blumenau/SC', i1: 120, i5: 125, i25: 152, years25: 15 },
  { name: 'Bonsucesso/MG', i1: 143, i5: 196, i25: null },
  { name: 'Cabo Frio/RJ', i1: 113, i5: 146, i25: 218 },
  { name: 'Campos/RJ', i1: 132, i5: 206, i25: 240 },
  { name: 'Campos do Jordão/SP', i1: 122, i5: 144, i25: 164, years25: 9 },
  { name: 'Catalão/GO', i1: 132, i5: 174, i25: 198, years25: 22 },
  { name: 'Caxambu/MG', i1: 106, i5: 137, i25: null, years5: 3 },
  { name: 'Caxias do Sul/RS', i1: 120, i5: 127, i25: 218 },
  { name: 'Corumbá/MT', i1: 120, i5: 131, i25: 161, years25: 9 },
  { name: 'Cruz Alta/RS', i1: 204, i5: 246, i25: 347, years25: 14 },
  { name: 'Cuiabá/MT', i1: 144, i5: 190, i25: 230, years25: 12 },
  { name: 'Curitiba/PR', i1: 132, i5: 204, i25: 228 },
  { name: 'Encruzilhada/RS', i1: 106, i5: 126, i25: 158, years25: 17 },
  { name: 'Fernando de Noronha/FN', i1: 110, i5: 120, i25: 140, years25: 6 },
  { name: 'Florianópolis/SC', i1: 114, i5: 120, i25: 144 },
  { name: 'Formosa/GO', i1: 136, i5: 176, i25: 217, years25: 20 },
  { name: 'Fortaleza/CE', i1: 120, i5: 156, i25: 180, years25: 21 },
  { name: 'Goiânia/GO', i1: 120, i5: 178, i25: 192, years25: 17 },
  { name: 'Guaramiranga/CE', i1: 114, i5: 126, i25: 152, years25: 19 },
  { name: 'Iraí/RS', i1: 120, i5: 198, i25: 228, years25: 16 },
  { name: 'Jacarezinho/PR', i1: 115, i5: 122, i25: 146, years25: 11 },
  { name: 'João Pessoa/PB', i1: 115, i5: 140, i25: 163, years25: 23 },
  { name: 'Juaretê/AM', i1: 192, i5: 240, i25: 288, years25: 10 },
  { name: 'km 47 - Rodovia Presidente Dutra/RJ', i1: 122, i5: 164, i25: 174, years25: 14 },
  { name: 'Lins/SP', i1: 96, i5: 122, i25: 137, years25: 13 },
  { name: 'Maceió/AL', i1: 102, i5: 122, i25: 174 },
  { name: 'Manaus/AM', i1: 138, i5: 180, i25: 198 },
  { name: 'Natal/RN', i1: 113, i5: 120, i25: 143, years25: 19 },
  { name: 'Nazaré/PE', i1: 118, i5: 134, i25: 155, years25: 19 },
  { name: 'Niterói/RJ', i1: 130, i5: 183, i25: 250 },
  { name: 'Nova Friburgo/RJ', i1: 120, i5: 124, i25: 156 },
  { name: 'Olinda/PE', i1: 115, i5: 167, i25: 173, years25: 20 },
  { name: 'Ouro Preto/MG', i1: 120, i5: 211, i25: null },
  { name: 'Paracatu/MG', i1: 122, i5: 233, i25: null },
  { name: 'Paranaguá/PR', i1: 127, i5: 186, i25: 191, years25: 23 },
  { name: 'Paratins/AM', i1: 130, i5: 200, i25: 205, years25: 13 },
  { name: 'Passa Quatro/MG', i1: 118, i5: 180, i25: 192, years25: 10 },
  { name: 'Passo Fundo/RS', i1: 110, i5: 125, i25: 180 },
  { name: 'Petrópolis/RJ', i1: 120, i5: 126, i25: 156 },
  { name: 'Pinheiral/RJ', i1: 142, i5: 214, i25: 244 },
  { name: 'Piracicaba/SP', i1: 119, i5: 122, i25: 151, years25: 10 },
  { name: 'Ponta Grossa/PR', i1: 120, i5: 126, i25: 148 },
  { name: 'Porto Alegre/RS', i1: 118, i5: 146, i25: 167, years25: 21 },
  { name: 'Porto Velho/RO', i1: 130, i5: 167, i25: 184, years25: 10 },
  { name: 'Quixeramobim/CE', i1: 115, i5: 121, i25: 126 },
  { name: 'Resende/RJ', i1: 130, i5: 203, i25: 264 },
  { name: 'Rio Branco/AC', i1: 126, i5: 139, i25: null, years5: 2 },
  { name: 'Rio de Janeiro/RJ (Bangu)', i1: 122, i5: 156, i25: 174, years25: 20 },
  { name: 'Rio de Janeiro/RJ (Ipanema)', i1: 119, i5: 125, i25: 160, years25: 15 },
  { name: 'Rio de Janeiro/RJ (Jacarepaguá)', i1: 120, i5: 142, i25: 152, years25: 6 },
  { name: 'Rio de Janeiro/RJ (Jardim Botânico)', i1: 122, i5: 167, i25: 227 },
  { name: 'Rio de Janeiro/RJ (Praça XV)', i1: 120, i5: 174, i25: 204, years25: 14 },
  { name: 'Rio de Janeiro/RJ (Praça Saenz Peña)', i1: 125, i5: 139, i25: 167, years25: 18 },
  { name: 'Rio de Janeiro/RJ (Santa Cruz)', i1: 121, i5: 132, i25: 172, years25: 20 },
  { name: 'Rio Grande/RS', i1: 121, i5: 204, i25: 222, years25: 20 },
  { name: 'Salvador/BA', i1: 108, i5: 122, i25: 145, years25: 24 },
  { name: 'Santa Maria/RS', i1: 114, i5: 122, i25: 145, years25: 16 },
  { name: 'Santa Maria Madalena/RJ', i1: 120, i5: 126, i25: 152, years25: 7 },
  { name: 'Santa Vitória do Palmar/RS', i1: 120, i5: 126, i25: 152, years25: 18 },
  { name: 'Santos/SP', i1: 136, i5: 198, i25: 240 },
  { name: 'Santos-Itapema/SP', i1: 120, i5: 174, i25: 204, years25: 21 },
  { name: 'São Carlos/SP', i1: 120, i5: 178, i25: 161, years25: 10 },
  { name: 'São Francisco do Sul/SC', i1: 118, i5: 132, i25: 167, years25: 18 },
  { name: 'São Gonçalo/PB', i1: 120, i5: 124, i25: 152, years25: 15 },
  { name: 'São Luiz/MA', i1: 120, i5: 126, i25: 152, years25: 21 },
  { name: 'São Luiz Gonzaga/RS', i1: 158, i5: 209, i25: 253, years25: 21 },
  { name: 'São Paulo/SP (Congonhas)', i1: 122, i5: 132, i25: null },
  { name: 'São Paulo/SP (Mirante Santana)', i1: 122, i5: 172, i25: 191, years25: 7 },
  { name: 'São Simão/SP', i1: 116, i5: 148, i25: 175 },
  { name: 'Sena Madureira/AC', i1: 120, i5: 160, i25: 170, years25: 7 },
  { name: 'Sete Lagoas/MG', i1: 122, i5: 182, i25: 281, years25: 19 },
  { name: 'Soure/PA', i1: 149, i5: 162, i25: 212, years25: 18 },
  { name: 'Taperinha/PA', i1: 149, i5: 202, i25: 241 },
  { name: 'Taubaté/SP', i1: 122, i5: 172, i25: 208, years25: 6 },
  { name: 'Teófilo Otoni/MG', i1: 108, i5: 121, i25: 154, years25: 6 },
  { name: 'Teresina/PI', i1: 154, i5: 240, i25: 262, years25: 23 },
  { name: 'Teresópolis/RJ', i1: 115, i5: 149, i25: 176 },
  { name: 'Tupi/SP', i1: 122, i5: 154, i25: null },
  { name: 'Turiaçu/MG', i1: 126, i5: 162, i25: 230 },
  { name: 'Uaupés/AM', i1: 144, i5: 204, i25: 230, years25: 17 },
  { name: 'Ubatuba/SP', i1: 122, i5: 149, i25: 184, years25: 7 },
  { name: 'Uruguaiana/RS', i1: 120, i5: 142, i25: 161, years25: 17 },
  { name: 'Vassouras/RJ', i1: 125, i5: 179, i25: 222 },
  { name: 'Viamão/RS', i1: 114, i5: 126, i25: 152, years25: 15 },
  { name: 'Vitória/ES', i1: 102, i5: 156, i25: 210 },
  { name: 'Volta Redonda/RJ', i1: 156, i5: 216, i25: 265, years25: 13 },
];

/** A place's rain for a return (mm/h), and the years it truly stands for; null where the table gives none. */
export function rainOf(p: RainPlace, years: RainReturn): { value: number; years: number } | null {
  if (years === 1) return { value: p.i1, years: 1 };
  if (years === 5) return { value: p.i5, years: p.years5 ?? 5 };
  return p.i25 === null ? null : { value: p.i25, years: p.years25 ?? 25 };
}
