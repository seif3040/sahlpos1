import { createRoot } from "react-dom/client";
import { formatDate } from "./format";

export interface ReceiptSettings {
  shop_name?: string;
  shop_phone?: string | null;
  shop_address?: string | null;
  currency?: string;
  receipt_header?: string | null;
  receipt_footer?: string | null;
}

export interface ReceiptItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface ReceiptData {
  invoice_number: number;
  created_at: string;
  cashier_name?: string;
  customer_name?: string;
  payment_method: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  cash_received?: number;
  change_amount?: number;
  cash_part?: number;
  card_part?: number;
}

const payText = (m: string) =>
  m === "cash" ? "نقدي" : m === "card" ? "بطاقة" : m === "mixed" ? "مختلط" : m === "deferred" ? "آجل" : m;

const fmt = (n: number, c: string) => `${Number(n).toFixed(2)} ${c}`;

export function ThermalReceipt({
  invoice,
  settings,
}: {
  invoice: ReceiptData;
  settings: ReceiptSettings;
}) {
  const currency = settings.currency || "ج.م";
  return (
    <div id="invoice" className="thermal-receipt" dir="rtl" lang="ar">
      <div className="tr-header">
        <div className="tr-shop">{settings.shop_name || "متجري"}</div>
        {settings.shop_phone ? <div className="tr-sub">{settings.shop_phone}</div> : null}
        {settings.shop_address ? <div className="tr-sub">{settings.shop_address}</div> : null}
        {settings.receipt_header ? <div className="tr-sub">{settings.receipt_header}</div> : null}
      </div>

      <div className="tr-divider" />

      <div className="tr-meta">
        <div><span>فاتورة:</span><strong>#{invoice.invoice_number}</strong></div>
        <div><span>التاريخ:</span><strong>{formatDate(invoice.created_at)}</strong></div>
        {invoice.cashier_name ? (
          <div><span>الكاشير:</span><strong>{invoice.cashier_name}</strong></div>
        ) : null}
        {invoice.customer_name ? (
          <div><span>العميل:</span><strong>{invoice.customer_name}</strong></div>
        ) : null}
        <div><span>الدفع:</span><strong>{payText(invoice.payment_method)}</strong></div>
      </div>

      <div className="tr-divider" />

      <table className="tr-items">
        <thead>
          <tr>
            <th className="tr-name">الصنف</th>
            <th className="tr-qty">كمية</th>
            <th className="tr-price">السعر</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it, i) => (
            <tr key={i}>
              <td className="tr-name">{it.product_name}</td>
              <td className="tr-qty">{it.quantity}</td>
              <td className="tr-price">{fmt(it.line_total, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="tr-divider" />

      <div className="tr-totals">
        <div><span>الإجمالي الفرعي</span><strong>{fmt(invoice.subtotal, currency)}</strong></div>
        {invoice.discount > 0 ? (
          <div><span>الخصم</span><strong>- {fmt(invoice.discount, currency)}</strong></div>
        ) : null}
        {invoice.tax > 0 ? (
          <div><span>الضريبة</span><strong>{fmt(invoice.tax, currency)}</strong></div>
        ) : null}
        <div className="tr-grand"><span>المجموع</span><strong>{fmt(invoice.total, currency)}</strong></div>
        {invoice.payment_method === "mixed" && invoice.cash_part != null && invoice.card_part != null ? (
          <>
            <div><span>نقدي</span><strong>{fmt(invoice.cash_part, currency)}</strong></div>
            <div><span>بطاقة</span><strong>{fmt(invoice.card_part, currency)}</strong></div>
          </>
        ) : null}
        {invoice.cash_received && invoice.cash_received > 0 ? (
          <div><span>المستلم</span><strong>{fmt(invoice.cash_received, currency)}</strong></div>
        ) : null}
        {invoice.change_amount && invoice.change_amount > 0 ? (
          <div className="tr-grand"><span>الباقي</span><strong>{fmt(invoice.change_amount, currency)}</strong></div>
        ) : null}
      </div>

      <div className="tr-divider" />

      <div className="tr-footer">
        <div>{settings.receipt_footer || "شكراً لتسوقكم معنا"}</div>
        <div className="tr-sub">نتشرف بزيارتكم مرة أخرى</div>
      </div>
    </div>
  );
}

/**
 * Opens a new window, renders the thermal receipt, and triggers window.print().
 * Uses pure HTML/CSS — no PDF generation.
 *
 * Future ESC/POS support: swap this function with a QZ Tray dispatcher
 * that sends raw ESC/POS commands to the printer queue.
 */
export function printThermalReceipt(invoice: ReceiptData, settings: ReceiptSettings, format: "thermal" | "a4" = "thermal") {
  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) return;

  const isA4 = format === "a4";

  const a4Css = `
    @page { size: A4; margin: 15mm; }
    html, body { background: #fff; color: #000; font-family: 'Cairo', 'Tahoma', sans-serif; }
    body { padding: 0; max-width: 180mm; margin: 0 auto; }
    .thermal-receipt { width: 100%; font-size: 14px; line-height: 1.6; color: #000; }
    .tr-header { text-align: center; padding-bottom: 12px; border-bottom: 2px solid #000; }
    .tr-shop { font-size: 26px; font-weight: 700; }
    .tr-sub { font-size: 13px; color: #333; }
    .tr-divider { border-top: 1px solid #ccc; margin: 12px 0; }
    .tr-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; padding: 12px 0; }
    .tr-meta > div { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; border-bottom: 1px dotted #ccc; }
    .tr-items { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
    .tr-items th { background: #f3f4f6; padding: 8px; border: 1px solid #ccc; font-weight: 700; }
    .tr-items td { padding: 8px; border: 1px solid #e5e7eb; }
    .tr-name { text-align: right; }
    .tr-qty  { text-align: center; width: 80px; }
    .tr-price{ text-align: left; width: 120px; white-space: nowrap; }
    .tr-totals { margin-top: 16px; margin-right: auto; margin-left: 0; width: 50%; }
    .tr-totals > div { display: flex; justify-content: space-between; font-size: 14px; padding: 6px 0; border-bottom: 1px dotted #ccc; }
    .tr-grand { font-size: 18px; font-weight: 700; border-top: 2px solid #000 !important; border-bottom: 2px solid #000; padding: 8px 0 !important; margin-top: 4px; }
    .tr-footer { text-align: center; margin-top: 24px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 13px; color: #555; }
    @media print { .no-print { display: none !important; } }
  `;

  const thermalCss = `
    @page { size: 80mm auto; margin: 0; }
    html, body { background: #fff; color: #000; font-family: 'Cairo', 'Tahoma', sans-serif; }
    body { padding: 6mm 4mm; }
    .thermal-receipt { width: 72mm; margin: 0 auto; font-size: 12px; line-height: 1.45; color: #000; }
    .tr-header { text-align: center; }
    .tr-shop { font-size: 16px; font-weight: 700; }
    .tr-sub { font-size: 11px; }
    .tr-divider { border-top: 1px dashed #000; margin: 6px 0; }
    .tr-meta > div { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; }
    .tr-items { width: 100%; border-collapse: collapse; font-size: 11px; }
    .tr-items th, .tr-items td { padding: 2px 0; vertical-align: top; }
    .tr-items thead th { border-bottom: 1px solid #000; font-weight: 700; }
    .tr-name { text-align: right; width: 55%; word-break: break-word; }
    .tr-qty  { text-align: center; width: 15%; }
    .tr-price{ text-align: left; width: 30%; white-space: nowrap; }
    .tr-totals > div { display: flex; justify-content: space-between; font-size: 12px; padding: 1px 0; }
    .tr-grand { font-size: 14px; font-weight: 700; border-top: 1px solid #000; padding-top: 4px !important; margin-top: 4px; }
    .tr-footer { text-align: center; margin-top: 6px; font-size: 11px; }
    @media print {
      html, body { width: 80mm; background: #fff; }
      body { padding: 2mm; }
      .thermal-receipt { width: 76mm; page-break-inside: avoid; }
      .no-print { display: none !important; }
    }
  `;

  win.document.open();
  win.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>فاتورة #${invoice.invoice_number}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ${isA4 ? a4Css : thermalCss}
</style>
</head>
<body>
<div id="receipt-root"></div>
<div class="no-print" style="text-align:center;margin-top:12px">
  <button onclick="window.print()" style="padding:8px 16px;font-family:inherit;font-size:14px;cursor:pointer">طباعة</button>
</div>
</body>
</html>`);
  win.document.close();

  const mount = () => {
    const root = win.document.getElementById("receipt-root");
    if (!root) return;
    const r = createRoot(root);
    r.render(<ThermalReceipt invoice={invoice} settings={settings} />);
    const doPrint = () => { win.focus(); win.print(); };
    const fontsReady = (win.document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    if (fontsReady?.ready) fontsReady.ready.then(() => setTimeout(doPrint, 150));
    else setTimeout(doPrint, 500);
  };

  if (win.document.readyState === "complete") mount();
  else win.addEventListener("load", mount);
}

// Backwards-compat aliases (no PDF — both just print)
export const printInvoice = printThermalReceipt;
