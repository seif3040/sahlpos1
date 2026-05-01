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
}

const payText = (m: string) =>
  m === "cash" ? "نقدي" : m === "card" ? "بطاقة" : m === "deferred" ? "آجل" : m;

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
export function printThermalReceipt(invoice: ReceiptData, settings: ReceiptSettings) {
  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) return;

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
  html, body { background: #fff; color: #000; font-family: 'Cairo', 'Tahoma', sans-serif; }
  body { padding: 6mm 4mm; }
  .thermal-receipt { width: 72mm; margin: 0 auto; font-size: 12px; line-height: 1.45; color: #000; }
  .tr-header { text-align: center; }
  .tr-shop { font-size: 16px; font-weight: 700; }
  .tr-sub { font-size: 11px; }
  .tr-divider { border-top: 1px dashed #000; margin: 6px 0; }
  .tr-meta > div { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; }
  .tr-meta span { color: #000; }
  .tr-items { width: 100%; border-collapse: collapse; font-size: 11px; }
  .tr-items th, .tr-items td { padding: 2px 0; vertical-align: top; }
  .tr-items thead th { border-bottom: 1px solid #000; font-weight: 700; }
  .tr-name { text-align: right; width: 55%; word-break: break-word; }
  .tr-qty  { text-align: center; width: 15%; }
  .tr-price{ text-align: left; width: 30%; white-space: nowrap; }
  .tr-totals > div { display: flex; justify-content: space-between; font-size: 12px; padding: 1px 0; }
  .tr-grand { font-size: 14px; font-weight: 700; border-top: 1px solid #000; padding-top: 4px !important; margin-top: 4px; }
  .tr-footer { text-align: center; margin-top: 6px; font-size: 11px; }

  @page { size: 80mm auto; margin: 0; }
  @media print {
    html, body { width: 80mm; background: #fff; }
    body { padding: 2mm; }
    .thermal-receipt { width: 76mm; page-break-inside: avoid; }
    .no-print { display: none !important; }
  }
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

  // Render React tree into the new window
  const mount = () => {
    const root = win.document.getElementById("receipt-root");
    if (!root) return;
    const r = createRoot(root);
    r.render(<ThermalReceipt invoice={invoice} settings={settings} />);
    // Wait for fonts to load before printing
    const doPrint = () => {
      win.focus();
      win.print();
    };
    const fontsReady = (win.document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    if (fontsReady?.ready) {
      fontsReady.ready.then(() => setTimeout(doPrint, 150));
    } else {
      setTimeout(doPrint, 500);
    }
  };

  if (win.document.readyState === "complete") mount();
  else win.addEventListener("load", mount);
}

// Backwards-compat aliases (no PDF — both just print)
export const printInvoice = printThermalReceipt;
