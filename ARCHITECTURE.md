# ARCHITECTURE.md — مخطط البنية (خط الأساس)

> مستخرج من الكود كما هو في 2026-11-26 (مشروع قائم — المعيار 16). **ينتظر اعتماد خالد** (انظر `PLAN.md`).

## 1. المكوّنان الحاليان

| المكوّن | الغرض | التقنية | الحالة |
|---|---|---|---|
| نسخة العرض `demo/` | مراجعة العميل واعتماد سير العمل والمطبوعات | HTML/JS في ملف واحد، البيانات في متصفح المستخدم | مكتملة للمراجعة — **ليست نظامًا فعليًا** (EX-001) |
| النظام الكامل `src/` + `prisma/` | التشغيل الفعلي | Next.js 15 (App Router) + TypeScript + PostgreSQL + Prisma | المخطط والترحيل ومكتبات الحساب والمصادقة جاهزة؛ الشاشات والخدمات لم تُبنَ |

قواعد العمل في `demo/src/logic.js` هي المرجع الوظيفي المعتمد بعد مراجعة العميل، وتُنقل إلى خدمات الخادم في `src/server/services`.

## 2. الوحدات وحدودها (النظام الكامل)

| الوحدة | المسؤولية | تكشف | تعتمد على |
|---|---|---|---|
| `auth` | الدخول، الجلسات، الأدوار والصلاحيات | `getCurrentUser`, `requirePermission`, `pageGuard`, `apiGuard` | `prisma` |
| `customers` | العملاء، المشاريع، الكفيل الغارم، التقييم، القائمة السوداء، البحث | خدمات CRUD + `searchCustomers` | `auth`, `audit` |
| `catalog-inventory` | الأصناف، المستودعات، دفتر الحركات، الأرصدة | `move`, `balances` | `auth`, `audit` |
| `sales` | البيع، الموافقة على الخصم، الإلغاء | `createSale`, `confirmSale`, `cancelSale` | `inventory`, `billing`, `payments` |
| `rentals` | العقود، التسليم، كشف الدخول، الفوترة الدورية، التأمين، الإغلاق | `createRental`, `deliver`, `return`, `bill`, `close`, `cancel` | `inventory`, `billing`, `finance` |
| `billing` | الفواتير الضريبية والإشعارات الدائنة، رمز ZATCA | `createInvoice` | `settings` |
| `finance` | سندات القبض والتخصيص، سندات الصرف، المصروفات، الحسابات | `recordPayment`, `createExpense`, `accountBalance` | `billing`, `approvals` |
| `approvals` | مركز الموافقات | `decideApproval` | الوحدات صاحبة الطلب |
| `reports` | اللوحات، اليومية، الحركة الشهرية، دفتر الصندوق، كشوف العملاء | قراءة فقط | كل الوحدات (قراءة) |
| `print` | قوالب المستندات وPDF | قراءة فقط | كل الوحدات (قراءة) |
| `audit` / `notifications` / `settings` | التدقيق، التنبيهات، الإعدادات | `audit()`, `getSettings()` | `prisma` |

**قاعدة الفصل:** تعديل الأرصدة (مخزون/مال) يتم فقط داخل خدمات `src/server/services` وداخل `$transaction`. الواجهة لا تحسب ولا تكتب أرصدة.

## 3. نموذج البيانات ومالكه

مرجع: `prisma/schema.prisma` (الترحيل `20261125071725_init`).

| الكيان | المالك | ملاحظة سلامة |
|---|---|---|
| `StockBalance` / `InventoryMovement` | catalog-inventory | قيد `stock_non_negative`؛ الرصيد يطابق الدفتر |
| `Sale` / `SaleItem` | sales | الأسعار تُنسخ وقت البيع |
| `Rental` / `RentalItem` / `DeliveryNote` / `ReturnNote` / `RentalDeposit` | rentals | قيد `rental_item_counts` (مرتجع ≤ مسلّم ≤ مطلوب) |
| `Invoice` / `InvoiceItem` | billing | قيد `invoice_paid_range` (0 ≤ مدفوع ≤ إجمالي) |
| `Payment` / `PaymentAllocation` / `FinancialTransaction` | finance | `paymentId` فريد في الحركة = قيد واحد لكل سند |
| `Expense` / `Approval` | finance / approvals | — |
| `Customer` / `Project` / `PromissoryNote` / `Document` | customers | المعرّفات نصية بأصفارها |
| `User` / `Session` / `LoginAttempt` / `AuditLog` | auth / audit | كلمات المرور bcrypt؛ رمز الجلسة مخزن كـ SHA-256 |

**يُضاف قبل البناء (CR-002):** حقول الكفيل الغارم (`guarantorId`)، رقم سند الصرف (`pvNo`)، المستفيد وطريقة الصرف في `Expense` — موجودة في العرض وغير موجودة في المخطط.

## 4. العمليات وحالاتها

- **البيع:** `PENDING_APPROVAL` → `CONFIRMED` → `CANCELLED`. حالة السداد مشتقة من الفاتورة: غير مدفوعة / جزئي / مدفوعة / متأخرة.
- **الإيجار:** `RESERVED` → `ACTIVE` → `PARTIALLY_RETURNED` → `RETURNED` → `CLOSED`، أو `CANCELLED` قبل التسليم.
- **المصروف:** `PENDING` → `APPROVED` (يصدر سند صرف ويُرحّل مرة واحدة) / `REJECTED`.
- **الفاتورة:** `ISSUED` → `CANCELLED` (بإشعار دائن، فقط إن لم يُدفع منها شيء).

## 5. التكاملات

| التكامل | الحالة |
|---|---|
| ZATCA المرحلة الأولى (QR بصيغة TLV) | منفذ في العرض |
| ZATCA المرحلة الثانية (الربط) | مستقبلي — بانتظار قرار المؤسسة |
| واتساب/SMS/بريد | غير منفذ |
| بوابة دفع | غير مطلوبة |

## 6. نقاط المرونة

- الإعدادات (`Setting`): نسبة الضريبة، حد اعتماد المصروف، حد خصم البائع، أيام الاستحقاق.
- الصلاحيات الإضافية لكل مستخدم (`User.permissions`) مستقلة عن الدور.
- **Feature Flags:** غير منفذة بعد — مطلوبة في المرحلة 1 (المعيار 16).

## 7. القرارات (ADR)

| # | القرار | السبب |
|---|---|---|
| ADR-001 | المبالغ بالهللة (أعداد صحيحة) في العرض و`Decimal` في القاعدة | لا أخطاء كسور |
| ADR-002 | الأرصدة مشتقة من الدفاتر، والمخزن منها يُحدّث في نفس المعاملة | قابلية المراجعة |
| ADR-003 | الأيام شاملة يوم التسليم ويوم الرد، والشهري ÷ 30 | يطابق كشوف المؤسسة (كشف محمد) |
| ADR-004 | الفاتورة الصادرة لا تُعدّل؛ الإلغاء بإشعار دائن | متطلبات الفوترة الإلكترونية |
| ADR-005 | نسخة عرض مستقلة قبل البناء الكامل | اعتماد سير العمل مع العميل أولًا |
