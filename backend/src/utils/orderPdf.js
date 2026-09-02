const PDFDocument = require('pdfkit');

const fmt = (amount) => `SGD ${parseFloat(amount || 0).toFixed(2)}`;

const getUnitLabel = (item) => {
  if (item.unit) return ` (${item.unit})`;
  if (item.weight) return ` (${item.weight})`;
  return '';
};

// Builds a one-page order-list/invoice PDF and resolves it as a Buffer.
module.exports.buildOrderPdf = (order) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const address = order.shippingAddress || {};
    const items = order.items || [];
    const shippingDate = order.selectedShippingDate || order.shippingDate;
    const displayOrderNumber = order.orderNumber || order.orderId;

    doc.fontSize(18).fillColor('#166534').text('Saaga Biz Pte. Ltd', { align: 'left' });
    doc.fontSize(10).fillColor('#6b7280').text('Order Confirmation', { align: 'left' });
    doc.moveDown(1);

    doc.fontSize(13).fillColor('#111827').text(`Order Number: ${displayOrderNumber}`);
    doc.fontSize(10).fillColor('#374151').text(
      `Order Date: ${new Date(order.createdAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', dateStyle: 'long', timeStyle: 'short' })}`
    );
    if (shippingDate) {
      doc.text(
        `Delivery Date: ${new Date(shippingDate).toLocaleDateString('en-SG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Singapore' })}`
      );
    }
    doc.text(`Payment Status: ${(order.paymentStatus || 'paid').toUpperCase()}`);
    doc.moveDown(1);

    // Item table
    const tableTop = doc.y;
    const colX = { item: 50, qty: 320, price: 380, total: 460 };
    doc.fontSize(10).fillColor('#6b7280');
    doc.text('Item', colX.item, tableTop, { width: 260 });
    doc.text('Qty', colX.qty, tableTop, { width: 50, align: 'right' });
    doc.text('Price', colX.price, tableTop, { width: 70, align: 'right' });
    doc.text('Total', colX.total, tableTop, { width: 90, align: 'right' });
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#166534').stroke();

    let y = tableTop + 22;
    doc.fillColor('#111827');
    items.forEach((item) => {
      const name = `${item.productName || item.name || item.productId}${getUnitLabel(item)}`;
      const rowHeight = doc.heightOfString(name, { width: 260 }) + 6;

      doc.fontSize(10).fillColor('#111827').text(name, colX.item, y, { width: 260 });
      doc.text(String(item.quantity), colX.qty, y, { width: 50, align: 'right' });
      doc.text(fmt(item.price), colX.price, y, { width: 70, align: 'right' });
      doc.text(fmt((item.price || 0) * item.quantity), colX.total, y, { width: 90, align: 'right' });

      y += rowHeight;
      doc.moveTo(50, y - 3).lineTo(550, y - 3).strokeColor('#e5e7eb').stroke();

      if (y > 700) {
        doc.addPage();
        y = 50;
      }
    });

    y += 10;
    if (order.couponCode) {
      doc.fontSize(10).fillColor('#16a34a').text(
        `Coupon ${order.couponCode}: -${fmt(order.discountAmount || order.couponDiscount)}`,
        colX.item,
        y,
        { width: 500, align: 'right' }
      );
      y += 16;
    }
    doc.fontSize(13).fillColor('#111827').text(`Total: ${fmt(order.totalAmount)}`, colX.item, y, {
      width: 500,
      align: 'right',
    });
    y += 30;

    doc.fontSize(11).fillColor('#374151').text('Delivery Address', 50, y);
    y += 16;
    doc.fontSize(10);
    doc.text(address.fullName || '', 50, y);
    if (address.addressLine1) doc.text(address.addressLine1);
    if (address.addressLine2) doc.text(address.addressLine2);
    doc.text(`Singapore ${address.postalCode || ''}`);
    if (address.phone) doc.text(`Phone: ${address.phone}`);

    doc.end();
  });
};
