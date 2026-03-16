import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { logout } from '../store/authSlice';
import axios from 'axios';
import './Layout.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const [profilePicture, setProfilePicture] = useState<string>('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await axios.get(`${API_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.profilePictureUrl) {
        setProfilePicture(response.data.profilePictureUrl);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleProfilePictureClick = () => {
    setShowUploadModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadProfilePicture(file);
    }
  };

  const uploadProfilePicture = async (file: File) => {
    try {
      setUploadingImage(true);
      const token = localStorage.getItem('authToken');
      if (!token) {
        alert('Please login again');
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const response = await axios.post(
            `${API_URL}/user/profile/picture`,
            {
              image: reader.result as string,
              fileName: file.name,
              fileType: file.type
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          setProfilePicture(response.data.profilePictureUrl);
          setShowUploadModal(false);
          alert('Profile picture updated successfully!');
        } catch (error: any) {
          console.error('Error uploading profile picture:', error);
          alert('Failed to upload profile picture: ' + (error.response?.data?.error || error.message));
        } finally {
          setUploadingImage(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error reading file:', error);
      setUploadingImage(false);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/orders', label: 'Orders', icon: '📦' },
    { path: '/inventory', label: 'Inventory', icon: '📋' },
    { path: '/categories', label: 'Categories', icon: '🏷️' },
    { path: '/subcategories', label: 'Subcategories', icon: '📂' },
    { path: '/shipping-dates', label: 'Shipping Dates', icon: '📅' },
    { path: '/coupons', label: 'Coupons', icon: '🎟️' },
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-logo">🛒 Saaga Admin</h1>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div
              className="user-avatar"
              onClick={handleProfilePictureClick}
              style={{ cursor: 'pointer', position: 'relative' }}
              title="Click to update profile picture"
            >
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt="Profile"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '50%'
                  }}
                />
              ) : (
                user?.name?.charAt(0) || 'A'
              )}
            </div>
            <div className="user-details">
              <div className="user-name">{user?.name || 'Admin'}</div>
              <div className="user-email">{user?.email || ''}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>

        {/* Profile Picture Upload Modal */}
        {showUploadModal && (
          <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
              <h2>Update Profile Picture</h2>

              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                {profilePicture ? (
                  <img
                    src={profilePicture}
                    alt="Current profile"
                    style={{
                      width: '150px',
                      height: '150px',
                      objectFit: 'cover',
                      borderRadius: '50%',
                      border: '3px solid #e0e0e0'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '150px',
                    height: '150px',
                    borderRadius: '50%',
                    background: '#e0e0e0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '48px',
                    margin: '0 auto'
                  }}>
                    {user?.name?.charAt(0) || 'A'}
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  style={{
                    padding: '12px 24px',
                    background: '#007AFF',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: uploadingImage ? 'not-allowed' : 'pointer',
                    opacity: uploadingImage ? 0.6 : 1
                  }}
                >
                  {uploadingImage ? 'Uploading...' : 'Choose Photo'}
                </button>
                <button
                  onClick={() => setShowUploadModal(false)}
                  style={{
                    padding: '12px 24px',
                    background: '#e0e0e0',
                    color: '#333',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
