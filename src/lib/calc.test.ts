import { describe, it, expect } from "vitest";
import {
  itemRefundedAmount,
  saleNet,
  saleProfit,
  cashCollected,
  sumNetSales,
  sumCashCollected,
  buildCustomerStatement,
  classifySale,
} from "./calc";

describe("calc helpers", () => {
  const cashSale = {
    total: 100,
    cash_part: 0,
    payment_method: "cash",
    is_refunded: false,
    sale_items: [
      { quantity: 2, refunded_quantity: 0, unit_price: 50, cost_price: 30 },
    ],
  };
  const partial = {
    total: 100,
    cash_part: 0,
    payment_method: "cash",
    is_refunded: false,
    sale_items: [{ quantity: 2, refunded_quantity: 1, unit_price: 50, cost_price: 30 }],
  };
  const mixed = {
    total: 200,
    cash_part: 120,
    payment_method: "mixed",
    is_refunded: false,
    sale_items: [{ quantity: 2, refunded_quantity: 1, unit_price: 100, cost_price: 60 }],
  };
  const card = {
    total: 80,
    cash_part: 0,
    payment_method: "card",
    is_refunded: false,
    sale_items: [{ quantity: 1, refunded_quantity: 0, unit_price: 80, cost_price: 40 }],
  };
  const fullRefund = {
    total: 50,
    cash_part: 0,
    payment_method: "cash",
    is_refunded: true,
    sale_items: [{ quantity: 1, refunded_quantity: 1, unit_price: 50, cost_price: 25 }],
  };

  it("itemRefundedAmount sums refunded line totals", () => {
    expect(itemRefundedAmount(partial.sale_items)).toBe(50);
    expect(itemRefundedAmount(cashSale.sale_items)).toBe(0);
  });

  it("saleNet handles full / partial / no refunds", () => {
    expect(saleNet(cashSale)).toBe(100);
    expect(saleNet(partial)).toBe(50);
    expect(saleNet(fullRefund)).toBe(0);
  });

  it("saleProfit ignores refunded units", () => {
    expect(saleProfit(cashSale)).toBe(40); // (50-30)*2
    expect(saleProfit(partial)).toBe(20);
    expect(saleProfit(fullRefund)).toBe(0);
  });

  it("cashCollected: cash full, card zero, mixed proportional", () => {
    expect(cashCollected(cashSale)).toBe(100);
    expect(cashCollected(partial)).toBe(50);
    expect(cashCollected(card)).toBe(0);
    // mixed: cashShare 120/200, refunded 100 → 100*0.6=60 → 120-60=60
    expect(cashCollected(mixed)).toBeCloseTo(60, 5);
    expect(cashCollected(fullRefund)).toBe(0);
  });

  it("sums aggregate net + cash correctly", () => {
    const sales = [cashSale, partial, mixed, card, fullRefund];
    expect(sumNetSales(sales)).toBe(100 + 50 + 100 + 80 + 0);
    expect(sumCashCollected(sales)).toBeCloseTo(100 + 50 + 60 + 0 + 0, 5);
  });

  it("classifySale tags status", () => {
    expect(classifySale(cashSale)).toBe("سليمة");
    expect(classifySale(partial)).toBe("جزئي");
    expect(classifySale(fullRefund)).toBe("مرتجعة");
  });

  it("buildCustomerStatement aggregates totals & debts", () => {
    const stmt = buildCustomerStatement({
      sales: [
        { ...cashSale, id: "1", invoice_number: 1, created_at: "2025-01-01" },
        { ...partial, id: "2", invoice_number: 2, created_at: "2025-01-02" },
        { ...fullRefund, id: "3", invoice_number: 3, created_at: "2025-01-03" },
      ],
      debts: [
        { amount: 200, paid: 50, remaining: 150, is_settled: false },
        { amount: 80, paid: 80, remaining: 0, is_settled: true },
      ],
    });
    expect(stmt.gross).toBe(250);
    expect(stmt.refunds).toBe(100); // 50 partial + 50 full
    expect(stmt.net).toBe(150);
    expect(stmt.debtTotal).toBe(280);
    expect(stmt.debtPaid).toBe(130);
    expect(stmt.debtRemaining).toBe(150);
    expect(stmt.invoicesCount).toBe(3);
  });
});
