import '../../server/engine/precheck.js';
import type { CaseDocument, Check, DataTable } from '../types';
interface Engine {
  base(name: string): string;
  parseCSV(text: string): DataTable;
  tableFromGrid(rows: { values: string[]; line: number }[], sheet: string): DataTable;
  check(documents: CaseDocument[], code: string): Check;
}
export const precheck = (globalThis as unknown as { Precheck: Engine }).Precheck;
