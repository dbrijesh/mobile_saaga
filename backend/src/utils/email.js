const nodemailer = require('nodemailer');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { buildOrderPdf } = require('./orderPdf');

const secretsClient = new SecretsManagerClient({ region: process.env.REGION || 'ap-southeast-1' });

const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'customercare@saagaonline.com';
const CC_EMAIL = process.env.SES_CC_EMAIL || 'customercare@saagaonline.com';

let transporterPromise = null;

const getTransporter = () => {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    const secret = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: process.env.SMTP_SECRET_ARN })
    );
    const { username, password } = JSON.parse(secret.SecretString);

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: 587,
      secure: false, // STARTTLS on port 587
      requireTLS: true,
      auth: { user: username, pass: password },
    });
  })();

  return transporterPromise;
};

const fmt = (amount) => `SGD ${parseFloat(amount || 0).toFixed(2)}`;

const getUnitLabel = (item) => {
  if (item.unit) return ` (${item.unit})`;
  if (item.weight) return ` (${item.weight})`;
  return '';
};

const buildOrderHtml = (order, isAdmin = false) => {
  const address = order.shippingAddress || {};
  const items = order.items || [];
  const shippingDate = order.selectedShippingDate || order.shippingDate;

  const itemRows = items.map((item) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">
        ${item.productName || item.name || item.productId}${getUnitLabel(item)}
        ${item.sku ? `<br><span style="font-size:11px;color:#6b7280;">SKU: ${item.sku}</span>` : ''}
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(item.price)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${fmt((item.price || 0) * item.quantity)}</td>
    </tr>`).join('');

  const greeting = isAdmin
    ? `<p style="color:#374151;">A new order has been placed on Saaga.</p>`
    : `<p style="color:#374151;">Hi <strong>${address.fullName || 'Customer'}</strong>,<br>Your order has been received and is being processed. We'll notify you when it's on its way.</p>`;

  const displayOrderNumber = order.orderNumber || order.orderId;

  const headline = isAdmin
    ? `New Order — ${displayOrderNumber}`
    : `Your Order is Confirmed!`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Order ${displayOrderNumber}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">

  <!-- Header -->
  <tr><td style="background:#166534;padding:28px 32px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:-0.3px;">Saaga Biz Pte. Ltd</h1>
    <p style="margin:6px 0 0;color:#bbf7d0;font-size:13px;">Order Confirmation</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 16px;color:#166534;font-size:20px;">${headline}</h2>
    ${greeting}

    <!-- Order Meta -->
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;">
      <table width="100%" cellpadding="4">
        <tr><td style="color:#6b7280;font-size:13px;width:130px;">Order Number</td>
            <td style="font-weight:600;font-size:13px;font-family:monospace;">${displayOrderNumber}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;">Order Date</td>
            <td style="font-size:13px;">${new Date(order.createdAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', dateStyle: 'long', timeStyle: 'short' })}</td></tr>
        ${shippingDate ? `<tr><td style="color:#6b7280;font-size:13px;">Delivery Date</td>
            <td style="font-size:13px;font-weight:600;color:#166534;">${new Date(shippingDate).toLocaleDateString('en-SG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Singapore' })}</td></tr>` : ''}
        <tr><td style="color:#6b7280;font-size:13px;">Payment</td>
            <td style="font-size:13px;color:#16a34a;">${(order.paymentStatus || 'paid').toUpperCase()}</td></tr>
      </table>
    </div>

    <!-- Items -->
    <h3 style="margin:0 0 12px;color:#374151;font-size:14px;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #166534;padding-bottom:8px;">Order Items</h3>
    <table width="100%" cellpadding="0" cellspacing="0">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:10px 8px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Item</th>
          <th style="padding:10px 8px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Qty</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Price</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <!-- Totals -->
    ${order.couponCode ? `
    <div style="text-align:right;padding:10px 8px;color:#16a34a;font-size:13px;">
      Coupon <strong>${order.couponCode}</strong>: -${fmt(order.discountAmount || order.couponDiscount)}
    </div>` : ''}
    <div style="text-align:right;padding:14px 8px;border-top:2px solid #166534;font-size:17px;color:#111827;">
      <strong>Total: ${fmt(order.totalAmount)}</strong>
    </div>

    <!-- Delivery Address -->
    <h3 style="margin:24px 0 12px;color:#374151;font-size:14px;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #166534;padding-bottom:8px;">Delivery Address</h3>
    <p style="margin:0;line-height:1.8;color:#374151;">
      <strong>${address.fullName || ''}</strong><br>
      ${address.addressLine1 || ''}${address.addressLine2 ? '<br>' + address.addressLine2 : ''}<br>
      Singapore ${address.postalCode || ''}
      ${address.phone ? `<br>Phone: ${address.phone}` : ''}
    </p>

    <!-- Footer note -->
    <div style="margin-top:28px;padding:14px 16px;background:#f0fdf4;border-left:4px solid #166534;border-radius:0 8px 8px 0;font-size:13px;color:#374151;">
      For queries, contact us at <a href="mailto:customercare@saagaonline.com" style="color:#166534;">customercare@saagaonline.com</a>
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f9fafb;padding:16px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;">
    Saaga Biz Pte. Ltd &bull; Singapore
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
};

module.exports.sendOrderConfirmationEmail = async (order, customerEmail) => {
  if (!customerEmail) {
    console.warn('No customer email — skipping confirmation email');
    return;
  }

  const html = buildOrderHtml(order, false);
  const adminHtml = buildOrderHtml(order, true);
  const displayOrderNumber = order.orderNumber || order.orderId;

  let pdfAttachment;
  try {
    const pdfBuffer = await buildOrderPdf(order);
    pdfAttachment = {
      filename: `Order-${displayOrderNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    };
  } catch (err) {
    console.error('Failed to generate order PDF:', err.message);
  }

  try {
    // Email to customer (CC customercare)
    const transporter = await getTransporter();
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: customerEmail,
      cc: CC_EMAIL,
      subject: `Order Confirmed #${order.orderNumber || order.orderId.slice(0, 8).toUpperCase()} | Saaga Biz Pte. Ltd`,
      html,
      text: `Order Confirmed!\n\nOrder Number: ${order.orderNumber || order.orderId}\nTotal: ${fmt(order.totalAmount)}\n\nThank you for shopping with Saaga.`,
      attachments: pdfAttachment ? [pdfAttachment] : [],
    });
    console.log(`Order confirmation email sent to ${customerEmail}`);
  } catch (err) {
    // Don't fail the order if email fails
    console.error('Failed to send order confirmation email:', err.message);
  }
};

