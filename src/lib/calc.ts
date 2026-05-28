// Pure calculation helpers — covered by unit tests.

export interface SaleItem {
  quantity: number;
  refunded_quantity?: number | null;
  unit_price: number;
  cost_price?: number | null;
}

export interface SaleLike {
  total: number;
  cash_part?: number | null;
  payment_method: string;
  sale_items?: SaleItem[] | null;
}

export function itemRefundedAmount(items: SaleItem[] | null | undefined): number {
  return (items ?? []).reduce(
    (a, it) => a + Number(it.refunded_quantity ?? 0) * Number(it.unit_price ?? 0),
    0,
  );
}

export function saleNet(sale: SaleLike): number {
  return Math.max(0, Number(sale.total) - itemRefundedAmount(sale.sale_items));
}

export function saleProfit(sale: SaleLike): number {
  let profit = 0;
  for (const it of sale.sale_items ?? []) {
    const eff = Number(it.quantity) - Number(it.refunded_quantity ?? 0);
    if (eff <= 0) continue;
    profit += (Number(it.unit_price) - Number(it.cost_price ?? 0)) * eff;
  }
  return profit;
}

/**
 * Actual cash collected for a sale after refunds (proportional to cash share for mixed payments).
 * Card-only / deferred sales return 0.
 */
export function cashCollected(sale: SaleLike): number {
  const gross = Number(sale.total) || 0;
  if (gross <= 0) return 0;
  const cashShare =
    sale.payment_method === "cash"
      ? gross
      : sale.payment_method === "mixed"
        ? Number(sale.cash_part) || 0
        : 0;
  if (cashShare <= 0) return 0;
  const refunded = itemRefundedAmount(sale.sale_items);
  const cashRatio = cashShare / gross;
  return Math.max(0, cashShare - refunded * cashRatio);
}

export function sumNetSales(sales: SaleLike[]): number {
  return sales.reduce((a, s) => a + saleNet(s), 0);
}

export function sumCashCollected(sales: SaleLike[]): number {
  return sales.reduce((a, s) => a + cashCollected(s), 0);
}

export interface CustomerStatementInput {
  sales: Array<SaleLike & { id: string; invoice_number: number; created_at: string; is_refunded: boolean }>;
  debts: Array<{ amount: number; paid: number; remaining: number; is_settled: boolean }>;
}

export type SaleStatus = "سليمة" | "جزئي" | "مرتجعة";

export function classifySale(sale: SaleLike & { is_refunded: boolean }): SaleStatus {
  const refunded = itemRefundedAmount(sale.sale_items);
  const gross = Number(sale.total);
  if (sale.is_refunded || (gross > 0 && refunded >= gross)) return "مرتجعة";
  if (refunded > 0) return "جزئي";
  return "سليمة";
}

export function buildCustomerStatement(input: CustomerStatementInput) {
  const gross = input.sales.reduce((a, s) => a + Number(s.total), 0);
  const refunds = input.sales.reduce((a, s) => a + itemRefundedAmount(s.sale_items), 0);
  const net = Math.max(0, gross - refunds);
  const debtTotal = input.debts.reduce((a, d) => a + Number(d.amount), 0);
  const debtPaid = input.debts.reduce((a, d) => a + Number(d.paid), 0);
  const debtRemaining = input.debts.reduce((a, d) => a + Number(d.remaining), 0);
  return { gross, refunds, net, debtTotal, debtPaid, debtRemaining, invoicesCount: input.sales.length };
}
