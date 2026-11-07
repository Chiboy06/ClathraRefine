import "server-only";
import { get } from "./db";
import { priceCart, type CartLine } from "../cart";
import type { Product } from "../demoData";

/** Prices a cart from database records only. Browser prices are never read. */
export async function priceFromDb(lines: CartLine[], logistics: string) {
  const ids = [...new Set(lines.map((l) => l.productId))];
  const products = (await Promise.all(ids.map((id) => get<Product>("products", id)))).filter((p): p is Product => !!p);
  return { ...priceCart(lines, products, logistics), products };
}
