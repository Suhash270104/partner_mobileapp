import { LIMITS } from './constants';
import { parseAmount, splitList } from './validation';
import type { Json } from './types';

// CSV import for bulk product creation. The file is parsed on the phone and sent as JSON to /products/bulk,
// where every row is validated by the server (hand-off §8.3).

/** The column headers the importer understands, in the order shown in the template. */
export const BULK_CSV_COLUMNS = [
  'Title', 'Brand', 'SKU', 'Description', 'Category', 'Subcategory', 'Unit', 'MRP', 'Selling Price', 'GST %', 'Stock Quantity',
  'Low Stock Alert', 'Min Order Qty', 'Tags (comma separated)', 'Photo URLs (comma separated)', 'Status (published/draft)',
] as const;

export function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const text = source.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
      row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows.filter(values => values.some(Boolean));
}

const headerKey = (value: string) => value.toLowerCase().replace(/\(.*?\)|\*/g, '').replace(/[^a-z%]+/g, ' ').trim();

export function rowToProduct(row: Record<string, string>): Json {
  const values = Object.fromEntries(Object.entries(row).map(([key, value]) => [headerKey(key), value]));
  const get = (...keys: string[]) => keys.map(key => values[key]).find(value => value !== undefined && value !== '') ?? '';
  const product: Json = {
    title: get('title'), brand: get('brand'), sku: get('sku'), description: get('description'), category: get('category'), subcategory: get('subcategory'),
    unit: get('unit') || 'piece', mrp: parseAmount(get('mrp')), sellingPrice: parseAmount(get('selling price')), gstPercentage: parseAmount(get('gst %', 'gst')),
    stockQuantity: parseAmount(get('stock quantity')), lowStockThreshold: parseAmount(get('low stock alert')), minOrderQuantity: parseAmount(get('min order qty')),
    tags: splitList(get('tags')).map(tag => tag.toLowerCase()), photos: splitList(get('photo urls', 'photos')).slice(0, LIMITS.photos),
    status: get('status published draft').toLowerCase() === 'draft' ? 'draft' : 'published',
  };
  return Object.fromEntries(Object.entries(product).filter(([, value]) => value !== undefined && value !== '' && !(Array.isArray(value) && !value.length)));
}

export function csvToProducts(source: string): Json[] {
  const rows = parseCsv(source);
  if (rows.length < 2) throw new Error('The file needs a header row and at least one product row.');
  const headers = rows[0];
  return rows.slice(1).map(values => rowToProduct(Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))));
}
