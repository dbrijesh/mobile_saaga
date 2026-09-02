import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Inventory.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev';
const API_KEY = import.meta.env.VITE_API_KEY || '';

interface Product {
  id: string;
  name: string;
  category: string;
  subCategory?: string;
  price: number;
  stock: number;
  inStock: boolean;
  sku: string;
  imageUrl?: string;
  description?: string;
  unit?: string;
  weight?: string;
  discountPercent?: number;
  purchasePriceINR?: number;
  purchasePriceSGD?: number;
}

interface Category {
  id: string;
  name: string;
}

interface SubCategory {
  id: string;
  name: string;
  parentCategoryName: string;
}

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
  const [subcategoryFilter, setSubcategoryFilter] = useState('all');
  const [filteredSubcategories, setFilteredSubcategories] = useState<SubCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [saveError, setSaveError] = useState<string>('');
  const [isAddMode, setIsAddMode] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchSubcategories();
  }, []);

  useEffect(() => {
    if (categoryFilter === 'all') {
      setFilteredSubcategories([]);
      setSubcategoryFilter('all');
    } else {
      const filtered = subcategories.filter(sc => sc.parentCategoryName === categoryFilter);
      setFilteredSubcategories(filtered);
      setSubcategoryFilter('all');
    }
  }, [categoryFilter, subcategories]);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_URL}/products?all=true`, {
        headers: { 'x-api-key': API_KEY },
      });
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      alert('Error loading products. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_URL}/categories`, {
        headers: { 'x-api-key': API_KEY }
      });
      const categoryNames = response.data.categories?.map((cat: Category) => cat.name) || [];
      setCategories(['all', ...categoryNames]);
    } catch (error) {
      console.error('Error fetching categories:', error);
      // Fallback to deriving from products if API fails
      const productCategories = ['all', ...new Set(products.map(p => p.category))];
      setCategories(productCategories);
    }
  };

  const fetchSubcategories = async () => {
    try {
      const response = await axios.get(`${API_URL}/subcategories`, {
        headers: { 'x-api-key': API_KEY }
      });
      setSubcategories(response.data.subcategories || []);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
    }
  };

  const handleAddClick = async () => {
    // Refresh categories to get latest list
    await fetchCategories();

    setEditingProduct({
      id: '',
      name: '',
      category: categories.filter(c => c !== 'all')[0] || '',
      subCategory: '',
      price: 0,
      stock: 0,
      inStock: true,
      sku: `SKU-${Date.now()}`,
      description: '',
      imageUrl: '',
      unit: '',
      weight: '',
      purchasePriceINR: 0,
      purchasePriceSGD: 0
    });
    setImageFile(null);
    setImagePreview('');
    setIsAddMode(true);
    setSaveError('');
    setIsModalOpen(true);
  };

  const handleEditClick = async (product: Product) => {
    // Refresh categories to get latest list
    await fetchCategories();

    setEditingProduct({ ...product });
    setImagePreview(product.imageUrl || '');
    setIsAddMode(false);
    setSaveError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setImageFile(null);
    setImagePreview('');
    setSaveError('');
    setIsAddMode(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`Are you sure you want to delete "${product.name}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');

      if (!token) {
        alert('You are not logged in. Please refresh the page and login again.');
        return;
      }

      await axios.delete(
        `${API_URL}/admin/products/${product.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      alert('Product deleted successfully!');
      fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      let errorMessage = 'Failed to delete product. ';

      if (error.response?.status === 401 || error.response?.status === 403) {
        errorMessage += 'Your session may have expired. Please logout and login again.';
      } else if (error.response?.data?.error) {
        errorMessage += error.response.data.error;
      } else {
        errorMessage += error.message;
      }

      alert(errorMessage);
    }
  };

  const handleSaveProduct = async () => {
    if (!editingProduct) return;

    setSaveError('');

    try {
      // Get token from localStorage
      const token = localStorage.getItem('authToken');

      console.log('Token exists:', !!token);
      console.log('Token preview:', token?.substring(0, 50) + '...');

      if (!token) {
        setSaveError('You are not logged in. Please refresh the page and login again.');
        return;
      }

      let imageUrlToSave = editingProduct.imageUrl;

      // Upload image if one was selected
      if (imageFile) {
        console.log('Uploading image to S3...');
        try {
          const reader = new FileReader();
          const base64Image = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
          });

          console.log('Image converted to base64, uploading...');

          const uploadResponse = await axios.post(
            `${API_URL}/admin/upload/image`,
            {
              image: base64Image,
              fileName: imageFile.name,
              fileType: imageFile.type
            },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          console.log('Image uploaded successfully:', uploadResponse.data);
          imageUrlToSave = uploadResponse.data.imageUrl;
        } catch (uploadError: any) {
          console.error('Error uploading image:', uploadError);
          setSaveError('Failed to upload image: ' + (uploadError.response?.data?.error || uploadError.message));
          return;
        }
      }

      const productData = {
        name: editingProduct.name,
        description: editingProduct.description,
        category: editingProduct.category,
        subCategory: editingProduct.subCategory || '',
        price: parseFloat(editingProduct.price.toString()),
        stock: parseInt(editingProduct.stock.toString()),
        imageUrl: imageUrlToSave,
        inStock: parseInt(editingProduct.stock.toString()) > 0,
        sku: editingProduct.sku,
        unit: editingProduct.unit || '',
        weight: editingProduct.weight || '',
        discountPercent: parseFloat((editingProduct.discountPercent || 0).toString()),
        purchasePriceINR: parseFloat((editingProduct.purchasePriceINR || 0).toString()),
        purchasePriceSGD: parseFloat((editingProduct.purchasePriceSGD || 0).toString())
      };

      if (isAddMode) {
        // Create new product
        console.log('Creating new product');
        console.log('Product data:', productData);
        console.log('API URL:', `${API_URL}/admin/products`);

        const response = await axios.post(
          `${API_URL}/admin/products`,
          productData,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('Create response:', response.data);
        alert('Product created successfully!');
      } else {
        // Update existing product
        console.log('Updating product:', editingProduct.id);
        console.log('Product data:', productData);
        console.log('API URL:', `${API_URL}/admin/products/${editingProduct.id}`);

        const response = await axios.put(
          `${API_URL}/admin/products/${editingProduct.id}`,
          productData,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('Update response:', response.data);
        alert('Product updated successfully!');
      }

      fetchProducts();
      handleCloseModal();
    } catch (error: any) {
      console.error('Error updating product:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      let errorMessage = 'Failed to update product. ';

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

  const handleExport = () => {
    // Create CSV content
    const headers = ['SKU', 'Name', 'Category', 'Subcategory', 'Price', 'Discount %', 'Discounted Price', 'Purchase Price (INR)', 'Purchase Price (SGD)', 'Stock', 'In Stock', 'Unit', 'Weight', 'Description', 'Image URL'];
    const rows = products.map(p => [
      p.sku,
      p.name,
      p.category,
      p.subCategory || '',
      p.price,
      p.discountPercent || 0,
      p.discountPercent ? (p.price * (1 - p.discountPercent / 100)).toFixed(2) : p.price.toFixed(2),
      p.purchasePriceINR ?? '',
      p.purchasePriceSGD ?? '',
      p.stock,
      p.inStock ? 'Yes' : 'No',
      p.unit || '',
      p.weight || '',
      p.description || '',
      p.imageUrl || ''
    ]);

    // Convert to CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma
        const cellStr = String(cell).replace(/"/g, '""');
        return cellStr.includes(',') || cellStr.includes('\n') ? `"${cellStr}"` : cellStr;
      }).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert(`Exported ${products.length} products to CSV`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        alert('CSV file is empty or invalid');
        return;
      }

      // Parse CSV (simple parser, assumes no commas in values or properly quoted)
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      const dataRows = lines.slice(1).map(line => parseCSVLine(line));

      if (!confirm(`Found ${dataRows.length} products in CSV. This will update existing products with matching SKUs and create new ones. Continue?`)) {
        return;
      }

      const token = localStorage.getItem('authToken');
      if (!token) {
        alert('You are not logged in. Please refresh and login again.');
        return;
      }

      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const row of dataRows) {
        try {
          const productData: any = {};
          headers.forEach((header, index) => {
            const value = row[index];
            switch (header.toLowerCase()) {
              case 'sku':
                productData.sku = value;
                break;
              case 'name':
                productData.name = value;
                break;
              case 'category':
                productData.category = value;
                break;
              case 'subcategory':
                productData.subCategory = value;
                break;
              case 'price':
                productData.price = parseFloat(value) || 0;
                break;
              case 'discount %':
                productData.discountPercent = parseFloat(value) || 0;
                break;
              case 'purchase price (inr)':
                productData.purchasePriceINR = parseFloat(value) || 0;
                break;
              case 'purchase price (sgd)':
                productData.purchasePriceSGD = parseFloat(value) || 0;
                break;
              case 'stock':
                productData.stock = parseInt(value) || 0;
                break;
              case 'in stock':
                productData.inStock = value.toLowerCase() === 'yes' || value === '1' || value === 'true';
                break;
              case 'unit':
                productData.unit = value;
                break;
              case 'weight':
                productData.weight = value;
                break;
              case 'description':
                productData.description = value;
                break;
              case 'image url':
                productData.imageUrl = value;
                break;
            }
          });

          // Check if product exists by SKU
          const existingProduct = products.find(p => p.sku === productData.sku);

          if (existingProduct) {
            // Update existing product
            await axios.put(
              `${API_URL}/admin/products/${existingProduct.id}`,
              productData,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            updated++;
          } else {
            // Create new product
            await axios.post(
              `${API_URL}/admin/products`,
              productData,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            created++;
          }
        } catch (error) {
          console.error('Error importing product:', error);
          errors++;
        }
      }

      await fetchProducts();
      alert(`Import complete!\nCreated: ${created}\nUpdated: ${updated}\nErrors: ${errors}`);
    } catch (error) {
      console.error('Error reading CSV file:', error);
      alert('Failed to read CSV file. Please ensure it is properly formatted.');
    }

    // Reset file input
    e.target.value = '';
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = (p.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                          (p.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    const matchesSubCategory = subcategoryFilter === 'all' ||
                                (!p.subCategory && subcategoryFilter === 'all') ||
                                (p.subCategory === subcategoryFilter);
    return matchesSearch && matchesCategory && matchesSubCategory;
  });

  const lowStockProducts = products.filter(p => p.stock < 10);

  if (loading) {
    return <div className="loading">Loading products...</div>;
  }

  return (
    <div className="inventory-page">
      <div className="page-header">
        <h1 className="page-title">Inventory Management</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="export-btn" onClick={handleExport}>
            📥 Export CSV
          </button>
          <button className="import-btn" onClick={() => document.getElementById('csv-import')?.click()}>
            📤 Import CSV
          </button>
          <input
            id="csv-import"
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
          <button className="add-product-btn" onClick={handleAddClick}>
            ➕ Add New Product
          </button>
        </div>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="alert-banner">
          ⚠️ {lowStockProducts.length} product(s) are running low on stock!
        </div>
      )}

      <div className="toolbar">
        <input
          type="text"
          className="search-input"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          className="category-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat}
            </option>
          ))}
        </select>

        {categoryFilter !== 'all' && filteredSubcategories.length > 0 && (
          <select
            className="subcategory-select"
            value={subcategoryFilter}
            onChange={(e) => setSubcategoryFilter(e.target.value)}
          >
            <option value="all">All Subcategories</option>
            {filteredSubcategories.map((subcat) => (
              <option key={subcat.id} value={subcat.name}>
                {subcat.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="inventory-table-container">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>SKU</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Subcategory</th>
              <th>Price (SGD)</th>
              <th>Discount</th>
              <th>Final Price</th>
              <th>Purchase Price (INR)</th>
              <th>Purchase Price (SGD)</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id} className={product.stock < 10 ? 'low-stock-row' : ''}>
                <td>
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="product-thumb" />
                  ) : (
                    <div className="product-thumb-placeholder">📦</div>
                  )}
                </td>
                <td className="sku">{product.sku}</td>
                <td className="product-name">{product.name || 'Unnamed Product'}</td>
                <td>{product.category}</td>
                <td>
                  {product.subCategory ? (
                    <span className="subcategory-badge">{product.subCategory}</span>
                  ) : (
                    <span style={{ color: '#999', fontSize: '12px' }}>-</span>
                  )}
                </td>
                <td className="price">
                  {product.discountPercent && product.discountPercent > 0 ? (
                    <span style={{ textDecoration: 'line-through', color: '#999' }}>
                      SGD {product.price.toFixed(2)}
                    </span>
                  ) : (
                    <span>SGD {product.price.toFixed(2)}</span>
                  )}
                </td>
                <td>
                  {product.discountPercent && product.discountPercent > 0 ? (
                    <span style={{ color: '#FF6B35', fontWeight: 'bold' }}>
                      {product.discountPercent}% OFF
                    </span>
                  ) : (
                    <span style={{ color: '#999' }}>-</span>
                  )}
                </td>
                <td>
                  {product.discountPercent && product.discountPercent > 0 ? (
                    <span style={{ color: '#34C759', fontWeight: 'bold' }}>
                      SGD {(product.price * (1 - product.discountPercent / 100)).toFixed(2)}
                    </span>
                  ) : (
                    <span>SGD {product.price.toFixed(2)}</span>
                  )}
                </td>
                <td className="price">
                  {product.purchasePriceINR != null ? `₹${product.purchasePriceINR.toFixed(2)}` : '-'}
                </td>
                <td className="price">
                  {product.purchasePriceSGD != null ? `SGD ${product.purchasePriceSGD.toFixed(2)}` : '-'}
                </td>
                <td className={`stock ${product.stock < 10 ? 'low-stock' : ''}`}>
                  {product.stock}
                </td>
                <td>
                  <span className={`status-badge ${product.inStock ? 'in-stock' : 'out-of-stock'}`}>
                    {product.inStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="edit-btn"
                      onClick={() => handleEditClick(product)}
                    >
                      Edit
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteProduct(product)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="inventory-stats">
        <div className="stat-box">
          <div className="stat-label">Total Products</div>
          <div className="stat-value">{products.length}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Low Stock Items</div>
          <div className="stat-value low-stock">{lowStockProducts.length}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Total Stock Value</div>
          <div className="stat-value">
            SGD {products.reduce((sum, p) => sum + (p.price * p.stock), 0).toFixed(2)}
          </div>
        </div>
      </div>

      {isModalOpen && editingProduct && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isAddMode ? 'Add New Product' : 'Edit Product'}</h2>
              <button className="close-btn" onClick={handleCloseModal}>×</button>
            </div>

            <div className="modal-body">
              {saveError && (
                <div className="error-message">
                  <strong>Error:</strong> {saveError}
                </div>
              )}

              <div className="form-row">
                <label>SKU</label>
                <input
                  type="text"
                  value={editingProduct.sku}
                  onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                  disabled={!isAddMode}
                  className={!isAddMode ? "disabled-input" : ""}
                  placeholder="Enter SKU"
                />
              </div>

              <div className="form-row">
                <label>Product Name *</label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  placeholder="Enter product name"
                />
              </div>

              <div className="form-row">
                <label>Description</label>
                <textarea
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  placeholder="Enter product description"
                  rows={3}
                />
              </div>

              <div className="form-row">
                <label>Category *</label>
                <select
                  value={editingProduct.category}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                >
                  {categories.filter(c => c !== 'all').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {editingProduct.category && editingProduct.category !== '' && (
                <div className="form-row">
                  <label>Subcategory (Optional)</label>
                  <select
                    value={editingProduct.subCategory || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, subCategory: e.target.value })}
                  >
                    <option value="">None</option>
                    {subcategories
                      .filter(sc => sc.parentCategoryName === editingProduct.category)
                      .map(subcat => (
                        <option key={subcat.id} value={subcat.name}>{subcat.name}</option>
                      ))}
                  </select>
                  <p className="help-text">Optional: Select a subcategory to further classify this product</p>
                </div>
              )}

              <div className="form-row-group">
                <div className="form-row">
                  <label>Price (SGD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>

                <div className="form-row">
                  <label>Stock *</label>
                  <input
                    type="number"
                    value={editingProduct.stock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="form-row-group">
                <div className="form-row">
                  <label>Purchase Price (INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProduct.purchasePriceINR ?? 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, purchasePriceINR: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>

                <div className="form-row">
                  <label>Purchase Price (SGD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProduct.purchasePriceSGD ?? 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, purchasePriceSGD: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="form-row">
                <label>Discount (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={editingProduct.discountPercent || 0}
                  onChange={(e) => setEditingProduct({ ...editingProduct, discountPercent: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
                <p className="help-text">Enter discount percentage (0-100). Leave as 0 for no discount.</p>
              </div>

              <div className="form-row-group">
                <div className="form-row">
                  <label>Unit</label>
                  <input
                    type="text"
                    value={editingProduct.unit || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                    placeholder="e.g. kg, pack, piece"
                  />
                </div>

                <div className="form-row">
                  <label>Weight</label>
                  <input
                    type="text"
                    value={editingProduct.weight || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, weight: e.target.value })}
                    placeholder="e.g. 500g, 1kg, 5l"
                  />
                </div>
              </div>

              <div className="form-row">
                <label>Product Image</label>
                <div className="image-upload-section">
                  {imagePreview && (
                    <div className="image-preview">
                      <img src={imagePreview} alt="Preview" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="file-input"
                  />
                  <p className="image-help-text">
                    Select an image to upload it to S3. Supports JPEG, PNG, GIF, and WebP formats.
                  </p>
                </div>
              </div>

              <div className="form-row">
                <label>Image URL (Optional)</label>
                <input
                  type="text"
                  value={editingProduct.imageUrl || ''}
                  onChange={(e) => {
                    setEditingProduct({ ...editingProduct, imageUrl: e.target.value });
                    setImagePreview(e.target.value);
                  }}
                  placeholder="https://example.com/image.jpg"
                />
              </div>

            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={handleCloseModal}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleSaveProduct}>
                {isAddMode ? 'Create Product' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
