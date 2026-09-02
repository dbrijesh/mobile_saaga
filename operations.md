# Saaga Admin Dashboard — Operations Guide

**Version:** 1.0 · **Platform:** https://saaga-admin-dashboard.s3-website-ap-southeast-1.amazonaws.com
**Login:** admin@saaga.com · **Support:** arun@saagainfotech.com

---

## Table of Contents

1. [Getting Started & Dashboard](#page-1-getting-started--dashboard)
2. [Order Management & Fulfilment](#page-2-order-management--fulfilment)
3. [Inventory, Categories & Promotions](#page-3-inventory-categories--promotions)
4. [Shipping Dates, Refunds & Escalations](#page-4-shipping-dates-refunds--escalations)

---

# PAGE 1 — Getting Started & Dashboard

## 1.1 Logging In

1. Open the admin URL in any modern browser.
2. Enter your email and password on the login screen.
3. Click **Sign In**. You are authenticated via AWS Cognito — no separate admin account setup is needed for team members (contact the developer to provision new admin accounts).
4. Your session is valid until you close the browser or your token expires (~1 hour). If you see an "Unauthorized" error mid-session, log out and log back in.

> **First-time login after a password reset:** You will be prompted to set a new password. Choose something with at least 8 characters, one uppercase letter, one number, and one special character.

---

## 1.2 Navigation

The left sidebar contains links to all sections:

| Menu Item | Purpose |
|---|---|
| **Dashboard** | Live KPIs, revenue chart, order breakdown |
| **Orders** | View, process, and update all customer orders |
| **Inventory** | Add, edit, delete products; manage stock levels |
| **Categories** | Top-level product categories |
| **Subcategories** | Sub-groupings under each category |
| **Shipping Dates** | Manage available delivery date slots |
| **Coupons** | Create and manage promotional discount codes |

---

## 1.3 Understanding the Dashboard

The Dashboard is a **read-only** overview that loads fresh data every time you visit. It shows:

### Key Metric Cards
| Card | What It Shows |
|---|---|
| **Total Orders** | Lifetime order count across all statuses |
| **Total Revenue** | Sum of all order amounts (SGD), all time |
| **Avg Order Value** | Total Revenue ÷ Total Orders |
| **Pending Orders** | Count of orders awaiting confirmation right now |

### Charts
- **Revenue Trend (12 months):** Line chart showing monthly revenue. Use this to identify seasonal peaks — for Indian groceries in Singapore, expect spikes around Diwali (Oct/Nov) and Pongal (Jan).
- **Order Status Distribution:** Pie chart showing the proportion of orders in each state (Pending, Confirmed, Processing, Shipped, Delivered). A large "Pending" slice means orders need attention.

### Status Grid
Shows exact counts per status. Aim to keep **Pending** and **Confirmed** numbers low by processing orders promptly.

> **If the dashboard shows zero or clearly wrong numbers**, check that you are logged in with a valid token. The data is pulled from the live `/admin/orders` API — if orders exist but numbers look wrong, log out and back in to refresh your session.

---

## 1.4 Daily Operations Checklist

Start each working day with this routine:

- [ ] Log in and check the Dashboard for any spike in Pending orders
- [ ] Go to **Orders → filter "Pending"** — confirm all new orders (see Page 2)
- [ ] Go to **Orders → filter "Confirmed"** — move orders to Processing once packing begins
- [ ] Check the **low-stock banner** on Inventory and restock items below 10 units
- [ ] Verify upcoming **Shipping Dates** haven't hit capacity limits
- [ ] Check for any failed payments or cancellation requests from customers (via email/support)

---

# PAGE 2 — Order Management & Fulfilment

## 2.1 Order Lifecycle

Every order passes through these statuses in sequence:

```
pending → confirmed → processing → shipped → delivered
```

The only exception is **cancelled**, which can occur at any stage before delivery. Cancelled orders are locked and cannot be modified further.

| Status | Meaning | Who Acts |
|---|---|---|
| **pending** | Customer placed order, payment received | Admin — confirm promptly |
| **confirmed** | Admin acknowledged the order | Admin — begin packing |
| **processing** | Order is being packed/prepared | Admin — update when ready to dispatch |
| **shipped** | Order handed to delivery | Admin — update when dispatched |
| **delivered** | Customer received the order | Admin — update after delivery confirmation |
| **cancelled** | Order cancelled by customer or admin | See Section 2.5 |

---

## 2.2 Viewing Orders

1. Click **Orders** in the sidebar.
2. The table shows all orders sorted by date (newest first), with columns: Order ID, Customer, Items, Total, Status, Delivery Date, Actions.
3. Use the **filter buttons** at the top right to narrow by status:
   - **All** · **Pending** · **Processing** · **Shipped** · **Delivered** · **Cancelled**
4. Click **View Details** on any row to open the full order modal.

### Order Detail Modal
The modal contains four sections:

- **Order Info** — Order ID, date placed, payment status, coupon discount (if applied), order total
- **Delivery Details** — Customer name, address, city, postal code, phone number, and scheduled delivery date
- **Items** — Product image, name, SKU, unit/weight, category, quantity, and line total for each item
- **Update Status** — Buttons to move the order through the lifecycle

---

## 2.3 Processing an Order (Step-by-Step)

### Step 1 — Confirm New Orders
1. Filter by **Pending**.
2. Click **View Details** on each order.
3. Review items, check stock levels (cross-check with Inventory).
4. Click **Confirmed** in the Update Status section.
5. Notify the customer via email/WhatsApp if your workflow includes that.

### Step 2 — Pack the Order
1. Filter by **Confirmed**.
2. Open the order and click **Processing** once packing has started.
3. Use the **Print** button to generate a printed packing slip — the print view shows the full order in a clean, black-and-white format suitable for fulfilment.

> **Print tip:** The print layout hides the sidebar, header, and buttons. It shows only the order details, items, delivery address, and totals. Use it as the packing sheet that goes into the bag.

### Step 3 — Mark as Shipped
1. Once the order is handed to the delivery person, open the order and click **Shipped**.
2. Send the customer a delivery notification (outside the admin panel — via WhatsApp/email).

### Step 4 — Confirm Delivery
1. After the delivery date, confirm delivery with the driver or customer.
2. Open the order and click **Delivered**.

---

## 2.4 Printing a Fulfilment Sheet

1. Open the order via **View Details**.
2. Click the **Print** button in the top-right of the modal.
3. Your browser's print dialog will open.
4. The sheet includes: Order ID, customer address, delivery date, all items with SKU and quantity, coupon discount, and total.
5. Print one sheet per order. Attach to the delivery bag.

---

## 2.5 Cancelling an Order

Cancellations can be initiated by customers (via email/phone) or proactively by admin (e.g., stock unavailability).

1. Open the order via **View Details**.
2. Click **Cancelled** in the Update Status section.
3. Confirm the action in the browser prompt.
4. The order is now locked — status is frozen at **Cancelled** and no further updates are possible.

> **Important:** Cancellation in the admin panel only updates the order record. **It does not automatically process a refund.** Follow the refund procedure in Section 4.3 separately.

**When to cancel:**
- Customer requests cancellation before delivery
- Item out of stock and no substitution available
- Delivery address cannot be reached
- Payment dispute or fraud suspected

---

## 2.6 Order with Coupon Discount

If an order used a coupon code, the order detail modal shows:
- Each item subtotal
- A separate **Discount** row (in green) showing the coupon deduction
- The final **Order Total** after discount

The coupon code itself is not shown in the order detail — only the discount amount. To look up the coupon used, check the coupon code against the **Coupons** module.

---

# PAGE 3 — Inventory, Categories & Promotions

## 3.1 Managing Inventory

### Viewing Products
1. Click **Inventory** in the sidebar.
2. Products are shown in a table with: Image, SKU, Name, Category, Subcategory, Price, Discount, Discounted Price, Stock, Status, Actions.
3. Use the **search bar** to filter by product name or SKU.
4. Use the **Category** and **Subcategory** dropdowns to narrow the list.

### Stock Status Indicators
- **In Stock** (green badge) — stock > 0
- **Out of Stock** (red badge) — stock = 0
- **Low Stock row highlight** — stock < 10 (row highlighted in red tint)
- **Low stock alert banner** — appears at top of page if any product has stock < 10

### Statistics Cards
Three summary cards appear below the table:
- **Total Products** — total product count in the system
- **Low Stock Items** — count of products with stock < 10
- **Total Stock Value** — sum of (price × stock) across all products

---

## 3.2 Adding a New Product

1. Click **Add New Product**.
2. Fill in the form:

| Field | Required | Notes |
|---|---|---|
| **SKU** | Yes | Unique identifier. Cannot be changed after creation. Use format like `VEG-001`, `RICE-5KG` |
| **Product Name** | Yes | Full name as shown to customers |
| **Description** | No | Appears on the product detail screen in the app |
| **Category** | Yes | Must match an existing category |
| **Subcategory** | No | Optional sub-grouping; populates based on category selected |
| **Price (SGD)** | Yes | Base price. Use 2 decimal places |
| **Stock** | Yes | Current quantity available |
| **Discount %** | No | 0–100. Leave blank or 0 for no discount |
| **Unit** | No | e.g. "500g", "1 bunch", "1 litre" |
| **Weight** | No | e.g. "500g" |
| **Product Image** | No | Upload a JPEG/PNG (max ~5MB). Stored in S3 |

3. Click **Create Product**.

---

## 3.3 Editing a Product

1. Click **Edit** on the product row.
2. All fields are editable **except SKU** (locked after creation).
3. To update stock after a delivery, change the **Stock** value and save.
4. To apply or change a sale discount, update **Discount %**.
5. Click **Save Changes**.

> **Discounted price calculation:** `Discounted Price = Price × (1 − Discount% ÷ 100)`. This is shown in the table and is the price customers pay in the app.

---

## 3.4 Deleting a Product

1. Click **Delete** on the product row.
2. Confirm the deletion in the browser dialog.
3. The product is permanently removed from the catalogue and will no longer appear in the app.

> **Caution:** Only delete products that are fully discontinued. If the product is temporarily out of stock, set **Stock = 0** instead — it will show as "Out of Stock" in the app without losing the product record.

---

## 3.5 Bulk Import via CSV

Use CSV import to add or update many products at once (e.g., after a new supplier delivery or price update).

### Export first (recommended)
1. Click **Export CSV** to download the current inventory as a CSV file.
2. Open in Excel or Google Sheets.
3. Edit or add rows.

### CSV Format
The import file must have these columns (header row required):

```
sku, name, description, category, subCategory, price, stock, discountPercentage, unit, weight, imageUrl
```

- **SKU is the matching key** — if a row's SKU already exists, it updates that product. If the SKU is new, it creates a new product.
- Leave `imageUrl` blank if you want to keep the existing image.
- Discount should be a number between 0 and 100 (not a percentage sign).

### Import Steps
1. Click **Import CSV**.
2. Select your prepared CSV file.
3. The system processes each row — existing products are updated, new products are created.
4. Refresh the page to verify changes.

> **Common errors:**
> - Missing required fields (sku, name, price, stock) — those rows will be skipped
> - Category name doesn't match an existing category — product will be created without a category assignment
> - Discount > 100 — will be rejected

---

## 3.6 Managing Categories

Categories are the top-level product groupings displayed in the app (e.g., Vegetables, Rice & Grains, Spices).

### Add a Category
1. Go to **Categories** → click **Add New Category**.
2. Fill in:
   - **Name** (required) — e.g. "Vegetables"
   - **Icon** (optional) — a single emoji, e.g. 🥦
   - **Description** (optional)
3. Click **Create Category**.

### Edit a Category
1. Click **Edit** on the category card.
2. Update name, icon, or description.
3. Click **Save Changes**.

> Renaming a category does **not** automatically re-assign products. Products store the category name string — if you rename a category, existing products will still show the old name until you re-save each product. For large catalogues, do a CSV import to bulk-update category names.

### Delete a Category
1. Click **Delete** on the category card.
2. Confirm the deletion.
3. The API will reject the delete if products are currently assigned to this category.

---

## 3.7 Managing Subcategories

Subcategories group products within a category (e.g., under "Vegetables": Leafy Greens, Root Vegetables).

1. Go to **Subcategories**.
2. Use the **category filter** dropdown to view subcategories for a specific parent.
3. Click **Add New Subcategory** and fill in:
   - **Parent Category** (required)
   - **Name** (required)
   - **Icon** (optional emoji)
   - **Description** (optional)
4. Click **Create Subcategory**.

> Deleting a subcategory removes the subcategory reference from all products that used it. The products themselves remain.

---

## 3.8 Managing Coupons

### Creating a Coupon
1. Go to **Coupons** → click **Add New Coupon**.
2. Fill in the form:

| Field | Required | Notes |
|---|---|---|
| **Coupon Code** | Yes | Max 20 characters, auto-uppercased. Cannot change after creation. e.g. `DIWALI20` |
| **Discount Type** | Yes | **Percentage** or **Fixed Amount**. Cannot change after creation |
| **Discount Value** | Yes | For Percentage: 1–100. For Fixed: amount in SGD |
| **Min Purchase (SGD)** | No | Customer's cart must meet this threshold to apply coupon |
| **Max Discount (SGD)** | No | Caps the discount for percentage-type coupons |
| **Expiry Date** | No | Leave blank for no expiry |
| **Usage Limit** | No | Max total uses. Leave blank for unlimited |
| **Description** | No | Internal note — not shown to customers |

3. Click **Create Coupon**.

### Deactivating a Coupon
1. Click **Edit** on the coupon row.
2. Change **Status** from **Active** to **Inactive**.
3. Click **Save Changes**.

The coupon will immediately stop working for new orders. Usage already applied to past orders is unaffected.

### Deleting a Coupon
1. Click **Delete** on the coupon row.
2. Confirm deletion.
3. The coupon is soft-deleted (it disappears from the list but its historical usage data is preserved in orders).

### Coupon Usage Tracking
The coupons table shows current usage as **X / Y** (e.g., "45 / 100") or **X / ∞** for unlimited coupons. Monitor this column to identify popular promotions and decide when to refresh or extend codes.

---

# PAGE 4 — Shipping Dates, Refunds & Escalations

## 4.1 Managing Shipping Dates

Shipping dates control which delivery days are available to customers in the app. Customers select a delivery date at checkout — only dates configured here (with `active` status and remaining capacity) are shown.

### Viewing Shipping Dates
1. Go to **Shipping Dates**.
2. The table shows: Delivery Date, Order Window Closes, Capacity, Current Orders (with % full), Status, Notes, Actions.
3. Dates where the **Order Window Close** is in the past appear in red — customers can no longer book these.

### Adding a Delivery Date
1. Click **Add Shipping Date**.
2. Fill in:

| Field | Required | Notes |
|---|---|---|
| **Delivery Date** | Yes | Must be today or a future date |
| **Order Window Closes** | No | Last day/time customers can order for this date. Cannot be after the delivery date |
| **Capacity** | Yes | Maximum number of orders for this date (e.g. 50) |
| **Notes** | No | Internal note, e.g. "Deepavali delivery slot" |

3. Click **Save**. The new date is immediately visible to customers in the app.

### Editing a Delivery Date
1. Click **Edit** on the row.
2. You can adjust:
   - **Capacity** — increase if you can handle more orders, decrease to slow bookings
   - **Order Window Close Date** — bring forward to stop new bookings sooner
   - **Status** — change to `full` or `cancelled` manually
   - **Notes**
3. Click **Save Changes**.

### Cancelling a Delivery Date
Use the **Cancel** button on the row. This sets the status to `cancelled` and the slot immediately disappears from the customer app. Use this for:
- Public holidays or unexpected closures
- Driver unavailability
- Extreme weather or other disruptions

> **Important:** Cancelling a shipping date does **not** automatically notify customers or cancel their orders. You must manually contact affected customers and process refunds separately (see Section 4.3).

### Capacity Planning
- The **Current Orders** column shows how many orders are booked vs. the limit, with a percentage.
- When a date hits 100%, its status automatically becomes **full** and no further bookings are accepted.
- Recommended: Add shipping dates at least 2 weeks in advance and maintain at least 3–4 active future dates at all times.

---

## 4.2 Recommended Shipping Date Setup

For a weekly delivery schedule (e.g., Saturdays only):

1. Go to **Shipping Dates** on Monday of each week.
2. Add the upcoming Saturday's date with capacity 50 and an order window closing Thursday midnight.
3. Repeat for 3–4 weeks ahead.
4. This ensures customers always see upcoming slots and you have a buffer to plan logistics.

For surge periods (Diwali, Pongal, Year-End):
- Add extra mid-week slots.
- Reduce individual day capacity to manage fulfilment quality.
- Use the **Notes** field to flag special handling.

---

## 4.3 Processing Refunds

**Refunds are not automated from the admin panel.** They must be processed manually through the Stripe Dashboard. Follow these steps:

### Step 1 — Identify the Order
1. Open the cancelled or disputed order in **Orders → View Details**.
2. Note the **Order ID** and **Total Amount**.
3. Note the **Customer Name** and **email/phone** for communication.

### Step 2 — Find the Payment in Stripe
1. Log in to the Stripe Dashboard at **dashboard.stripe.com**.
2. Go to **Payments** (left sidebar).
3. Search by amount or customer email to find the matching payment.
4. Open the payment record and confirm it matches the order (amount, date, last 4 digits of card if available).

### Step 3 — Issue the Refund
1. On the Stripe payment page, click **Refund**.
2. Choose the refund amount:
   - **Full refund** — for complete cancellations
   - **Partial refund** — for partially fulfilled orders (e.g., one item out of stock)
3. Select a **reason** from the dropdown (e.g., duplicate, fraudulent, requested by customer).
4. Add a note if needed.
5. Click **Refund**.

### Step 4 — Confirm Refund Timing
- Refunds typically appear on the customer's card within **5–10 business days** depending on their bank.
- Stripe sends an automatic email to the customer when the refund is initiated.
- You can verify the refund status in Stripe → Payments → click the payment → scroll to the Refunds section.

### Step 5 — Update the Admin Panel
1. Go back to the admin **Orders** page.
2. If not already cancelled, update the order status to **Cancelled**.
3. Optionally add a note in the order (if the system supports it) or log it in your internal records.

> **Partial Fulfilment Refund Example:** A customer ordered 5 items for SGD 48.00. One item worth SGD 9.00 was out of stock. Issue a partial refund of SGD 9.00 via Stripe and deliver the remaining 4 items.

---

## 4.4 Handling Customer Escalations

### Customer Can't Apply Coupon
1. Go to **Coupons** and verify the code exists and is **Active**.
2. Check the **Expiry Date** — has it passed?
3. Check the **Usage Limit** — has it been exhausted?
4. Check the **Min Purchase Amount** — is the customer's cart above the threshold?
5. If the coupon is valid but the app is rejecting it, escalate to the developer.

### Customer Reports Missing Item
1. Open the order in **Orders → View Details** and review the item list.
2. Cross-reference with the printed packing slip for that order.
3. If the item was packed and delivered, ask customer to check the full bag.
4. If the item was not packed, issue a partial refund for that item via Stripe (Section 4.3).

### Customer Wants to Change Delivery Date
- Orders cannot be rescheduled from within the admin panel.
- If the customer contacts you before the order window closes for the new date:
  1. Cancel the original order and refund via Stripe.
  2. Ask the customer to re-place the order with the new delivery date.
- If after the order window closes, handle case by case.

### Out-of-Stock After Order Accepted
1. Update the product stock to 0 in **Inventory** immediately.
2. Contact the customer to offer a substitution or refund.
3. If refunding: cancel the order (Section 2.5) and process the refund (Section 4.3).
4. If substituting: fulfil as normal and update the order notes if your workflow requires a record.

---

## 4.5 Adding New Admin Users

New admin users must be created via the AWS Cognito console (developer access required) or by the developer using the CLI:

```bash
# Developer runs this command
aws cognito-idp admin-create-user \
  --user-pool-id ap-southeast-1_1BQKFzF5m \
  --username newadmin@saaga.com \
  --user-attributes Name=email,Value=newadmin@saaga.com Name=name,Value="New Admin" \
  --temporary-password "TempPass@2026" \
  --region ap-southeast-1
```

The new user will be prompted to change their password on first login.

---

## 4.6 Quick Reference Card

| Task | Where | Steps |
|---|---|---|
| Confirm new order | Orders → Pending filter | View Details → click Confirmed |
| Mark order shipped | Orders → Confirmed/Processing | View Details → click Shipped |
| Print packing slip | Orders | View Details → Print |
| Cancel an order | Orders | View Details → click Cancelled |
| Refund a customer | Stripe Dashboard | Find payment → Refund |
| Update stock level | Inventory | Edit product → change Stock → Save |
| Add a product | Inventory | Add New Product → fill form |
| Bulk update prices | Inventory | Export CSV → edit → Import CSV |
| Add delivery slot | Shipping Dates | Add Shipping Date → fill form |
| Block a delivery day | Shipping Dates | Find date → Cancel button |
| Create a coupon | Coupons | Add New Coupon → fill form |
| Disable a coupon | Coupons | Edit → Status: Inactive → Save |
| Add product category | Categories | Add New Category → fill form |
| Reset admin password | Developer (AWS CLI) | `admin-set-user-password` command |

---

## 4.7 System Information

| Item | Value |
|---|---|
| **Admin URL** | https://saaga-admin-dashboard.s3-website-ap-southeast-1.amazonaws.com |
| **API Region** | ap-southeast-1 (Singapore) |
| **Auth Provider** | AWS Cognito — pool `ap-southeast-1_1BQKFzF5m` |
| **Payment Processor** | Stripe (Live mode) |
| **Stripe Dashboard** | https://dashboard.stripe.com |
| **Image Storage** | AWS S3 (auto-uploaded on product save) |
| **Database** | AWS DynamoDB (serverless, auto-scaling) |
| **Backend** | AWS Lambda + API Gateway (serverless) |

---

*This document covers day-to-day operations. For infrastructure changes, deployments, or technical issues, contact the development team.*
