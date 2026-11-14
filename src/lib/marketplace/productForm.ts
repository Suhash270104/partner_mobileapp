import { LIMITS } from './constants';
import * as v from './validation';
import type { FieldErrors } from './validation';
import type { Json, Product } from './types';

export interface ProductForm {
  title: string; brand: string; sku: string; description: string; category: string; subcategory: string;
  priceType: string; mrp: string; sellingPrice: string; priceMax: string; unit: string; unitLabel: string; gstPercentage: string; priceIncludesTax: boolean;
  supplyQuantity: string; supplyUnit: string; supplyPeriod: string; leadTimeDays: string; deliveryLocations: string; bulkSupply: boolean; customization: boolean;
  stockQuantity: string; minOrderQuantity: string; maxOrderQuantity: string; lowStockThreshold: string; inStock: boolean; isFeatured: boolean; tags: string;
  photos: string[];
  material: string; finish: string; color: string; length: string; width: string; height: string; dimensionUnit: string;
  thickness: string; weight: string; warrantyYears: string; careInstructions: string;
}

export const blankProduct = (): ProductForm => ({
  title: '', brand: '', sku: '', description: '', category: '', subcategory: '', priceType: 'fixed', mrp: '', sellingPrice: '', priceMax: '',
  unit: 'piece', unitLabel: '', gstPercentage: '18', priceIncludesTax: true, supplyQuantity: '', supplyUnit: '', supplyPeriod: 'month',
  leadTimeDays: '', deliveryLocations: '', bulkSupply: false, customization: false, stockQuantity: '', minOrderQuantity: '1', maxOrderQuantity: '',
  lowStockThreshold: '5', inStock: true, isFeatured: false, tags: '', photos: [],
  material: '', finish: '', color: '', length: '', width: '', height: '', dimensionUnit: 'mm', thickness: '', weight: '', warrantyYears: '', careInstructions: '',
});

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));

export function productToForm(p: Product): ProductForm {
  const spec = (p.specifications ?? {}) as Json;
  const dim = (spec.dimensions ?? {}) as Json;
  const blank = blankProduct();
  return {
    ...blank,
    title: text(p.title), brand: text(p.brand), sku: text(p.sku), description: text(p.description), category: text(p.category), subcategory: text(p.subcategory),
    priceType: text(p.priceType) || 'fixed', mrp: text(p.mrp), sellingPrice: text(p.sellingPrice), priceMax: text(p.priceMax), unit: text(p.unit) || blank.unit,
    unitLabel: text(p.unitLabel), gstPercentage: text(p.gstPercentage ?? blank.gstPercentage), priceIncludesTax: p.priceIncludesTax ?? true,
    supplyQuantity: text(p.supplyAbility?.quantity), supplyUnit: text(p.supplyAbility?.unit), supplyPeriod: text(p.supplyAbility?.period) || blank.supplyPeriod,
    leadTimeDays: text(p.leadTimeDays), deliveryLocations: (p.deliveryLocations ?? []).join(', '), bulkSupply: !!p.bulkSupply, customization: !!p.customization,
    stockQuantity: text(p.stockQuantity), minOrderQuantity: text(p.minOrderQuantity ?? blank.minOrderQuantity), maxOrderQuantity: text(p.maxOrderQuantity),
    lowStockThreshold: text(p.lowStockThreshold ?? blank.lowStockThreshold), inStock: p.inStock ?? true, isFeatured: !!p.isFeatured, tags: (p.tags ?? []).join(', '),
    photos: p.photos ?? [],
    material: text(spec.material), finish: text(spec.finish), color: text(spec.color), length: text(dim.length), width: text(dim.width), height: text(dim.height),
    dimensionUnit: text(dim.unit) || blank.dimensionUnit, thickness: text(spec.thickness), weight: text(spec.weight), warrantyYears: text(spec.warrantyYears), careInstructions: text(spec.careInstructions),
  };
}

const SKU = /^[A-Za-z0-9._-]+$/;
const nonNegativeInt = (value: string, label: string, max?: number) => {
  if (!value.trim()) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return `${label} must be a whole number, 0 or more.`;
  return max !== undefined && n > max ? `${label} cannot be more than ${max}.` : undefined;
};

