// What Vite gives for an import with "?url": the asset's address (pdf.js's worker, app/reference-ui.ts).
declare module '*?url' {
  const url: string;
  export default url;
}
