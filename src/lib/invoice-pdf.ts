import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate } from "./format";

interface Settings {
  shop_name?: string;
  shop_phone?: string | null;
  shop_address?: string | null;
  currency?: string;
  receipt_header?: string | null;
  receipt_footer?: string | null;
}

interface InvoiceItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface InvoiceData {
  invoice_number: number;
  created_at: string;
  cashier_name?: string;
  customer_name?: string;
  payment_method: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

const reverse = (s: string) =>
  /[\u0590-\u07FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s)
    ? s.split("").reverse().join("")
    : s;

export function generateInvoicePDF(invoice: InvoiceData, settings: Settings) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const currency = settings.currency || "ج.م";
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(16);
  doc.text(reverse(settings.shop_name || "متجري"), pageWidth / 2, 14, { align: "center" });
  if (settings.shop_phone) {
    doc.setFontSize(10);
    doc.text(reverse(settings.shop_phone), pageWidth / 2, 20, { align: "center" });
  }
  if (settings.shop_address) {
    doc.setFontSize(9);
    doc.text(reverse(settings.shop_address), pageWidth / 2, 25, { align: "center" });
  }
  doc.setFontSize(11);
  doc.text(reverse(`فاتورة #${invoice.invoice_number}`), pageWidth - 10, 35, { align: "right" });
  doc.text(reverse(formatDate(invoice.created_at)), 10, 35, { align: "left" });
  if (invoice.cashier_name) {
    doc.text(reverse(`الكاشير: ${invoice.cashier_name}`), pageWidth - 10, 41, { align: "right" });
  }
  if (invoice.customer_name) {
    doc.text(reverse(`العميل: ${invoice.customer_name}`), 10, 41, { align: "left" });
  }

  // Items table
  autoTable(doc, {
    startY: 48,
    head: [["الإجمالي", "السعر", "الكمية", "المنتج"].map(reverse)],
    body: invoice.items.map((it) => [
      `${it.line_total.toFixed(2)} ${currency}`,
      `${it.unit_price.toFixed(2)} ${currency}`,
      String(it.quantity),
      reverse(it.product_name),
    ]),
    styles: { font: "helvetica", fontSize: 9, halign: "right" },
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 8, right: 8 },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  const right = pageWidth - 10;

  doc.setFontSize(10);
  doc.text(reverse(`الإجمالي الفرعي: ${invoice.subtotal.toFixed(2)} ${currency}`), right, finalY, {
    align: "right",
  });
  doc.text(reverse(`الخصم: ${invoice.discount.toFixed(2)} ${currency}`), right, finalY + 6, {
    align: "right",
  });
  doc.text(reverse(`الضريبة: ${invoice.tax.toFixed(2)} ${currency}`), right, finalY + 12, {
    align: "right",
  });
  doc.setFontSize(13);
  doc.text(reverse(`المجموع: ${invoice.total.toFixed(2)} ${currency}`), right, finalY + 20, {
    align: "right",
  });

  doc.setFontSize(9);
  const payText =
    invoice.payment_method === "cash"
      ? "نقدي"
      : invoice.payment_method === "card"
        ? "بطاقة"
        : "آجل";
  doc.text(reverse(`طريقة الدفع: ${payText}`), 10, finalY + 20, { align: "left" });

  if (settings.receipt_footer) {
    doc.setFontSize(9);
    doc.text(reverse(settings.receipt_footer), pageWidth / 2, finalY + 32, { align: "center" });
  }

  return doc;
}

export function downloadInvoicePDF(invoice: InvoiceData, settings: Settings) {
  const doc = generateInvoicePDF(invoice, settings);
  doc.save(`invoice-${invoice.invoice_number}.pdf`);
}

export function printInvoicePDF(invoice: InvoiceData, settings: Settings) {
  const doc = generateInvoicePDF(invoice, settings);
  doc.autoPrint();
  const url = doc.output("bloburl");
  window.open(url, "_blank");
}
