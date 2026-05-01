# نظام نقاط البيع العربي - Arabic POS System

A complete RTL Arabic POS web app with role-based access, real-time sync across cashiers, and a unified invoice system. Default currency: EGP (ج.م), default VAT: 14%.

## Modules

### 1. Authentication (PIN-based)
- 4-digit PIN login screen (large numeric keypad, RTL).
- Default seeded owner PIN **1234** on first launch (with a banner urging to change it).
- Three roles: **صاحب المحل** (owner), **مدير** (manager), **كاشير** (cashier).
- Permissions enforced both in UI and via Supabase RLS using a separate `user_roles` table + `has_role()` security definer function.
- Cashier sees only Sales + own shift; Manager sees most; Owner sees everything including settings & employees.

### 2. Dashboard (الرئيسية)
- KPI cards: today's sales, today's profit, invoice count, outstanding debts.
- Red badges for low-stock and expiring items.
- Charts: daily sales bar (last 7 days) + top products pie (Recharts).
- Quick actions: بيع جديد، إضافة منتج، فاتورة شراء.

### 3. Sales (المبيعات)
- Product grid with images + search by name/barcode.
- Camera barcode scanner (using device camera) with manual fallback input.
- Cart with quantity controls, line discount, percentage or fixed cart discount.
- Payment: نقدي / بطاقة / آجل (deferred requires customer selection → creates a debt entry).
- Auto-applies VAT (configurable in Settings).
- Unified invoice numbering (DB sequence) shared across all cashiers.
- Print/download invoice as PDF (jsPDF with Arabic font + RTL layout): shop name, logo, date/time, cashier, items, totals, tax, discount.
- Returns/refunds: select past invoice, choose items to return, restocks inventory.
- Real-time sync so other devices see new sales instantly (Supabase Realtime).

### 4. Products & Inventory (المنتجات والمخزون)
- CRUD with: name, barcode, category, purchase price, selling price, quantity, min quantity, image, expiry date.
- Categories management (CRUD).
- Image upload to Supabase Storage.
- Low-stock + near-expiry alerts (dashboard + dedicated screen).
- Barcode generation (JsBarcode) + printable barcode label sheet.
- Excel import/export (SheetJS) for bulk product management.
- Inventory audit: scan/enter counts, system shows variance vs. recorded stock, one-click adjust.

### 5. Purchases (المشتريات)
- Create purchase invoice from a supplier with multiple items.
- Auto-increments product stock and updates last purchase price.
- Purchase history list with filters.

### 6. Customers (العملاء)
- Customer profiles (name, phone, notes).
- Per-customer purchase history.
- Debts ledger: each deferred sale creates a debt; record partial/full payments.
- Customer statement (PDF/Excel).
- Manual "send reminder" action that opens WhatsApp/SMS link with prefilled Arabic message.

### 7. Suppliers (الموردين)
- Supplier profiles + purchase history.
- Outstanding payable balance + payment recording.
- Supplier statement (PDF/Excel).

### 8. Cash Register (الصندوق)
- Open shift (opening cash) → record sales, expenses, cash in/out → close shift with closing cash.
- Shift summary: expected vs actual cash, variance.
- Per-cashier shift history.

### 9. Expenses (المصروفات)
- Add expense with category (إيجار، كهرباء، مياه، رواتب، أخرى) and optional note.
- Linked to active shift when applicable.
- Monthly/range reports.

### 10. Reports (التقارير)
- Daily sales, P&L, top sellers, inventory valuation, customer debts, expenses.
- Date-range filter on all reports.
- Charts (Recharts) + export each report to PDF and Excel.

### 11. Smart Notifications
- Bell icon in header showing: low stock, near-expiry, overdue debts, daily summary.
- Real-time updates via Supabase Realtime + computed badge counts.

### 12. Settings (الإعدادات)
- Shop name, logo, address, phone.
- Currency (default EGP) and tax % (default 14%).
- Receipt customization (header/footer text).
- Employee management (owner only): add/edit/delete employees, assign role, reset PIN.
- Manual data export (full backup as JSON/Excel).
- Light/Dark mode toggle (persisted).

## UI / UX

- Full RTL with Arabic everywhere; numerals shown as Arabic-Indic where natural, Western for prices (toggleable).
- Theme: professional blue + dark/light mode with smooth transition.
- Mobile-first responsive layout, large tap targets, collapsible sidebar (icon mode on mobile).
- Confirmation dialogs on destructive actions, toast notifications (sonner), skeleton loaders, empty states with helpful CTAs, subtle Tailwind animations.

## Database (Supabase)

Tables: `profiles`, `user_roles`, `categories`, `products`, `customers`, `suppliers`, `sales`, `sale_items`, `purchases`, `purchase_items`, `expenses`, `customer_debts`, `debt_payments`, `cash_register_shifts`, `shift_movements`, `inventory_alerts`, `settings`, plus a `storage` bucket for product images and shop logo.

- RLS on every table; role checks via `has_role(auth.uid(), 'owner'|'manager'|'cashier')`.
- DB sequence for global invoice numbers.
- Triggers: auto-decrement stock on sale insert, auto-increment on purchase insert, auto-create debt on deferred sale, auto-generate low-stock alerts.
- Realtime enabled on `sales`, `products`, `customer_debts`, `inventory_alerts`.

## Tech Stack

- TanStack Start + React 19 + TypeScript + Tailwind v4 + shadcn/ui.
- Supabase (Lovable Cloud) for DB, Auth bridge, Storage, Realtime.
- PIN auth implemented via Supabase: each employee gets a synthetic email `pin-<id>@shop.local` + the PIN as password, hidden behind a numeric keypad UI.
- Recharts (charts), jsPDF + jspdf-autotable + Arabic font (Amiri) for PDF, SheetJS for Excel, JsBarcode for barcodes, html5-qrcode for camera scanning.

## What you'll need to do
- After first launch, log in with PIN **1234**, then go to Settings → change owner PIN and add your shop info, logo, and employees.
- Allow camera permission in the browser when first using the barcode scanner.

## Out of scope (can add later)
- SMS/WhatsApp automated sending (we open prefilled links instead — no paid gateway).
- Automated cloud backups on a schedule (manual export provided).
- Native mobile apps (this is a responsive web app, installable as PWA on phones).