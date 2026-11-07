import { LOGISTICS, type Product } from "./demoData";

export type CartLine = { productId: string; packagingId: string; qty: number };
export type PricedLine = { productId: string; title: string; packaging: string; qty: number; unit_kobo: number; subtotal_kobo: number; rebate_kobo: number; stock_use: number };

export const VAT = 0.075;
export const REBATE = { aboveMt: 50, pct: 0.12 };

/**
 * Prices a cart from product records. The server calls this with database products; the browser only previews.
 * Volume rebate: 12% off a line above 50 MT. ESG credit: carbon offset tokens are VAT exempt, credited back.
 */
export function priceCart(lines: CartLine[], products: Pick<Product, "id" | "title" | "packaging" | "category" | "status" | "stock">[], logisticsId: string) {
  const errors: string[] = [];
  const priced: PricedLine[] = [];
  for (const l of lines) {
    const p = products.find((x) => x.id === l.productId);
    const pk = p?.packaging.find((x) => x.id === l.packagingId);
    const qty = Math.floor(Number(l.qty));
    if (!p || !pk || p.status !== "live") {
      errors.push(`Unavailable: ${p?.title ?? l.productId}`);
      continue;
    }
    if (!(qty >= pk.moq) || qty > 10_000) {
      errors.push(`${p.title}: minimum order is ${pk.moq}`);
      continue;
    }
    const gross = pk.price_kobo * qty;
    const rebate = pk.mt_per_unit && pk.mt_per_unit * qty > REBATE.aboveMt ? Math.round(gross * REBATE.pct) : 0;
    priced.push({ productId: p.id, title: p.title, packaging: pk.label, qty, unit_kobo: pk.price_kobo, subtotal_kobo: gross - rebate, rebate_kobo: rebate, stock_use: pk.mt_per_unit ? +(pk.mt_per_unit * qty).toFixed(3) : qty });
    if (priced[priced.length - 1].stock_use > p.stock) errors.push(`Not enough stock: ${p.title}`);
  }
  const subtotal = priced.reduce((s, l) => s + l.subtotal_kobo, 0);
  const logistics = LOGISTICS.find((x) => x.id === logisticsId)?.kobo ?? 0;
  const vat = Math.round((subtotal + logistics) * VAT);
  const offsetSubtotal = priced
    .filter((l) => products.find((p) => p.id === l.productId)?.category === "Carbon Offsets (VCS)")
    .reduce((s, l) => s + l.subtotal_kobo, 0);
  const esgCredit = Math.round(offsetSubtotal * VAT);
  return { lines: priced, subtotal, logistics, vat, esgCredit, total: subtotal + logistics + vat - esgCredit, errors };
}
