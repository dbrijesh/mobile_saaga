import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { format, subDays } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, LabelList,
} from 'recharts';
import './Dashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev';
const API_KEY = import.meta.env.VITE_API_KEY || '';

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  orderId: string;
  orderNumber?: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: string;
  createdAt: string;
  shippingAddress?: { fullName?: string };
  couponCode?: string;
  discountAmount?: number;
}

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  inStock: boolean;
}

interface Coupon {
  couponId: string;
  code: string;
  status: string;
  discountType: string;
  discountValue: number;
  usageLimit?: number | null;
  usageCount?: number;
  autoApply?: boolean;
  perCustomerLimit?: number | null;
}

// Categorical palette validated for this app's dark chart surface (#0c1628) —
// see dataviz skill: fixed order preserves the adjacent CVD-safe pairing.
const STATUS_COLORS: Record<string, string> = {
  pending: '#3987e5',
  confirmed: '#d95926',
  processing: '#199e70',
  shipped: '#c98500',
  delivered: '#d55181',
  cancelled: '#008300',
};
const FALLBACK_STATUS_COLOR = '#6b7280';
const SERIES_BLUE = '#3987e5';
const SERIES_ORANGE = '#d95926';

const currency = (n: number) => `SGD ${n.toFixed(2)}`;

const Dashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const token = localStorage.getItem('authToken');
    const errors: string[] = [];

    const [ordersResult, productsResult, couponsResult] = await Promise.allSettled([
      axios.get(`${API_URL}/admin/orders`, { headers: { Authorization: `Bearer ${token}` } }),
      axios.get(`${API_URL}/products?all=true`, { headers: { 'x-api-key': API_KEY } }),
      axios.get(`${API_URL}/admin/coupons`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    if (ordersResult.status === 'fulfilled') {
      setOrders(ordersResult.value.data.orders || []);
    } else {
      console.error('Error fetching orders:', ordersResult.reason);
      errors.push('orders');
    }

    if (productsResult.status === 'fulfilled') {
      setProducts(productsResult.value.data.products || []);
    } else {
      console.error('Error fetching products:', productsResult.reason);
      errors.push('products');
    }

    if (couponsResult.status === 'fulfilled') {
      setCoupons(couponsResult.value.data.coupons || []);
    } else {
      console.error('Error fetching coupons:', couponsResult.reason);
      errors.push('coupons');
    }

    setLoadErrors(errors);
    setLoading(false);
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  // ---- Order metrics ----
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
  const totalDiscountGiven = orders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);

  const statusBreakdown = orders.reduce((acc: Record<string, number>, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});
  const statusData = Object.entries(statusBreakdown).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    key: status,
    value: count,
  }));

  // ---- Product / inventory metrics ----
  const totalProducts = products.length;
  const lowStockProducts = products.filter((p) => p.stock < 10 && p.stock > 0);
  const outOfStockProducts = products.filter((p) => p.stock <= 0 || !p.inStock);
  const totalInventoryValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
  const categoryById: Record<string, string> = {};
  products.forEach((p) => { categoryById[p.id] = p.category; });

  // ---- Top selling products (by revenue, from real order line items) ----
  const productAgg: Record<string, { name: string; revenue: number; units: number }> = {};
  orders.forEach((o) => {
    (o.items || []).forEach((item) => {
      const key = item.productId || item.name;
      if (!productAgg[key]) productAgg[key] = { name: item.name, revenue: 0, units: 0 };
      productAgg[key].revenue += (item.price || 0) * (item.quantity || 0);
      productAgg[key].units += item.quantity || 0;
    });
  });
  const topProducts = Object.entries(productAgg)
    .map(([productId, v]) => ({ productId, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .reverse(); // reverse so the highest bar renders at the top of a horizontal chart

  // ---- Revenue by category ----
  const categoryAgg: Record<string, number> = {};
  orders.forEach((o) => {
    (o.items || []).forEach((item) => {
      const cat = categoryById[item.productId] || 'Uncategorized';
      categoryAgg[cat] = (categoryAgg[cat] || 0) + (item.price || 0) * (item.quantity || 0);
    });
  });
  const categoryRevenueData = Object.entries(categoryAgg)
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)
    .reverse();

  // ---- Revenue trend: last 14 days, computed from real order timestamps ----
  const days = Array.from({ length: 14 }, (_, i) => subDays(new Date(), 13 - i));
  const revenueByDay: Record<string, number> = {};
  orders.forEach((o) => {
    if (!o.createdAt) return;
    const dayKey = o.createdAt.slice(0, 10);
    revenueByDay[dayKey] = (revenueByDay[dayKey] || 0) + (o.totalAmount || 0);
  });
  const revenueTrend = days.map((d) => {
    const dayKey = format(d, 'yyyy-MM-dd');
    return { date: format(d, 'MMM d'), revenue: parseFloat((revenueByDay[dayKey] || 0).toFixed(2)) };
  });

  // ---- Recent orders ----
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  // ---- Coupons / promotions ----
  const activeCoupons = coupons.filter((c) => c.status === 'active');
  const autoPromo = coupons.find((c) => c.autoApply && c.status === 'active');

  return (
    <div className="dashboard">
      <h1 className="page-title">Dashboard</h1>

      {loadErrors.length > 0 && (
        <div className="dashboard-warning">
          ⚠️ Could not load live data for: {loadErrors.join(', ')}. Figures below may be incomplete.
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#3987e5' }}>📦</div>
          <div className="stat-content">
            <div className="stat-label">Total Orders</div>
            <div className="stat-value">{totalOrders}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#199e70' }}>💰</div>
          <div className="stat-content">
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value">{currency(totalRevenue)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#d95926' }}>📊</div>
          <div className="stat-content">
            <div className="stat-label">Avg Order Value</div>
            <div className="stat-value">{currency(avgOrderValue)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#c98500' }}>⏳</div>
          <div className="stat-content">
            <div className="stat-label">Pending Orders</div>
            <div className="stat-value">{statusBreakdown.pending || 0}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#818cf8' }}>🛒</div>
          <div className="stat-content">
            <div className="stat-label">Total Products</div>
            <div className="stat-value">{totalProducts}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f87171' }}>⚠️</div>
          <div className="stat-content">
            <div className="stat-label">Low Stock Items</div>
            <div className="stat-value">{lowStockProducts.length}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#34d399' }}>📈</div>
          <div className="stat-content">
            <div className="stat-label">Inventory Value</div>
            <div className="stat-value">{currency(totalInventoryValue)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#d55181' }}>🎟️</div>
          <div className="stat-content">
            <div className="stat-label">Discounts Given</div>
            <div className="stat-value">{currency(totalDiscountGiven)}</div>
          </div>
        </div>
      </div>

      {autoPromo && (
        <div className="promo-banner">
          <div className="promo-banner-main">
            <span className="promo-badge">AUTO-APPLY</span>
            <strong>{autoPromo.code}</strong>
            <span className="promo-desc">
              {autoPromo.discountType === 'percentage' ? `${autoPromo.discountValue}% off` : `SGD ${autoPromo.discountValue} off`}
              {autoPromo.perCustomerLimit ? ` · limit ${autoPromo.perCustomerLimit}/customer` : ''}
            </span>
          </div>
          <div className="promo-banner-counter">
            <span className="promo-count">{autoPromo.usageCount || 0}</span>
            <span className="promo-count-sep">/</span>
            <span className="promo-count-total">{autoPromo.usageLimit ?? '∞'}</span>
            <span className="promo-count-label">claimed</span>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-card">
          <h2 className="chart-title">Revenue Trend (Last 14 Days)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              {/* @ts-expect-error - Recharts type compatibility */}
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              {/* @ts-expect-error - Recharts type compatibility */}
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              {/* @ts-expect-error - Recharts type compatibility */}
              <Tooltip
                contentStyle={{ background: '#0c1628', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, color: '#e2e8f0' }}
                formatter={(value: number) => [currency(value), 'Revenue']}
              />
              {/* @ts-expect-error - Recharts type compatibility */}
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke={SERIES_BLUE} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h2 className="chart-title">Order Status Distribution</h2>
          {statusData.length === 0 ? (
            <div className="chart-empty">No orders yet</div>
          ) : (
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
                  dataKey="value"
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.key} fill={STATUS_COLORS[entry.key] || FALLBACK_STATUS_COLOR} />
                  ))}
                </Pie>
                {/* @ts-expect-error - Recharts type compatibility */}
                <Legend />
                {/* @ts-expect-error - Recharts type compatibility */}
                <Tooltip contentStyle={{ background: '#0c1628', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, color: '#e2e8f0' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="chart-card">
          <h2 className="chart-title">Top 5 Selling Products</h2>
          {topProducts.length === 0 ? (
            <div className="chart-empty">No sales data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                {/* @ts-expect-error - Recharts type compatibility */}
                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                {/* @ts-expect-error - Recharts type compatibility */}
                <YAxis type="category" dataKey="name" width={140} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                {/* @ts-expect-error - Recharts type compatibility */}
                <Tooltip
                  contentStyle={{ background: '#0c1628', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, color: '#e2e8f0' }}
                  formatter={(value: number) => [currency(value), 'Revenue']}
                />
                {/* @ts-expect-error - Recharts type compatibility */}
                <Bar dataKey="revenue" name="Revenue" fill={SERIES_BLUE} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="revenue" position="right" formatter={(v: number) => currency(v)} fill="var(--text-muted)" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="chart-card">
          <h2 className="chart-title">Revenue by Category</h2>
          {categoryRevenueData.length === 0 ? (
            <div className="chart-empty">No sales data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryRevenueData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                {/* @ts-expect-error - Recharts type compatibility */}
                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                {/* @ts-expect-error - Recharts type compatibility */}
                <YAxis type="category" dataKey="category" width={140} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                {/* @ts-expect-error - Recharts type compatibility */}
                <Tooltip
                  contentStyle={{ background: '#0c1628', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, color: '#e2e8f0' }}
                  formatter={(value: number) => [currency(value), 'Revenue']}
                />
                {/* @ts-expect-error - Recharts type compatibility */}
                <Bar dataKey="revenue" name="Revenue" fill={SERIES_ORANGE} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="revenue" position="right" formatter={(v: number) => currency(v)} fill="var(--text-muted)" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="dashboard-lower-grid">
        {/* Recent Orders */}
        <div className="recent-section">
          <h2 className="section-title">Recent Orders</h2>
          {recentOrders.length === 0 ? (
            <div className="chart-empty">No orders yet</div>
          ) : (
            <div className="mini-table-container">
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.orderId}>
                      <td className="mono">{o.orderNumber || `${o.orderId.slice(0, 10)}…`}</td>
                      <td>{o.shippingAddress?.fullName || 'N/A'}</td>
                      <td>{currency(o.totalAmount || 0)}</td>
                      <td>
                        <span className="status-pill" style={{ background: STATUS_COLORS[o.status] || FALLBACK_STATUS_COLOR }}>
                          {o.status}
                        </span>
                      </td>
                      <td>{format(new Date(o.createdAt), 'MMM d, HH:mm')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Inventory Alerts */}
        <div className="recent-section">
          <h2 className="section-title">Inventory Alerts</h2>
          {lowStockProducts.length === 0 && outOfStockProducts.length === 0 ? (
            <div className="chart-empty">All products are well stocked</div>
          ) : (
            <div className="mini-table-container">
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...outOfStockProducts, ...lowStockProducts].slice(0, 8).map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.category}</td>
                      <td>{p.stock}</td>
                      <td>
                        <span className={`status-pill ${p.stock <= 0 || !p.inStock ? 'pill-danger' : 'pill-warning'}`}>
                          {p.stock <= 0 || !p.inStock ? 'Out of stock' : 'Low stock'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Order Summary by Status */}
      <div className="recent-section">
        <h2 className="section-title">Order Summary by Status</h2>
        {statusData.length === 0 ? (
          <div className="chart-empty">No orders yet</div>
        ) : (
          <div className="status-grid">
            {statusData.map((item) => (
              <div key={item.key} className="status-item">
                <div className="status-badge" style={{ background: STATUS_COLORS[item.key] || FALLBACK_STATUS_COLOR }}>
                  {item.name}
                </div>
                <div className="status-count">{item.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeCoupons.length > 0 && (
        <div className="recent-section">
          <h2 className="section-title">Active Coupons</h2>
          <div className="mini-table-container">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Usage</th>
                  <th>Per Customer</th>
                </tr>
              </thead>
              <tbody>
                {activeCoupons.map((c) => (
                  <tr key={c.couponId}>
                    <td className="mono">{c.code}</td>
                    <td>{c.discountType === 'percentage' ? `${c.discountValue}%` : currency(c.discountValue)}</td>
                    <td>{c.usageCount || 0}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                    <td>{c.perCustomerLimit || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
