import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Coupons.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev';

interface Coupon {
  couponId: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  expiryDate?: string;
  usageLimit?: number;
  usageCount: number;
  perCustomerLimit?: number | null;
  autoApply?: boolean;
  status: 'active' | 'inactive' | 'deleted';
  description?: string;
  createdAt: string;
  updatedAt: string;
}

const Coupons: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [saveError, setSaveError] = useState<string>('');
  const [isAddMode, setIsAddMode] = useState(false);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API_URL}/admin/coupons`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      setCoupons(response.data.coupons || []);
    } catch (error) {
      console.error('Error fetching coupons:', error);
      alert('Error loading coupons. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingCoupon({
      couponId: '',
      code: '',
      discountType: 'percentage',
      discountValue: 0,
      minPurchaseAmount: 0,
      maxDiscountAmount: undefined,
      expiryDate: '',
      usageLimit: undefined,
      usageCount: 0,
      perCustomerLimit: undefined,
      autoApply: false,
      status: 'active',
      description: '',
      createdAt: '',
      updatedAt: '',
    });
    setIsAddMode(true);
    setSaveError('');
    setIsModalOpen(true);
  };

  const handleEditClick = (coupon: Coupon) => {
    setEditingCoupon({ ...coupon });
    setIsAddMode(false);
    setSaveError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCoupon(null);
    setSaveError('');
    setIsAddMode(false);
  };

  const handleSaveCoupon = async () => {
    if (!editingCoupon) return;

    if (!editingCoupon.code.trim()) {
      setSaveError('Coupon code is required');
      return;
    }

    if (editingCoupon.discountValue <= 0) {
      setSaveError('Discount value must be greater than 0');
      return;
    }

    if (editingCoupon.discountType === 'percentage' && editingCoupon.discountValue > 100) {
      setSaveError('Percentage discount cannot exceed 100%');
      return;
    }

    setSaveError('');

    try {
      const token = localStorage.getItem('authToken');

      if (!token) {
        setSaveError('You are not logged in. Please refresh the page and login again.');
        return;
      }

      const couponData = {
        code: editingCoupon.code.toUpperCase().trim(),
        discountType: editingCoupon.discountType,
        discountValue: parseFloat(editingCoupon.discountValue.toString()),
        minPurchaseAmount: editingCoupon.minPurchaseAmount || 0,
        maxDiscountAmount: editingCoupon.maxDiscountAmount || null,
        expiryDate: editingCoupon.expiryDate || null,
        usageLimit: editingCoupon.usageLimit || null,
        perCustomerLimit: editingCoupon.perCustomerLimit || null,
        autoApply: !!editingCoupon.autoApply,
        description: editingCoupon.description?.trim() || '',
      };

      if (isAddMode) {
        await axios.post(
          `${API_URL}/admin/coupons`,
          couponData,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        alert('Coupon created successfully!');
      } else {
        await axios.put(
          `${API_URL}/admin/coupons/${editingCoupon.couponId}`,
          {
            description: couponData.description,
            status: editingCoupon.status,
            expiryDate: couponData.expiryDate,
            usageLimit: couponData.usageLimit,
            minPurchaseAmount: couponData.minPurchaseAmount,
            maxDiscountAmount: couponData.maxDiscountAmount,
            perCustomerLimit: couponData.perCustomerLimit,
            autoApply: couponData.autoApply,
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        alert('Coupon updated successfully!');
      }

      fetchCoupons();
      handleCloseModal();
    } catch (error: any) {
      console.error('Error saving coupon:', error);

      let errorMessage = isAddMode ? 'Failed to create coupon. ' : 'Failed to update coupon. ';

      if (error.response?.status === 401 || error.response?.status === 403) {
        errorMessage += 'Your session may have expired. Please logout and login again.';
      } else if (error.response?.data?.error) {
        errorMessage += error.response.data.error;
      } else {
        errorMessage += error.message;
      }

      setSaveError(errorMessage);
    }
  };

  const handleDeleteCoupon = async (coupon: Coupon) => {
    if (!confirm(`Are you sure you want to delete coupon "${coupon.code}"? This cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');

      if (!token) {
        alert('You are not logged in. Please refresh the page and login again.');
        return;
      }

      await axios.delete(
        `${API_URL}/admin/coupons/${coupon.couponId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      alert('Coupon deleted successfully!');
      fetchCoupons();
    } catch (error: any) {
      console.error('Error deleting coupon:', error);

      let errorMessage = 'Failed to delete coupon. ';
      if (error.response?.data?.error) {
        errorMessage += error.response.data.error;
      } else {
        errorMessage += error.message;
      }

      alert(errorMessage);
    }
  };

  const handleEnableCoupon = async (coupon: Coupon) => {
    const isPromo = coupon.autoApply && coupon.usageLimit;
    const confirmMessage = isPromo
      ? `Enable "${coupon.code}"? This resets its usage counter to 0/${coupon.usageLimit}, so the next ${coupon.usageLimit} qualifying orders from now can redeem it.`
      : `Enable "${coupon.code}"? This resets its usage counter to 0.`;

    if (!confirm(confirmMessage)) return;

    try {
      const token = localStorage.getItem('authToken');
      await axios.put(
        `${API_URL}/admin/coupons/${coupon.couponId}/enable`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      alert('Coupon enabled and usage counter reset.');
      fetchCoupons();
    } catch (error: any) {
      console.error('Error enabling coupon:', error);
      alert('Failed to enable coupon. ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDisableCoupon = async (coupon: Coupon) => {
    if (!confirm(`Disable "${coupon.code}"? Customers will no longer be able to redeem it.`)) return;

    try {
      const token = localStorage.getItem('authToken');
      await axios.put(
        `${API_URL}/admin/coupons/${coupon.couponId}/disable`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      alert('Coupon disabled.');
      fetchCoupons();
    } catch (error: any) {
      console.error('Error disabling coupon:', error);
      alert('Failed to disable coupon. ' + (error.response?.data?.error || error.message));
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active': return 'status-active';
      case 'inactive': return 'status-inactive';
      case 'deleted': return 'status-deleted';
      default: return '';
    }
  };

  if (loading) {
    return <div className="loading">Loading coupons...</div>;
  }

  return (
    <div className="coupons-page">
      <div className="page-header">
        <h1 className="page-title">Coupon Management</h1>
        <button className="add-btn" onClick={handleAddClick}>
          ➕ Add New Coupon
        </button>
      </div>

      <div className="coupons-table-container">
        <table className="coupons-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Discount</th>
              <th>Min Purchase</th>
              <th>Usage</th>
              <th>Per Customer</th>
              <th>Expiry Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.filter(c => c.status !== 'deleted').map((coupon) => (
              <tr key={coupon.couponId}>
                <td className="coupon-code">
                  {coupon.code}
                  {coupon.autoApply && <span className="auto-apply-badge">AUTO</span>}
                </td>
                <td>{coupon.discountType === 'percentage' ? 'Percentage' : 'Fixed Amount'}</td>
                <td className="discount-value">
                  {coupon.discountType === 'percentage'
                    ? `${coupon.discountValue}%`
                    : `SGD ${coupon.discountValue.toFixed(2)}`}
                </td>
                <td>
                  {coupon.minPurchaseAmount
                    ? `SGD ${coupon.minPurchaseAmount.toFixed(2)}`
                    : '-'}
                </td>
                <td>
                  {coupon.usageLimit
                    ? `${coupon.usageCount}/${coupon.usageLimit}`
                    : `${coupon.usageCount}/∞`}
                </td>
                <td>{coupon.perCustomerLimit || '-'}</td>
                <td>{coupon.expiryDate || 'No expiry'}</td>
                <td>
                  <span className={`status-badge ${getStatusBadgeClass(coupon.status)}`}>
                    {coupon.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="edit-btn" onClick={() => handleEditClick(coupon)}>
                      Edit
                    </button>
                    {coupon.status === 'active' ? (
                      <button className="delete-btn" onClick={() => handleDisableCoupon(coupon)}>
                        Disable
                      </button>
                    ) : (
                      <button className="edit-btn" onClick={() => handleEnableCoupon(coupon)}>
                        Enable
                      </button>
                    )}
                    <button className="delete-btn" onClick={() => handleDeleteCoupon(coupon)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {coupons.filter(c => c.status !== 'deleted').length === 0 && (
          <div className="empty-state">
            <p>No coupons found. Create your first coupon!</p>
          </div>
        )}
      </div>

      {isModalOpen && editingCoupon && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isAddMode ? 'Add New Coupon' : 'Edit Coupon'}</h2>
              <button className="close-btn" onClick={handleCloseModal}>×</button>
            </div>

            <div className="modal-body">
              {saveError && (
                <div className="error-message">
                  <strong>Error:</strong> {saveError}
                </div>
              )}

              <div className="form-row">
                <label>Coupon Code *</label>
                <input
                  type="text"
                  value={editingCoupon.code}
                  onChange={(e) => setEditingCoupon({ ...editingCoupon, code: e.target.value.toUpperCase() })}
                  placeholder="SAVE10"
                  disabled={!isAddMode}
                  className={!isAddMode ? 'disabled-input' : ''}
                  maxLength={20}
                />
                <p className="help-text">Code will be converted to uppercase</p>
              </div>

              <div className="form-row">
                <label>Discount Type *</label>
                <select
                  value={editingCoupon.discountType}
                  onChange={(e) => setEditingCoupon({ ...editingCoupon, discountType: e.target.value as 'percentage' | 'fixed' })}
                  disabled={!isAddMode}
                  className={!isAddMode ? 'disabled-input' : ''}
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount (SGD)</option>
                </select>
              </div>

              <div className="form-row">
                <label>Discount Value *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={editingCoupon.discountType === 'percentage' ? 100 : undefined}
                  value={editingCoupon.discountValue}
                  onChange={(e) => setEditingCoupon({ ...editingCoupon, discountValue: parseFloat(e.target.value) || 0 })}
                  placeholder="10"
                  disabled={!isAddMode}
                  className={!isAddMode ? 'disabled-input' : ''}
                />
                <p className="help-text">
                  {editingCoupon.discountType === 'percentage' ? 'Enter percentage (0-100)' : 'Enter amount in SGD'}
                </p>
              </div>

              <div className="form-row-group">
                <div className="form-row">
                  <label>Min Purchase Amount (SGD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingCoupon.minPurchaseAmount || 0}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, minPurchaseAmount: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>

                <div className="form-row">
                  <label>Max Discount Amount (SGD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingCoupon.maxDiscountAmount || ''}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, maxDiscountAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="form-row-group">
                <div className="form-row">
                  <label>Expiry Date</label>
                  <input
                    type="date"
                    value={editingCoupon.expiryDate || ''}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, expiryDate: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <label>Usage Limit</label>
                  <input
                    type="number"
                    min="0"
                    value={editingCoupon.usageLimit || ''}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, usageLimit: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="Unlimited"
                  />
                  <p className="help-text">Total redemptions allowed across all customers (e.g. 100)</p>
                </div>
              </div>

              <div className="form-row-group">
                <div className="form-row">
                  <label>Limit Per Customer</label>
                  <input
                    type="number"
                    min="0"
                    value={editingCoupon.perCustomerLimit || ''}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, perCustomerLimit: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="Unlimited"
                  />
                  <p className="help-text">Max redemptions per customer (e.g. 1 = one order per customer)</p>
                </div>

                <div className="form-row">
                  <label>Auto-Apply</label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={!!editingCoupon.autoApply}
                      onChange={(e) => setEditingCoupon({ ...editingCoupon, autoApply: e.target.checked })}
                    />
                    <span>Show as a promotion in the app (no code required)</span>
                  </label>
                </div>
              </div>

              {!isAddMode && (
                <div className="form-row">
                  <label>Status</label>
                  <select
                    value={editingCoupon.status}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, status: e.target.value as 'active' | 'inactive' })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}

              <div className="form-row">
                <label>Description</label>
                <textarea
                  value={editingCoupon.description || ''}
                  onChange={(e) => setEditingCoupon({ ...editingCoupon, description: e.target.value })}
                  placeholder="Enter coupon description (optional)"
                  rows={3}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={handleCloseModal}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleSaveCoupon}>
                {isAddMode ? 'Create Coupon' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Coupons;
