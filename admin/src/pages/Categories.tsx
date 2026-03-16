import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Categories.css';

const API_URL = import.meta.env.VITE_API_URL;

interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

const Categories: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saveError, setSaveError] = useState<string>('');
  const [isAddMode, setIsAddMode] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API_URL}/admin/categories`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      alert('Error loading categories. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingCategory({
      id: '',
      name: '',
      description: '',
      icon: '📦',
      createdAt: '',
      updatedAt: '',
    });
    setIsAddMode(true);
    setSaveError('');
    setIsModalOpen(true);
  };

  const handleEditClick = (category: Category) => {
    setEditingCategory({ ...category });
    setIsAddMode(false);
    setSaveError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setSaveError('');
    setIsAddMode(false);
  };

  const handleSaveCategory = async () => {
    if (!editingCategory) return;

    if (!editingCategory.name.trim()) {
      setSaveError('Category name is required');
      return;
    }

    setSaveError('');

    try {
      const token = localStorage.getItem('authToken');

      if (!token) {
        setSaveError('You are not logged in. Please refresh the page and login again.');
        return;
      }

      const categoryData = {
        name: editingCategory.name.trim(),
        description: editingCategory.description?.trim() || '',
        icon: editingCategory.icon || '📦',
      };

      if (isAddMode) {
        // Create new category
        await axios.post(
          `${API_URL}/admin/categories`,
          categoryData,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        alert('Category created successfully!');
      } else {
        // Update existing category
        await axios.put(
          `${API_URL}/admin/categories/${editingCategory.id}`,
          categoryData,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        alert('Category updated successfully!');
      }

      fetchCategories();
      handleCloseModal();
    } catch (error: any) {
      console.error('Error saving category:', error);

      let errorMessage = isAddMode ? 'Failed to create category. ' : 'Failed to update category. ';

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

  const handleDeleteCategory = async (category: Category) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');

      if (!token) {
        alert('You are not logged in. Please refresh the page and login again.');
        return;
      }

      await axios.delete(
        `${API_URL}/admin/categories/${category.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      alert('Category deleted successfully!');
      fetchCategories();
    } catch (error: any) {
      console.error('Error deleting category:', error);

      let errorMessage = 'Failed to delete category. ';
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

  if (loading) {
    return <div className="loading">Loading categories...</div>;
  }

  return (
    <div className="categories-page">
      <div className="page-header">
        <h1 className="page-title">Category Management</h1>
        <button className="add-btn" onClick={handleAddClick}>
          ➕ Add New Category
        </button>
      </div>

      <div className="categories-grid">
        {categories.map((category) => (
          <div key={category.id} className="category-card">
            <div className="category-icon">{category.icon || '📦'}</div>
            <div className="category-info">
              <h3 className="category-name">{category.name}</h3>
              <p className="category-description">{category.description || 'No description'}</p>
            </div>
            <div className="category-actions">
              <button className="edit-btn" onClick={() => handleEditClick(category)}>
                Edit
              </button>
              <button className="delete-btn" onClick={() => handleDeleteCategory(category)}>
                Delete
              </button>
            </div>
          </div>
        ))}

        {categories.length === 0 && (
          <div className="empty-state">
            <p>No categories found. Create your first category!</p>
          </div>
        )}
      </div>

      {isModalOpen && editingCategory && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isAddMode ? 'Add New Category' : 'Edit Category'}</h2>
              <button className="close-btn" onClick={handleCloseModal}>×</button>
            </div>

            <div className="modal-body">
              {saveError && (
                <div className="error-message">
                  <strong>Error:</strong> {saveError}
                </div>
              )}

              <div className="form-row">
                <label>Category Name *</label>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  placeholder="Enter category name"
                  autoFocus
                />
              </div>

              <div className="form-row">
                <label>Description</label>
                <textarea
                  value={editingCategory.description || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  placeholder="Enter category description (optional)"
                  rows={3}
                />
              </div>

              <div className="form-row">
                <label>Icon (Emoji)</label>
                <input
                  type="text"
                  value={editingCategory.icon || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, icon: e.target.value })}
                  placeholder="📦"
                  maxLength={2}
                />
                <p className="help-text">Enter an emoji to represent this category</p>
              </div>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={handleCloseModal}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleSaveCategory}>
                {isAddMode ? 'Create Category' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