// Status-update emails (order status changed by admin — processing/shipped/delivered/etc)
const STATUS_EMAIL_CONTENT = {
  confirmed: {
    label: 'Order Confirmed',
    banner: '#166534',
    message: 'Your order has been confirmed and is being prepared.',
  },
  processing: {
    label: 'Order Processing',
    banner: '#b45309',
    message: 'Good news — your order is now being packed and prepared for delivery.',
  },
  shipped: {
    label: 'Order Shipped',
    banner: '#1d4ed8',
    message: 'Your order is on its way!',
  },
  delivered: {
    label: 'Order Delivered',
    banner: '#166534',
    message: 'Your order has been delivered. We hope you enjoy your Saaga groceries!',
  },
  cancelled: {
    label: 'Order Cancelled',
    banner: '#b91c1c',
    message: 'Your order has been cancelled. If this is unexpected, please contact us.',
  },
};

const buildStatusEmailHtml = (order, status, trackingNumber) => {
  const content = STATUS_EMAIL_CONTENT[status];
  const address = order.shippingAddress || {};
  const displayOrderNumber = order.orderNumber || order.orderId;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Order ${displayOrderNumber} — ${content.label}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">

  <!-- Header -->
  <tr><td style="background:${content.banner};padding:28px 32px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:-0.3px;">Saaga Biz Pte. Ltd</h1>
    <p style="margin:6px 0 0;color:#f3f4f6;font-size:13px;">${content.label}</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 16px;color:${content.banner};font-size:20px;">${content.label}</h2>
    <p style="color:#374151;">Hi <strong>${address.fullName || 'Customer'}</strong>,<br>${content.message}</p>

    <!-- Order Meta -->
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0;">
      <table width="100%" cellpadding="4">
        <tr><td style="color:#6b7280;font-size:13px;width:130px;">Order Number</td>
            <td style="font-weight:600;font-size:13px;font-family:monospace;">${displayOrderNumber}</td></tr>
        ${trackingNumber ? `<tr><td style="color:#6b7280;font-size:13px;">Tracking Number</td>
            <td style="font-size:13px;font-weight:600;">${trackingNumber}</td></tr>` : ''}
        <tr><td style="color:#6b7280;font-size:13px;">Total</td>
            <td style="font-size:13px;">${fmt(order.totalAmount)}</td></tr>
      </table>
    </div>

    <!-- Footer note -->
    <div style="margin-top:28px;padding:14px 16px;background:#f9fafb;border-left:4px solid ${content.banner};border-radius:0 8px 8px 0;font-size:13px;color:#374151;">
      For queries, contact us at <a href="mailto:customercare@saagaonline.com" style="color:${content.banner};">customercare@saagaonline.com</a>
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f9fafb;padding:16px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;">
    Saaga Biz Pte. Ltd &bull; Singapore
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
};

module.exports.sendOrderStatusEmail = async (order, customerEmail, status, trackingNumber) => {
  const content = STATUS_EMAIL_CONTENT[status];
  if (!content) return; // no email copy defined for this status — nothing to send

  if (!customerEmail) {
    console.warn(`No customer email for order ${order.orderId} — skipping ${status} email`);
    return;
  }

  const displayOrderNumber = order.orderNumber || order.orderId;
  const html = buildStatusEmailHtml(order, status, trackingNumber);

  try {
    const transporter = await getTransporter();
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: customerEmail,
      cc: CC_EMAIL,
      subject: `${content.label} — Order #${displayOrderNumber} | Saaga Biz Pte. Ltd`,
      html,
      text: `${content.label}\n\nOrder Number: ${displayOrderNumber}\n${content.message}${trackingNumber ? `\nTracking Number: ${trackingNumber}` : ''}`,
    });
    console.log(`Order ${status} email sent to ${customerEmail}`);
  } catch (err) {
    // Don't fail the status update if email fails
    console.error(`Failed to send order ${status} email:`, err.message);
  }
};