/** Drafts only need a title; publishing needs the full set of rules. */
export function validateProduct(f: ProductForm, mode: 'draft' | 'publish'): FieldErrors {
  const errors: Record<string, string | undefined> = {
    title: v.lengthBetween(f.title, 'Product title', LIMITS.productTitle.min, LIMITS.productTitle.max),
    sku: f.sku.trim() && (!SKU.test(f.sku.trim()) || f.sku.trim().length > LIMITS.sku) ? `SKU can use letters, digits and . _ - (up to ${LIMITS.sku} characters).` : undefined,
  };
  if (mode === 'publish') {
    const mrp = v.parseAmount(f.mrp), selling = v.parseAmount(f.sellingPrice), max = v.parseAmount(f.priceMax);
    const priced = f.priceType !== 'on_request';
    errors.category = f.category ? undefined : 'Choose a category.';
    errors.subcategory = f.subcategory ? undefined : 'Choose a subcategory.';
    if (priced) {
      errors.mrp = mrp === undefined || mrp <= 0 ? 'Enter the MRP.' : mrp > LIMITS.maxPrice ? 'MRP is too large.' : undefined;
      errors.sellingPrice = selling === undefined || selling < 0 ? 'Enter the selling price.' : selling > LIMITS.maxPrice ? 'Selling price is too large.'
        : mrp !== undefined && selling > mrp ? 'Selling price cannot be higher than the MRP.' : undefined;
      if (f.priceType === 'range') errors.priceMax = max === undefined ? 'Enter the highest price.' : selling !== undefined && max < selling ? 'Highest price must be at least the selling price.' : undefined;
    }
    errors.leadTimeDays = nonNegativeInt(f.leadTimeDays, 'Lead time', LIMITS.leadTimeDays);
    errors.stockQuantity = nonNegativeInt(f.stockQuantity, 'Stock');
    errors.lowStockThreshold = nonNegativeInt(f.lowStockThreshold, 'Low-stock alert');
    errors.minOrderQuantity = f.minOrderQuantity.trim() && (!Number.isInteger(Number(f.minOrderQuantity)) || Number(f.minOrderQuantity) < 1) ? 'Minimum order must be 1 or more.' : undefined;
    errors.maxOrderQuantity = nonNegativeInt(f.maxOrderQuantity, 'Maximum order');
    errors.deliveryLocations = v.listItems(v.splitList(f.deliveryLocations), 'Delivery locations', LIMITS.deliveryLocations, 80);
    errors.description = f.description.length > LIMITS.productDescription ? `Keep this under ${LIMITS.productDescription} characters.` : undefined;
  }
  return v.compact(errors);
}

const num = (value: string) => v.parseAmount(value);
const put = (target: Json, key: string, value: unknown) => { if (value !== undefined && value !== '' && !(Array.isArray(value) && !value.length)) target[key] = value; };

/** Builds the POST/PUT body. Optional keys are left out when blank; the server strips unknown keys. */
export function productToPayload(f: ProductForm, status: 'published' | 'draft' | 'archived'): Json {
  const out: Json = {
    title: f.title.trim(), category: f.category, subcategory: f.subcategory, priceType: f.priceType, unit: f.unit, status,
    gstPercentage: Number(f.gstPercentage), priceIncludesTax: f.priceIncludesTax, inStock: f.inStock, bulkSupply: f.bulkSupply, customization: f.customization, isFeatured: f.isFeatured,
    mrp: num(f.mrp) ?? 0, sellingPrice: num(f.sellingPrice) ?? 0, photos: f.photos,
    stockQuantity: num(f.stockQuantity) ?? 0, lowStockThreshold: num(f.lowStockThreshold) ?? 0, minOrderQuantity: num(f.minOrderQuantity) ?? 1,
    leadTimeDays: num(f.leadTimeDays) ?? 0, deliveryLocations: v.splitList(f.deliveryLocations), tags: v.splitList(f.tags).map(t => t.toLowerCase()).slice(0, LIMITS.tags),
  };
  put(out, 'brand', f.brand.trim()); put(out, 'sku', f.sku.trim()); put(out, 'description', f.description.trim()); put(out, 'unitLabel', f.unitLabel.trim());
  if (f.priceType === 'range') put(out, 'priceMax', num(f.priceMax));
  put(out, 'maxOrderQuantity', num(f.maxOrderQuantity));
  if (num(f.supplyQuantity)) out.supplyAbility = { quantity: num(f.supplyQuantity), unit: f.supplyUnit || f.unit, period: f.supplyPeriod };

  const specs: Json = {};
  (['material', 'finish', 'color', 'thickness', 'weight', 'careInstructions'] as const).forEach(key => put(specs, key, f[key].trim()));
  put(specs, 'warrantyYears', num(f.warrantyYears));
  const dims: Json = {};
  (['length', 'width', 'height'] as const).forEach(key => put(dims, key, num(f[key])));
  if (Object.keys(dims).length) specs.dimensions = { ...dims, unit: f.dimensionUnit };
  if (Object.keys(specs).length) out.specifications = specs;
  return out;
}

/** Field paths the server may report for a product, mapped to the form keys shown on screen. */
export const productFieldKey = (path: string): string => (path.startsWith('supplyAbility') ? 'supplyQuantity' : path.startsWith('specifications') ? 'material' : path.split('.')[0]);
