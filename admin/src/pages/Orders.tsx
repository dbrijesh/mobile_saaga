import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import './Orders.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev';
const API_KEY = import.meta.env.VITE_API_KEY || '';

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [enrichingItems, setEnrichingItems] = useState(false);

  const formatDate = (dateString: string, formatString: string) => {
    try {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return format(date, formatString);
    } catch {
      return 'N/A';
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setOrders([]);
        return;
      }
      const response = await axios.get(`${API_URL}/admin/orders`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setOrders(response.data.orders || []);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        alert('Your session has expired. Please logout and login again.');
      } else {
        alert('Error loading orders. Please try again.');
      }
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) { alert('Not logged in. Please refresh.'); return; }

      const response = await axios.put(
        `${API_URL}/orders/${orderId}/status`,
        { status: newStatus },
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      const updatedOrder = response.data.order || { ...selectedOrder, status: newStatus, updatedAt: new Date().toISOString() };
      const enriched = await enrichItemsWithProductData(updatedOrder);
      setSelectedOrder(enriched);
      await fetchOrders();
      alert('Order status updated successfully!');
    } catch (error: any) {
      console.error('Error updating order status:', error);
      alert(`Failed to update status: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm('Are you sure you want to cancel this order? This cannot be undone.')) return;

    try {
      const token = localStorage.getItem('authToken');
      if (!token) { alert('Not logged in. Please refresh.'); return; }

      const response = await axios.post(
        `${API_URL}/admin/orders/${orderId}/cancel`,
        {},
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      const updatedOrder = response.data.order || { ...selectedOrder, status: 'cancelled', cancelledAt: new Date().toISOString() };
      const enriched = await enrichItemsWithProductData(updatedOrder);
      setSelectedOrder(enriched);
      await fetchOrders();
      alert('Order cancelled successfully.');
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      alert(`Failed to cancel order: ${error.response?.data?.error || error.message}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':  return '#34C759';
      case 'cancelled':  return '#FF3B30';
      case 'shipped':    return '#5AC8FA';
      case 'processing': return '#FF9500';
      case 'confirmed':  return '#AF52DE';
      case 'pending':    return '#8E8E93';
      default:           return '#8E8E93';
    }
  };

  // Fetch unit/weight/imageUrl from product catalogue for items that don't have them stored
  const enrichItemsWithProductData = async (order: any): Promise<any> => {
    const items: any[] = order.items || [];
    const needsEnrichment = items.some((item) => (!item.unit && !item.weight) || !item.imageUrl);
    if (!needsEnrichment) return order;

    const token = localStorage.getItem('authToken');
    const enriched = await Promise.all(
      items.map(async (item) => {
        if ((item.unit || item.weight) && item.imageUrl) return item;
        try {
          const res = await axios.get(`${API_URL}/products/${item.productId}`, {
            headers: { Authorization: `Bearer ${token}`, 'x-api-key': API_KEY },
          });
          const p = res.data;
          return {
            ...item,
            unit: item.unit || p.unit || '',
            weight: item.weight || p.weight || '',
            imageUrl: item.imageUrl || p.imageUrl || '',
          };
        } catch {
          return item;
        }
      })
    );
    return { ...order, items: enriched };
  };

  const openOrderDetail = async (order: any) => {
    setSelectedOrder(order);
    setEnrichingItems(true);
    try {
      const enriched = await enrichItemsWithProductData(order);
      setSelectedOrder(enriched);
    } finally {
      setEnrichingItems(false);
    }
  };

  const getUnitLabel = (item: any) => {
    const weight = item.weight ? String(item.weight).trim() : '';
    const unit = item.unit ? String(item.unit).trim() : '';
    if (weight && unit) return `${weight}${unit}`;
    if (unit) return unit;
    if (weight) return weight;
    return null;
  };

  const handlePrint = (order: any) => {
    const address = order.shippingAddress || {};
    const shippingDate = order.selectedShippingDate || order.shippingDate;

    const itemsHtml = (order.items || []).map((item: any) => {
      const unitLabel = getUnitLabel(item);
      return `
        <tr>
          <td>
            <div class="item-cell">
              ${item.imageUrl
                ? `<img class="item-thumb" src="${item.imageUrl}" alt="${item.productName || item.name || ''}" />`
                : `<div class="item-thumb item-thumb-placeholder">📦</div>`}
              <div>
                <div class="item-name">${item.productName || item.name || item.productId}</div>
                ${unitLabel ? `<div class="item-meta">${unitLabel}</div>` : ''}
                ${item.sku ? `<div class="item-meta">SKU: ${item.sku}</div>` : ''}
              </div>
            </div>
          </td>
          <td style="text-align:center;">${item.quantity}</td>
          <td style="text-align:right;">SGD ${(item.price || 0).toFixed(2)}</td>
          <td style="text-align:right;font-weight:600;">SGD ${((item.price || 0) * item.quantity).toFixed(2)}</td>
        </tr>`;
    }).join('');

    const displayOrderNumber = order.orderNumber || order.orderId;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Order ${displayOrderNumber}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 32px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; padding-bottom:16px; border-bottom:2px solid #166534; }
  .brand h1 { font-size:20px; color:#166534; margin-bottom:2px; }
  .brand p { font-size:11px; color:#6b7280; }
  .order-title { font-size:14px; font-weight:700; text-align:right; }
  .order-title .order-id { font-family:monospace; font-size:11px; color:#6b7280; margin-top:4px; }
  .status-badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; text-transform:uppercase; color:white; background:${getStatusColor(order.status)}; margin-top:4px; }
  .meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; }
  .meta-box { background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:12px; }
  .meta-box h3 { font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:#6b7280; margin-bottom:8px; }
  .meta-box p { font-size:13px; margin:3px 0; color:#111; }
  .meta-box strong { color:#374151; }
  table { width:100%; border-collapse:collapse; margin-bottom:16px; }
  thead tr { background:#f3f4f6; }
  th { padding:8px 10px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:#6b7280; font-weight:600; }
  td { padding:9px 10px; border-bottom:1px solid #f3f4f6; vertical-align:top; }
  .item-cell { display:flex; align-items:flex-start; gap:10px; }
  .item-thumb { width:42px; height:42px; object-fit:cover; border-radius:4px; border:1px solid #e5e7eb; flex-shrink:0; }
  .item-thumb-placeholder { display:flex; align-items:center; justify-content:center; background:#f3f4f6; font-size:18px; }
  .item-name { font-weight:600; }
  .item-meta { font-size:11px; color:#6b7280; margin-top:2px; }
  .totals { margin-top:8px; }
  .totals .row { display:flex; justify-content:space-between; padding:4px 10px; font-size:13px; }
  .totals .total-row { display:flex; justify-content:space-between; padding:10px 10px; font-size:15px; font-weight:700; border-top:2px solid #166534; color:#166534; }
  .footer { margin-top:24px; padding-top:16px; border-top:1px solid #e5e7eb; font-size:11px; color:#9ca3af; text-align:center; }
  @media print { body { padding:16px; } }
</style></head><body>

  <div class="header">
    <div class="brand">
      <h1>Saaga Biz Pte. Ltd</h1>
      <p>Singapore</p>
    </div>
    <div class="order-title">
      ORDER INVOICE
      <div class="order-id">${displayOrderNumber}</div>
      <div class="status-badge">${order.status.toUpperCase()}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-box">
      <h3>Customer Details</h3>
      <p><strong>${address.fullName || 'N/A'}</strong></p>
      <p>${address.addressLine1 || ''}${address.addressLine2 ? ', ' + address.addressLine2 : ''}</p>
      <p>Singapore ${address.postalCode || ''}</p>
      ${address.phone ? `<p>Phone: ${address.phone}</p>` : ''}
    </div>
    <div class="meta-box">
      <h3>Order Info</h3>
      <p><strong>Order Date:</strong> ${formatDate(order.createdAt, 'dd MMM yyyy, h:mm a')}</p>
      ${shippingDate ? `<p><strong>Delivery Date:</strong> ${formatDate(shippingDate, 'EEEE, dd MMM yyyy')}</p>` : ''}
      <p><strong>Payment:</strong> ${(order.paymentStatus || 'paid').toUpperCase()}</p>
      ${order.couponCode ? `<p><strong>Coupon:</strong> ${order.couponCode}</p>` : ''}
      ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Unit Price</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>

  <div class="totals">
    ${(order.couponDiscount || order.discountAmount) ? `
    <div class="row">
      <span>Subtotal</span>
      <span>SGD ${(order.subtotal || order.totalAmount).toFixed(2)}</span>
    </div>
    <div class="row" style="color:#16a34a;">
      <span>Discount${order.couponCode ? ` (${order.couponCode})` : ''}</span>
      <span>– SGD ${(order.couponDiscount || order.discountAmount || 0).toFixed(2)}</span>
    </div>` : ''}
    <div class="total-row">
      <span>Total</span>
      <span>SGD ${(order.totalAmount || 0).toFixed(2)}</span>
    </div>
  </div>

  ${order.cancelledAt ? `<p style="margin-top:16px;padding:10px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;color:#dc2626;font-size:12px;">
    Cancelled on ${formatDate(order.cancelledAt, 'dd MMM yyyy, h:mm a')}
  </p>` : ''}

  <div class="footer">
    Generated on ${format(new Date(), 'dd MMM yyyy, h:mm a')} &bull; customercare@saagaonline.com
  </div>

</body></html>`;

    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) { alert('Pop-up blocked. Please allow pop-ups and try again.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  // Compact, label-sized slip (4x6" — standard shipping label size) meant to be
  // printed and physically stuck on the package. Uses raw order data only
  // (no product enrichment needed) so it can be printed straight from the table row.
  const handlePrintPackingSlip = (order: any) => {
    const address = order.shippingAddress || {};
    const shippingDate = order.selectedShippingDate || order.shippingDate;
    const displayOrderNumber = order.orderNumber || order.orderId;
    const items: any[] = order.items || [];
    const totalItems = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

    const itemsHtml = items.map((item: any) => {
      const unitLabel = getUnitLabel(item);
      return `
        <tr>
          <td class="qty-col">${item.quantity}×</td>
          <td>
            ${item.productName || item.name || item.productId}
            ${unitLabel ? `<span class="item-unit">(${unitLabel})</span>` : ''}
          </td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Packing Slip ${displayOrderNumber}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: 4in 6in; margin: 0.14in; }
  body { font-family: Arial, sans-serif; color:#111; }
  .slip { padding: 6px; }
  .brand { text-align:center; margin-bottom:8px; }
  .brand h1 { font-size:15px; color:#166534; }
  .brand p { font-size:9px; color:#6b7280; }
  .divider { border-top:2px solid #166534; margin:6px 0 10px; }
  .ship-to-label { font-size:9px; text-transform:uppercase; letter-spacing:.08em; color:#6b7280; font-weight:700; margin-bottom:4px; }
  .ship-to { border:2px solid #111; border-radius:6px; padding:10px 12px; margin-bottom:10px; }
  .ship-to .name { font-size:18px; font-weight:800; margin-bottom:4px; }
  .ship-to .addr-line { font-size:14px; line-height:1.35; }
  .ship-to .phone { font-size:13px; margin-top:5px; color:#374151; }
  .order-meta { display:flex; justify-content:space-between; align-items:center; font-size:11px; margin-bottom:8px; padding:6px 8px; background:#f3f4f6; border-radius:4px; }
  .order-meta .num { font-family:monospace; font-weight:700; font-size:13px; }
  table { width:100%; border-collapse:collapse; margin-top:4px; }
  th { text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:.05em; color:#6b7280; padding:3px 4px; border-bottom:1px solid #d1d5db; }
  td { font-size:12px; padding:4px; border-bottom:1px dashed #e5e7eb; vertical-align:top; }
  .qty-col { font-weight:700; width:34px; }
  .item-unit { color:#6b7280; font-size:10px; }
  .footer-row { display:flex; justify-content:space-between; margin-top:10px; padding-top:8px; border-top:2px solid #166534; font-size:11px; font-weight:700; }
  .notes { margin-top:8px; font-size:10px; color:#6b7280; font-style:italic; }
  @media print { body { padding:0; } }
</style></head><body>
  <div class="slip">
    <div class="brand">
      <h1>Saaga Biz Pte. Ltd</h1>
      <p>Indian Groceries, Singapore &bull; customercare@saagaonline.com</p>
    </div>
    <div class="divider"></div>

    <div class="order-meta">
      <span>PACKING SLIP</span>
      <span class="num">${displayOrderNumber}</span>
    </div>

    <div class="ship-to-label">Ship To</div>
    <div class="ship-to">
      <div class="name">${address.fullName || 'N/A'}</div>
      <div class="addr-line">${address.addressLine1 || ''}${address.addressLine2 ? ', ' + address.addressLine2 : ''}</div>
      <div class="addr-line">Singapore ${address.postalCode || ''}</div>
      ${address.phone ? `<div class="phone">Tel: ${address.phone}</div>` : ''}
    </div>

    <table>
      <thead><tr><th colspan="2">Items${shippingDate ? ` &bull; Deliver ${formatDate(shippingDate, 'dd MMM')}` : ''}</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div class="footer-row">
      <span>Total Items</span>
      <span>${totalItems}</span>
    </div>

    ${order.notes ? `<div class="notes">Note: ${order.notes}</div>` : ''}
  </div>
</body></html>`;

    const win = window.open('', '_blank', 'width=500,height=700');
    if (!win) { alert('Pop-up blocked. Please allow pop-ups and try again.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  const filteredOrders = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="orders-page">
      <div className="page-header">
        <h1 className="page-title">Orders Management</h1>
        <div className="filters">
          {['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((f) => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="orders-table-container">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                  {filter === 'all' ? 'No orders found.' : `No ${filter} orders found.`}
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr key={order.orderId}>
                  <td className="order-id">{order.orderNumber || `${order.orderId.slice(0, 8)}…`}</td>
                  <td>{formatDate(order.createdAt, 'MMM dd, yyyy')}</td>
                  <td>{order.shippingAddress?.fullName || 'N/A'}</td>
                  <td>{order.items?.length || 0} items</td>
                  <td className="order-total">SGD {(order.totalAmount || 0).toFixed(2)}</td>
                  <td>
                    <span className="status-badge" style={{ background: getStatusColor(order.status) }}>
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="view-btn" onClick={() => openOrderDetail(order)}>
                        View Details
                      </button>
                      <button className="print-btn" onClick={() => handlePrintPackingSlip(order)} title="Print packing slip">
                        📦 Slip
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Order Details</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {enrichingItems && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading details…</span>}
                <button className="print-btn" onClick={() => handlePrintPackingSlip(selectedOrder)}>📦 Packing Slip</button>
                <button className="print-btn" onClick={() => handlePrint(selectedOrder)} disabled={enrichingItems}>🖨 Print Invoice</button>
                <button className="close-btn" onClick={() => setSelectedOrder(null)}>×</button>
              </div>
            </div>

            <div className="modal-body">
              <div className="order-section">
                <h3>Order Information</h3>
                <p><strong>Order Number:</strong> <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{selectedOrder.orderNumber || selectedOrder.orderId}</span></p>
                <p><strong>Date:</strong> {formatDate(selectedOrder.createdAt, 'PPpp')}</p>
                <p><strong>Status:</strong> <span style={{ color: getStatusColor(selectedOrder.status), fontWeight: 'bold' }}>{selectedOrder.status.toUpperCase()}</span></p>
                <p><strong>Payment Status:</strong> {selectedOrder.paymentStatus || 'N/A'}</p>
                {selectedOrder.notes && <p><strong>Notes:</strong> {selectedOrder.notes}</p>}
                {selectedOrder.cancelledAt && (
                  <p><strong>Cancelled At:</strong> {formatDate(selectedOrder.cancelledAt, 'PPpp')}</p>
                )}
              </div>

              <div className="order-section">
                <h3>Customer Details</h3>
                {selectedOrder.shippingAddress ? (
                  <>
                    <p><strong>Name:</strong> {selectedOrder.shippingAddress.fullName || 'N/A'}</p>
                    <p><strong>Address:</strong> {selectedOrder.shippingAddress.addressLine1 || 'N/A'}</p>
                    {selectedOrder.shippingAddress.addressLine2 && (
                      <p><strong></strong> {selectedOrder.shippingAddress.addressLine2}</p>
                    )}
                    <p><strong>Postal Code:</strong> {selectedOrder.shippingAddress.postalCode || 'N/A'}</p>
                    <p><strong>Phone:</strong> {selectedOrder.shippingAddress.phone || 'N/A'}</p>
                  </>
                ) : (
                  <p>No shipping address available</p>
                )}
              </div>

              {(selectedOrder.selectedShippingDate || selectedOrder.shippingDate) && (
                <div className="order-section">
                  <h3>Delivery Date</h3>
                  <p><strong>Scheduled:</strong> {formatDate(selectedOrder.selectedShippingDate || selectedOrder.shippingDate, 'EEEE, dd MMM yyyy')}</p>
                </div>
              )}

              <div className="order-section">
                <h3>Order Items ({selectedOrder.items?.length || 0})</h3>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  <>
                    {selectedOrder.items.map((item: any, index: number) => {
                      const unitLabel = getUnitLabel(item);
                      return (
                        <div key={index} className="order-item-detail">
                          <div className="order-item-image">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.productName || item.name} />
                            ) : (
                              <div className="order-item-image-placeholder">📦</div>
                            )}
                          </div>
                          <div className="order-item-info">
                            <div className="order-item-name">{item.productName || item.name || item.productId}</div>
                            {unitLabel && (
                              <div className="order-item-unit">{unitLabel}</div>
                            )}
                            {item.sku && <div className="order-item-meta">SKU: {item.sku}</div>}
                            {item.category && <div className="order-item-meta">{item.category}</div>}
                          </div>
                          <div className="order-item-qty">×{item.quantity}</div>
                          <div className="order-item-price">SGD {((item.price || 0) * item.quantity).toFixed(2)}</div>
                        </div>
                      );
                    })}
                    {(selectedOrder.couponDiscount > 0 || selectedOrder.discountAmount > 0) && (
                      <div className="order-discount-row">
                        <span>Coupon Discount{selectedOrder.couponCode ? ` (${selectedOrder.couponCode})` : ''}</span>
                        <span>– SGD {(selectedOrder.couponDiscount || selectedOrder.discountAmount || 0).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="order-total-row">
                      <strong>Total</strong>
                      <strong>SGD {(selectedOrder.totalAmount || 0).toFixed(2)}</strong>
                    </div>
                  </>
                ) : (
                  <p>No items in this order</p>
                )}
              </div>

              {/* Status update section */}
              {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' ? (
                <div className="order-section">
                  <h3>Update Status</h3>
                  <div className="status-buttons">
                    {['pending', 'confirmed', 'processing', 'shipped', 'delivered'].map((status) => (
                      <button
                        key={status}
                        className={`status-update-btn ${selectedOrder.status === status ? 'current' : ''}`}
                        onClick={() => handleUpdateStatus(selectedOrder.orderId, status)}
                        disabled={selectedOrder.status === status}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                    <button
                      className="cancel-order-btn"
                      onClick={() => handleCancelOrder(selectedOrder.orderId)}
                    >
                      Cancel Order
                    </button>
                  </div>
                </div>
              ) : (
                <div className="order-section">
                  {selectedOrder.status === 'cancelled' ? (
                    <div className="cancelled-notice">
                      <strong>This order has been cancelled and cannot be modified.</strong>
                    </div>
                  ) : (
                    <div className="delivered-notice">
                      <strong>This order has been delivered.</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
