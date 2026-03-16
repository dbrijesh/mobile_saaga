import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './ShippingDates.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev';

interface ShippingDate {
  shippingDateId: string;
  date: string;
  orderWindowCloseDate?: string;
  capacity: number;
  currentOrders: number;
  status: 'active' | 'full' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const ShippingDates: React.FC = () => {
  const [shippingDates, setShippingDates] = useState<ShippingDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDate, setEditingDate] = useState<ShippingDate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saveError, setSaveError] = useState<string>('');
  const [isAddMode, setIsAddMode] = useState(false);

  useEffect(() => {
    fetchShippingDates();
  }, []);

  const fetchShippingDates = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API_URL}/admin/shipping-dates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShippingDates(response.data.dates || []);
    } catch (error) {
      console.error('Error fetching shipping dates:', error);
      alert('Error loading shipping dates. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const today = new Date().toISOString().split('T')[0];

    setEditingDate({
      shippingDateId: '',
      date: tomorrowStr,
      orderWindowCloseDate: today,
      capacity: 50,
      currentOrders: 0,
      status: 'active',
      notes: '',
      createdAt: '',
      updatedAt: '',
    });
    setIsAddMode(true);
    setSaveError('');
    setIsModalOpen(true);
  };

  const handleEditClick = (shippingDate: ShippingDate) => {
    setEditingDate({ ...shippingDate });
    setIsAddMode(false);
    setSaveError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDate(null);
    setSaveError('');
    setIsAddMode(false);
  };

  const handleSaveDate = async () => {
    if (!editingDate) return;

    try {
      const token = localStorage.getItem('authToken');

      if (isAddMode) {
        await axios.post(
          `${API_URL}/admin/shipping-dates`,
          {
            date: editingDate.date,
            orderWindowCloseDate: editingDate.orderWindowCloseDate || null,
            capacity: editingDate.capacity,
            notes: editingDate.notes || '',
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.put(
          `${API_URL}/admin/shipping-dates/${editingDate.shippingDateId}`,
          {
            date: editingDate.date,
            orderWindowCloseDate: editingDate.orderWindowCloseDate || null,
            capacity: editingDate.capacity,
            status: editingDate.status,
            notes: editingDate.notes || '',
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      await fetchShippingDates();
      handleCloseModal();
    } catch (error: any) {
      console.error('Error saving shipping date:', error);
      setSaveError(error.response?.data?.error || 'Failed to save shipping date');
    }
  };

  const handleDeleteDate = async (shippingDateId: string) => {
    if (!confirm('Are you sure you want to cancel this shipping date?')) return;

    try {
      const token = localStorage.getItem('authToken');
      await axios.delete(`${API_URL}/admin/shipping-dates/${shippingDateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchShippingDates();
    } catch (error) {
      console.error('Error deleting shipping date:', error);
      alert('Failed to delete shipping date');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'status-badge status-active';
      case 'full':
        return 'status-badge status-full';
      case 'cancelled':
        return 'status-badge status-cancelled';
      default:
        return 'status-badge';
    }
  };

  if (loading) {
    return <div className="loading">Loading shipping dates...</div>;
  }

  return (
    <div className="shipping-dates">
      <div className="page-header">
        <h1 className="page-title">Shipping Dates Management</h1>
        <button className="btn-primary" onClick={handleAddClick}>
          + Add Shipping Date
        </button>
      </div>

      <div className="shipping-dates-table">
        <table>
          <thead>
            <tr>
              <th>Delivery Date</th>
              <th>Order Window Closes</th>
              <th>Capacity</th>
              <th>Current Orders</th>
              <th>Status</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {shippingDates.length === 0 ? (
              <tr>
                <td colSpan={7} className="no-data">No shipping dates configured</td>
              </tr>
            ) : (
              shippingDates.map((date) => (
                <tr key={date.shippingDateId}>
                  <td>{new Date(date.date).toLocaleDateString()}</td>
                  <td>
                    {date.orderWindowCloseDate ? (
                      <span style={{ color: new Date(date.orderWindowCloseDate) < new Date() ? '#FF3B30' : '#007AFF' }}>
                        {new Date(date.orderWindowCloseDate).toLocaleDateString()}
                      </span>
                    ) : (
                      <span style={{ color: '#8E8E93' }}>No restriction</span>
                    )}
                  </td>
                  <td>{date.capacity}</td>
                  <td>
                    {date.currentOrders} ({Math.round((date.currentOrders / date.capacity) * 100)}%)
                  </td>
                  <td>
                    <span className={getStatusBadgeClass(date.status)}>
                      {date.status.toUpperCase()}
                    </span>
                  </td>
                  <td>{date.notes || '-'}</td>
                  <td className="actions">
                    <button
                      className="btn-edit"
                      onClick={() => handleEditClick(date)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteDate(date.shippingDateId)}
                      disabled={date.status === 'cancelled'}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && editingDate && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{isAddMode ? 'Add Shipping Date' : 'Edit Shipping Date'}</h2>
            {saveError && <div className="error-message">{saveError}</div>}

            <div className="form-group">
              <label>Delivery Date</label>
              <input
                type="date"
                value={editingDate.date}
                onChange={(e) =>
                  setEditingDate({ ...editingDate, date: e.target.value })
                }
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="form-group">
              <label>Order Window Close Date (Optional)</label>
              <input
                type="date"
                value={editingDate.orderWindowCloseDate || ''}
                onChange={(e) =>
                  setEditingDate({ ...editingDate, orderWindowCloseDate: e.target.value })
                }
                max={editingDate.date}
              />
              <small className="help-text">
                Last date customers can place orders for this delivery date. Leave empty for no restriction.
              </small>
            </div>

            <div className="form-group">
              <label>Capacity</label>
              <input
                type="number"
                value={editingDate.capacity}
                onChange={(e) =>
                  setEditingDate({ ...editingDate, capacity: parseInt(e.target.value) || 0 })
                }
                min="1"
              />
            </div>

            {!isAddMode && (
              <div className="form-group">
                <label>Status</label>
                <select
                  value={editingDate.status}
                  onChange={(e) =>
                    setEditingDate({ ...editingDate, status: e.target.value as any })
                  }
                >
                  <option value="active">Active</option>
                  <option value="full">Full</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Notes (Optional)</label>
              <textarea
                value={editingDate.notes || ''}
                onChange={(e) =>
                  setEditingDate({ ...editingDate, notes: e.target.value })
                }
                rows={3}
                placeholder="Internal notes about this shipping date..."
              />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={handleCloseModal}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveDate}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShippingDates;
