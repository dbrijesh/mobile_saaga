import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import './Orders.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://your-api-gateway-url.execute-api.ap-southeast-1.amazonaws.com/dev';

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // Safe date formatter
  const formatDate = (dateString: string, formatString: string) => {
    try {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return format(date, formatString);
    } catch (error) {
      console.error('Error formatting date:', error);
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
        console.error('No auth token found');
        setOrders([]);
        return;
      }

      const response = await axios.get(`${API_URL}/admin/orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      setOrders(response.data.orders || []);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      console.error('Error details:', error.response?.data);

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
      if (!token) {
        alert('You are not logged in. Please refresh and login again.');
        return;
      }

      const response = await axios.put(
        `${API_URL}/orders/${orderId}/status`,
        { status: newStatus },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Update the selected order with the new status immediately
      if (selectedOrder && response.data.order) {
        setSelectedOrder(response.data.order);
      } else {
        // Fallback: update status locally
        setSelectedOrder({
          ...selectedOrder!,
          status: newStatus,
          updatedAt: new Date().toISOString()
        });
      }

      // Refresh the orders list in the background
      await fetchOrders();

      alert('Order status updated successfully!');
    } catch (error: any) {
      console.error('Error updating order status:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to update order status';
      alert(`Failed to update order status: ${errorMsg}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return '#34C759';
      case 'cancelled':
        return '#FF3B30';
      case 'shipped':
        return '#5AC8FA';
      case 'processing':
        return '#FF9500';
      default:
        return '#8E8E93';
    }
  };

  const filteredOrders = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="orders-page">
      <div className="page-header">
        <h1 className="page-title">Orders Management</h1>
        <div className="filters">
          {['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((f) => (
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
              <th>Order ID</th>
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
                  <td className="order-id">{order.orderId}</td>
                  <td>{formatDate(order.createdAt, 'MMM dd, yyyy')}</td>
                  <td>{order.shippingAddress?.fullName || 'N/A'}</td>
                  <td>{order.items?.length || 0} items</td>
                  <td className="order-total">SGD {(order.totalAmount || 0).toFixed(2)}</td>
                  <td>
                    <span
                      className="status-badge"
                      style={{ background: getStatusColor(order.status) }}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="view-btn"
                      onClick={() => setSelectedOrder(order)}
                    >
                      View Details
                    </button>
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
              <button className="close-btn" onClick={() => setSelectedOrder(null)}>×</button>
            </div>

            <div className="modal-body">
              <div className="order-section">
                <h3>Order Information</h3>
                <p><strong>Order ID:</strong> {selectedOrder.orderId}</p>
                <p><strong>Date:</strong> {formatDate(selectedOrder.createdAt, 'PPpp')}</p>
                <p><strong>Status:</strong> <span style={{ color: getStatusColor(selectedOrder.status), fontWeight: 'bold' }}>{selectedOrder.status.toUpperCase()}</span></p>
                <p><strong>Payment Status:</strong> {selectedOrder.paymentStatus || 'N/A'}</p>
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
                    <p><strong>City:</strong> {selectedOrder.shippingAddress.city || 'N/A'}</p>
                    <p><strong>Postal Code:</strong> {selectedOrder.shippingAddress.postalCode || 'N/A'}</p>
                    <p><strong>Phone:</strong> {selectedOrder.shippingAddress.phone || 'N/A'}</p>
                  </>
                ) : (
                  <p>No shipping address available</p>
                )}
              </div>

              <div className="order-section">
                <h3>Order Items</h3>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  <>
                    {selectedOrder.items.map((item: any, index: number) => (
                      <div key={index} className="order-item">
                        <span>{item.quantity}x {item.name || item.productId}</span>
                        <span>SGD {((item.price || 0) * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="order-total-row">
                      <strong>Total:</strong>
                      <strong>SGD {(selectedOrder.totalAmount || 0).toFixed(2)}</strong>
                    </div>
                  </>
                ) : (
                  <p>No items in this order</p>
                )}
              </div>

              {selectedOrder.status !== 'cancelled' && (
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
                </div>
              )}
              {selectedOrder.status === 'cancelled' && (
                <div className="order-section">
                  <div style={{ padding: '12px', background: '#FFF3CD', border: '1px solid #FFC107', borderRadius: '8px', color: '#856404' }}>
                    <strong>⚠️ This order has been cancelled and cannot be modified.</strong>
                  </div>
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
