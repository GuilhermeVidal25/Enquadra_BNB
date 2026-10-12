import JSZip from 'jszip';
import { precheck } from './precheck';
import type { DataTable, Extraction } from '../types';
interface PDFPage {
  getTextContent(): Promise<{ items: { str?: string; hasEOL?: boolean }[] }>;
  cleanup(): void;
}
interface PDFDocument {
  numPages: number;
  getPage(n: number): Promise<PDFPage>;
  destroy(): Promise<void>;
}
interface PDFModule {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(options: Record<string, unknown>): { promise: Promise<PDFDocument> };
}
export async function readXLSX(bytes: ArrayBuffer): Promise<DataTable[]> {
  const zip = await JSZip.loadAsync(bytes),
    xml = (text: string) => new DOMParser().parseFromString(text, 'application/xml'),
    get = async (path: string) =>
      zip.file(path) ? xml(await zip.file(path)!.async('string')) : null;
  const strings = await get('xl/sharedStrings.xml'),
    shared = strings
      ? [...strings.getElementsByTagNameNS('*', 'si')].map((x) =>
          [...x.getElementsByTagNameNS('*', 't')].map((t) => t.textContent || '').join(''),
        )
      : [];
  const workbook = await get('xl/workbook.xml'),
    rels = await get('xl/_rels/workbook.xml.rels');
  if (!workbook || !rels) throw Error('Estrutura XLSX inválida.');
  const tables: DataTable[] = [];
  for (const sheet of workbook.getElementsByTagNameNS('*', 'sheet')) {
    const rel = [...rels.getElementsByTagNameNS('*', 'Relationship')].find(
      (x) => x.getAttribute('Id') === sheet.getAttribute('r:id'),
    );
    if (!rel) throw Error('Planilha sem vínculo.');
    let target = rel.getAttribute('Target') || '';
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
    const page = await get(target);
    if (!page) throw Error('Planilha não encontrada: ' + target);
    const rows: { values: string[]; line: number }[] = [],
      formulaCells: string[] = [];
    for (const row of page.getElementsByTagNameNS('*', 'row')) {
      const values: string[] = [];
      for (const cell of row.getElementsByTagNameNS('*', 'c')) {
        const address = cell.getAttribute('r') || 'A1';
        let col = 0;
        for (const char of address.replace(/\d/g, '')) col = col * 26 + char.charCodeAt(0) - 64;
        const v = cell.getElementsByTagNameNS('*', 'v')[0]?.textContent;
        const type = cell.getAttribute('t');
        if (cell.getElementsByTagNameNS('*', 'f').length) {
          formulaCells.push(address);
          if (v === undefined) throw Error('Fórmula sem resultado armazenado em ' + address);
        }
        values[col - 1] =
          type === 's'
            ? shared[Number(v)] || ''
            : type === 'inlineStr'
              ? [...cell.getElementsByTagNameNS('*', 't')].map((x) => x.textContent).join('')
              : v || '';
      }
      if (values.some((x) => x !== '')) rows.push({ values, line: Number(row.getAttribute('r')) });
    }
    if (rows.length)
      tables.push({
        ...precheck.tableFromGrid(rows, sheet.getAttribute('name') || ''),
        formulaCells,
      });
  }
  return tables;
}
export async function extractFile(file: Blob, name: string): Promise<Extraction> {
  const ext = precheck.base(name).split('.').pop() || '',
    d: Extraction = {
      name,
      kind: ext,
      status: 'read',
      text: '',
      error: null,
      extraction: 'react-browser-parser-v1',
    };
  if (file.size > 10 * 1024 * 1024)
    return { ...d, status: 'unreadable', error: 'Arquivo maior que 10 MB.' };
  if (
    name.includes('__MACOSX/') ||
    precheck.base(name) === '.ds_store' ||
    precheck.base(name).startsWith('._')
  )
    return { ...d, status: 'excluded', error: 'Metadado administrativo; não é evidência.' };
  try {
    if (['md', 'txt', 'csv', 'json'].includes(ext)) {
      d.text = new TextDecoder('utf-8', { fatal: true })
        .decode(await file.arrayBuffer())
        .replace(/^\uFEFF/, '');
      if (!d.text.trim()) throw Error('Arquivo sem conteúdo.');
      if (ext === 'csv') d.tables = [precheck.parseCSV(d.text)];
      if (ext === 'json') d.json = JSON.parse(d.text);
    } else if (ext === 'xlsx') {
      d.tables = await readXLSX(await file.arrayBuffer());
      d.formulaCells = d.tables.flatMap((t) => t.formulaCells || []);
      d.text = d.tables
        .map(
          (t) =>
            'Planilha: ' +
            t.sheet +
            '\n' +
            JSON.stringify({ preambulo: t.preamble, registros: t.rows }),
        )
        .join('\n');
      if (!d.tables.length) throw Error('Excel sem planilhas legíveis.');
    } else if (ext === 'pdf') {
      const modulePath = '/vendor/pdf.mjs';
      const pdfjs = (await import(/* @vite-ignore */ modulePath)) as PDFModule;
      pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.mjs';
      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        disableFontFace: true,
        useSystemFonts: true,
        isEvalSupported: false,
      }).promise;
      d.totalPages = pdf.numPages;
      d.pages = 0;
      d.unreadPages = [];
      const chunks: string[] = [];
      try {
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i),
            content = await page.getTextContent();
          const text = content.items.map((x) => (x.str || '') + (x.hasEOL ? '\n' : ' ')).join('');
          chunks.push('--- Página ' + i + ' ---\n' + text);
          if (text.trim()) d.pages++;
          else d.unreadPages.push(i);
          page.cleanup();
        }
        d.text = chunks.join('\n');
        if (d.unreadPages.length) d.status = 'partial';
      } finally {
        await pdf.destroy();
      }
    } else throw Error('Formato não coberto. Use PDF com texto, CSV, XLSX, JSON ou Markdown.');
  } catch (e) {
    d.status = 'unreadable';
    d.error = (e as Error).message;
  }
  return d;
}
export interface QueuedFile {
  file: Blob;
  name: string;
}
export async function expandFiles(files: File[]): Promise<QueuedFile[]> {
  const queue: QueuedFile[] = [];
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      queue.push({ file, name: file.name });
      continue;
    }
    if (file.size > 25 * 1024 * 1024) throw Error('ZIP maior que 25 MB: ' + file.name);
    const zip = await JSZip.loadAsync(await file.arrayBuffer()),
      entries = Object.values(zip.files).filter((f) => !f.dir);
    if (entries.length > 1500) throw Error('ZIP excede 1.500 itens.');
    let total = 0;
    for (const entry of entries) {
      const internal = entry as typeof entry & { _data?: { uncompressedSize: number } };
      const size = internal._data?.uncompressedSize || 0;
      total += size;
      if (size > 10 * 1024 * 1024 || total > 100 * 1024 * 1024)
        throw Error('ZIP excede os limites descompactados.');
      const blob = await entry.async('blob');
      if (blob.size > 10 * 1024 * 1024) throw Error('Item do ZIP maior que 10 MB: ' + entry.name);
      queue.push({ file: blob, name: entry.name });
    }
  }
  return queue;
}
export function serializeCSV(table: DataTable): string {
  const quote = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  return (
    [table.columns, ...table.rows.map((row) => table.columns.map((c) => row[c] ?? ''))]
      .map((row) => row.map(quote).join(','))
      .join('\n') + '\n'
  );
}
