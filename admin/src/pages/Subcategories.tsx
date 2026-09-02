import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Subcategories.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev';

interface SubCategory {
  id: string;
  name: string;
  parentCategoryName: string;
  description?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  id: string;
  name: string;
}

const Subcategories: React.FC = () => {
  const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubCategory, setEditingSubCategory] = useState<SubCategory | null>(null);
  const [saveError, setSaveError] = useState<string>('');
  const [isAddMode, setIsAddMode] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    fetchSubcategories();
    fetchCategories();
  }, []);

  const fetchSubcategories = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API_URL}/admin/subcategories`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      setSubcategories(response.data.subcategories || []);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
      alert('Error loading subcategories. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_URL}/categories`);
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleAddClick = () => {
    setEditingSubCategory({
      id: '',
      name: '',
      parentCategoryName: categories[0]?.name || '',
      description: '',
      icon: '📂',
      createdAt: '',
      updatedAt: '',
    });
    setIsAddMode(true);
    setSaveError('');
    setIsModalOpen(true);
  };

  const handleEditClick = (subcategory: SubCategory) => {
    setEditingSubCategory({ ...subcategory });
    setIsAddMode(false);
    setSaveError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSubCategory(null);
    setSaveError('');
    setIsAddMode(false);
  };

  const handleSaveSubCategory = async () => {
    if (!editingSubCategory) return;

    if (!editingSubCategory.name.trim()) {
      setSaveError('Subcategory name is required');
      return;
    }

    if (!editingSubCategory.parentCategoryName) {
      setSaveError('Parent category is required');
      return;
    }

    setSaveError('');

    try {
      const token = localStorage.getItem('authToken');

      if (!token) {
        setSaveError('You are not logged in. Please refresh the page and login again.');
        return;
      }

      const subcategoryData = {
        name: editingSubCategory.name.trim(),
        parentCategoryName: editingSubCategory.parentCategoryName,
        description: editingSubCategory.description?.trim() || '',
        icon: editingSubCategory.icon || '📂',
      };

      if (isAddMode) {
        await axios.post(
          `${API_URL}/admin/subcategories`,
          subcategoryData,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        alert('Subcategory created successfully!');
      } else {
        await axios.put(
          `${API_URL}/admin/subcategories/${editingSubCategory.id}`,
          subcategoryData,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        alert('Subcategory updated successfully!');
      }

      fetchSubcategories();
      handleCloseModal();
    } catch (error: any) {
      console.error('Error saving subcategory:', error);

      let errorMessage = isAddMode ? 'Failed to create subcategory. ' : 'Failed to update subcategory. ';

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

  const handleDeleteSubCategory = async (subcategory: SubCategory) => {
    if (!confirm(`Are you sure you want to delete "${subcategory.name}"? This will remove the subcategory from all associated products.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');

      if (!token) {
        alert('You are not logged in. Please refresh the page and login again.');
        return;
      }

      await axios.delete(
        `${API_URL}/admin/subcategories/${subcategory.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      alert('Subcategory deleted successfully!');
      fetchSubcategories();
    } catch (error: any) {
      console.error('Error deleting subcategory:', error);

      let errorMessage = 'Failed to delete subcategory. ';
      if (error.response?.data?.details) {
        errorMessage = error.response.data.details;
      } else if (error.response?.data?.error) {
        errorMessage += error.response.data.error;
      } else {
        errorMessage += error.message;
      }

      alert(errorMessage);
    }
  };

  const filteredSubcategories = categoryFilter === 'all'
    ? subcategories
    : subcategories.filter(sc => sc.parentCategoryName === categoryFilter);

  if (loading) {
    return <div className="loading">Loading subcategories...</div>;
  }

  return (
    <div className="subcategories-page">
      <div className="page-header">
        <h1 className="page-title">Subcategory Management</h1>
        <button className="add-btn" onClick={handleAddClick}>
          ➕ Add New Subcategory
        </button>
      </div>

      <div className="toolbar">
        <select
          className="category-filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.name}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div className="subcategories-grid">
        {filteredSubcategories.map((subcategory) => (
          <div key={subcategory.id} className="subcategory-card">
            <div className="subcategory-icon">{subcategory.icon || '📂'}</div>
            <div className="subcategory-info">
              <h3 className="subcategory-name">{subcategory.name}</h3>
              <p className="parent-category">Category: {subcategory.parentCategoryName}</p>
              <p className="subcategory-description">{subcategory.description || 'No description'}</p>
            </div>
            <div className="subcategory-actions">
              <button className="edit-btn" onClick={() => handleEditClick(subcategory)}>
                Edit
              </button>
              <button className="delete-btn" onClick={() => handleDeleteSubCategory(subcategory)}>
                Delete
              </button>
            </div>
          </div>
        ))}

        {filteredSubcategories.length === 0 && (
          <div className="empty-state">
            <p>No subcategories found. Create your first subcategory!</p>
          </div>
        )}
      </div>

      {isModalOpen && editingSubCategory && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isAddMode ? 'Add New Subcategory' : 'Edit Subcategory'}</h2>
              <button className="close-btn" onClick={handleCloseModal}>×</button>
            </div>

            <div className="modal-body">
              {saveError && (
                <div className="error-message">
                  <strong>Error:</strong> {saveError}
                </div>
              )}

              <div className="form-row">
                <label>Parent Category *</label>
                <select
                  value={editingSubCategory.parentCategoryName}
                  onChange={(e) => setEditingSubCategory({ ...editingSubCategory, parentCategoryName: e.target.value })}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label>Subcategory Name *</label>
                <input
                  type="text"
                  value={editingSubCategory.name}
                  onChange={(e) => setEditingSubCategory({ ...editingSubCategory, name: e.target.value })}
                  placeholder="Enter subcategory name"
                  autoFocus
                />
              </div>

              <div className="form-row">
                <label>Description</label>
                <textarea
                  value={editingSubCategory.description || ''}
                  onChange={(e) => setEditingSubCategory({ ...editingSubCategory, description: e.target.value })}
                  placeholder="Enter subcategory description (optional)"
                  rows={3}
                />
              </div>

              <div className="form-row">
                <label>Icon (Emoji)</label>
                <input
                  type="text"
                  value={editingSubCategory.icon || ''}
                  onChange={(e) => setEditingSubCategory({ ...editingSubCategory, icon: e.target.value })}
                  placeholder="📂"
                  maxLength={2}
                />
                <p className="help-text">Enter an emoji to represent this subcategory</p>
              </div>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={handleCloseModal}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleSaveSubCategory}>
                {isAddMode ? 'Create Subcategory' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subcategories;
