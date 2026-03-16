import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './Dashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://your-api-gateway-url.execute-api.ap-southeast-1.amazonaws.com/dev';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/orders`);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Mock data for demo
      setStats({
        totalOrders: 245,
        totalRevenue: 12450.50,
        statusBreakdown: {
          pending: 12,
          confirmed: 18,
          processing: 25,
          shipped: 34,
          delivered: 156,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const COLORS = ['#FF6B35', '#004E89', '#F7B801', '#34C759', '#5AC8FA'];

  const statusData = stats?.statusBreakdown
    ? Object.entries(stats.statusBreakdown).map(([status, count]) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: count as number,
      }))
    : [];

  const revenueData = [
    { month: 'Jan', revenue: 4500 },
    { month: 'Feb', revenue: 5200 },
    { month: 'Mar', revenue: 6800 },
    { month: 'Apr', revenue: 7200 },
    { month: 'May', revenue: 8900 },
    { month: 'Jun', revenue: 9500 },
    { month: 'Jul', revenue: 10200 },
    { month: 'Aug', revenue: 11100 },
    { month: 'Sep', revenue: 10800 },
    { month: 'Oct', revenue: 12000 },
    { month: 'Nov', revenue: 11500 },
    { month: 'Dec', revenue: stats?.totalRevenue || 12450 },
  ];

  return (
    <div className="dashboard">
      <h1 className="page-title">Dashboard</h1>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ff6b35' }}>📦</div>
          <div className="stat-content">
            <div className="stat-label">Total Orders</div>
            <div className="stat-value">{stats?.totalOrders || 0}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#34C759' }}>💰</div>
          <div className="stat-content">
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value">SGD {(stats?.totalRevenue || 0).toFixed(2)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#004E89' }}>📊</div>
          <div className="stat-content">
            <div className="stat-label">Avg Order Value</div>
            <div className="stat-value">
              SGD {stats?.totalOrders ? (stats.totalRevenue / stats.totalOrders).toFixed(2) : '0.00'}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#F7B801' }}>🚚</div>
          <div className="stat-content">
            <div className="stat-label">Pending Orders</div>
            <div className="stat-value">{stats?.statusBreakdown?.pending || 0}</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-card">
          <h2 className="chart-title">Revenue Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              {/* @ts-expect-error - Recharts type compatibility */}
              <XAxis dataKey="month" />
              {/* @ts-expect-error - Recharts type compatibility */}
              <YAxis />
              {/* @ts-expect-error - Recharts type compatibility */}
              <Tooltip />
              {/* @ts-expect-error - Recharts type compatibility */}
              <Legend />
              {/* @ts-expect-error - Recharts type compatibility */}
              <Line type="monotone" dataKey="revenue" stroke="#ff6b35" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h2 className="chart-title">Order Status Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              {/* @ts-expect-error - Recharts type compatibility */}
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              {/* @ts-expect-error - Recharts type compatibility */}
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Orders Summary */}
      <div className="recent-section">
        <h2 className="section-title">Order Summary by Status</h2>
        <div className="status-grid">
          {statusData.map((item, index) => (
            <div key={item.name} className="status-item">
              <div className="status-badge" style={{ background: COLORS[index] }}>
                {item.name}
              </div>
              <div className="status-count">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
