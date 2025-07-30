import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  Users,
  Package,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  Truck,
  Store,
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import Loading from '@/components/ui/Loading'
import Error from '@/components/ui/Error'
import orderService from '@/services/api/orderService'
import { productService } from '@/services/api/productService'
import { vendorService } from '@/services/api/vendorService'
import employeeService from '@/services/api/employeeService';
import { financialService } from '@/services/api/financialService';
import { reportService } from '@/services/api/reportService';

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState('today');
  
  // Dashboard data state
  const [dashboardData, setDashboardData] = useState({
    orders: {
      total: 0,
      pending: 0,
      completed: 0,
      revenue: 0
    },
    products: {
      total: 0,
      lowStock: 0,
      outOfStock: 0
    },
    vendors: {
      total: 0,
      active: 0,
      pendingApproval: 0
    },
    employees: {
      total: 0,
      active: 0,
      onLeave: 0
    },
    financial: {
      totalRevenue: 0,
      totalExpenses: 0,
      profit: 0,
      profitMargin: 0
    },
    recentActivity: []
  });

  // Redux state
  const cartItems = useSelector(state => state?.cart?.items || []);
  const notifications = useSelector(state => state?.approvalWorkflow?.notifications || []);

  // Time filter options
  const timeFilters = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' }
  ];

  // Fetch dashboard data with proper error handling
  const fetchDashboardData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Parallel data fetching with null checks and fallbacks
      const [
        ordersData,
        productsData,
        vendorsData,
        employeesData,
        financialData,
        activityData
      ] = await Promise.allSettled([
        // Orders data with safe service calls
        (async () => {
          try {
            const service = orderService;
            if (!service || typeof service.getAll !== 'function') {
              console.warn('Order service not available, using mock data');
              return {
                total: 0,
                pending: 0,
                completed: 0,
                revenue: 0,
                orders: []
              };
            }
            const orders = await service.getAll();
            const ordersList = Array.isArray(orders) ? orders : [];
            return {
              total: ordersList.length,
              pending: ordersList.filter(o => o?.status === 'pending').length,
              completed: ordersList.filter(o => o?.status === 'completed').length,
              revenue: ordersList.reduce((sum, o) => sum + (parseFloat(o?.totalAmount) || 0), 0),
              orders: ordersList.slice(0, 5) // Recent orders
            };
          } catch (err) {
            console.error('Orders fetch error:', err);
            return { total: 0, pending: 0, completed: 0, revenue: 0, orders: [] };
          }
        })(),

        // Products data with safe service calls
        (async () => {
          try {
            const service = productService;
            if (!service || typeof service.getAll !== 'function') {
              console.warn('Product service not available, using mock data');
              return { total: 0, lowStock: 0, outOfStock: 0 };
            }
            const products = await service.getAll();
            const productsList = Array.isArray(products) ? products : [];
            return {
              total: productsList.length,
              lowStock: productsList.filter(p => (p?.stock || 0) < (p?.lowStockThreshold || 10)).length,
              outOfStock: productsList.filter(p => (p?.stock || 0) === 0).length
            };
          } catch (err) {
            console.error('Products fetch error:', err);
            return { total: 0, lowStock: 0, outOfStock: 0 };
          }
        })(),

        // Vendors data with safe service calls
        (async () => {
          try {
            const service = vendorService;
            if (!service || typeof service.getAll !== 'function') {
              console.warn('Vendor service not available, using mock data');
              return { total: 0, active: 0, pendingApproval: 0 };
            }
            const vendors = await service.getAll();
            const vendorsList = Array.isArray(vendors) ? vendors : [];
            return {
              total: vendorsList.length,
              active: vendorsList.filter(v => v?.status === 'active').length,
              pendingApproval: vendorsList.filter(v => v?.status === 'pending').length
            };
          } catch (err) {
            console.error('Vendors fetch error:', err);
            return { total: 0, active: 0, pendingApproval: 0 };
          }
        })(),

        // Employees data with safe service calls
        (async () => {
          try {
            const service = employeeService;
            if (!service || typeof service.getAll !== 'function') {
              console.warn('Employee service not available, using mock data');
              return { total: 0, active: 0, onLeave: 0 };
            }
            const employees = await service.getAll();
            const employeesList = Array.isArray(employees) ? employees : [];
            return {
              total: employeesList.length,
              active: employeesList.filter(e => e?.status === 'active').length,
              onLeave: employeesList.filter(e => e?.status === 'on_leave').length
            };
          } catch (err) {
            console.error('Employees fetch error:', err);
            return { total: 0, active: 0, onLeave: 0 };
          }
        })(),

        // Financial data with safe service calls
        (async () => {
          try {
            const service = financialService;
            if (!service || typeof service.getDashboardSummary !== 'function') {
              console.warn('Financial service not available, using mock data');
              return { totalRevenue: 0, totalExpenses: 0, profit: 0, profitMargin: 0 };
            }
            const financial = await service.getDashboardSummary(timeFilter);
            return financial || { totalRevenue: 0, totalExpenses: 0, profit: 0, profitMargin: 0 };
          } catch (err) {
            console.error('Financial fetch error:', err);
            return { totalRevenue: 0, totalExpenses: 0, profit: 0, profitMargin: 0 };
          }
        })(),

        // Recent activity with safe service calls
        (async () => {
          try {
            const service = reportService;
            if (!service || typeof service.getRecentActivity !== 'function') {
              console.warn('Report service not available, using mock data');
              return [];
            }
            const activity = await service.getRecentActivity();
            return Array.isArray(activity) ? activity : [];
          } catch (err) {
            console.error('Activity fetch error:', err);
            return [];
          }
        })()
      ]);

      // Process results with proper error handling
      const processResult = (result, fallback) => {
        return result.status === 'fulfilled' ? result.value : fallback;
      };

      setDashboardData({
        orders: processResult(ordersData, { total: 0, pending: 0, completed: 0, revenue: 0 }),
        products: processResult(productsData, { total: 0, lowStock: 0, outOfStock: 0 }),
        vendors: processResult(vendorsData, { total: 0, active: 0, pendingApproval: 0 }),
        employees: processResult(employeesData, { total: 0, active: 0, onLeave: 0 }),
        financial: processResult(financialData, { totalRevenue: 0, totalExpenses: 0, profit: 0, profitMargin: 0 }),
        recentActivity: processResult(activityData, [])
      });

    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      setError({
        message: 'Failed to load dashboard data',
        action: 'refresh',
        details: err.message
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Effect to load data on mount and filter change
  useEffect(() => {
    fetchDashboardData();
  }, [timeFilter]);

  // Memoized calculations
  const calculatedMetrics = useMemo(() => {
    const { financial } = dashboardData;
    return {
      profitMargin: financial.totalRevenue > 0 
        ? ((financial.profit / financial.totalRevenue) * 100).toFixed(1)
        : '0.0',
      averageOrderValue: dashboardData.orders.total > 0
        ? (dashboardData.orders.revenue / dashboardData.orders.total).toFixed(2)
        : '0.00'
    };
  }, [dashboardData]);

  // Handle refresh
  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  // Render loading state
  if (loading) {
    return <Loading type="page" />;
  }

  // Render error state
  if (error) {
    return (
      <Error 
        message={error.message}
        onRetry={() => fetchDashboardData()}
        details={error.details}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Admin Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Welcome back! Here's what's happening with your business.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Time Filter */}
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
            >
              {timeFilters.map(filter => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Orders Stats */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.orders.total}</p>
              <p className="text-xs text-gray-500 mt-1">
                {dashboardData.orders.pending} pending • {dashboardData.orders.completed} completed
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Revenue Stats */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${dashboardData.orders.revenue.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Avg: ${calculatedMetrics.averageOrderValue}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Products Stats */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Products</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.products.total}</p>
              <p className="text-xs text-red-500 mt-1">
                {dashboardData.products.lowStock} low stock • {dashboardData.products.outOfStock} out of stock
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <Package className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Vendors Stats */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Active Vendors</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.vendors.active}</p>
              <p className="text-xs text-gray-500 mt-1">
                {dashboardData.vendors.pendingApproval} pending approval
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Store className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Financial Summary */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Financial Overview</h2>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Revenue</span>
              <span className="font-semibold text-green-600">
                ${dashboardData.financial.totalRevenue.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Expenses</span>
              <span className="font-semibold text-red-600">
                ${dashboardData.financial.totalExpenses.toLocaleString()}
              </span>
            </div>
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-900 font-semibold">Net Profit</span>
                <span className="font-bold text-primary">
                  ${dashboardData.financial.profit.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-600 text-sm">Profit Margin</span>
                <span className="text-sm font-semibold text-primary">
                  {calculatedMetrics.profitMargin}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          
          <div className="grid grid-cols-2 gap-3">
            <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Package className="w-6 h-6 text-primary mb-2" />
              <span className="text-sm font-medium">Manage Products</span>
            </button>
            
            <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Users className="w-6 h-6 text-primary mb-2" />
              <span className="text-sm font-medium">Manage Vendors</span>
            </button>
            
            <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <BarChart3 className="w-6 h-6 text-primary mb-2" />
              <span className="text-sm font-medium">View Analytics</span>
            </button>
            
            <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="w-6 h-6 text-primary mb-2" />
              <span className="text-sm font-medium">Export Reports</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <Activity className="w-5 h-5 text-gray-400" />
        </div>
        
        {dashboardData.recentActivity.length > 0 ? (
          <div className="space-y-3">
            {dashboardData.recentActivity.slice(0, 5).map((activity, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  {activity.type === 'order' && <ShoppingCart className="w-4 h-4 text-blue-600" />}
                  {activity.type === 'product' && <Package className="w-4 h-4 text-green-600" />}
                  {activity.type === 'vendor' && <Store className="w-4 h-4 text-purple-600" />}
                  {activity.type === 'employee' && <Users className="w-4 h-4 text-orange-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.message || 'Recent activity'}</p>
                  <p className="text-xs text-gray-500">{activity.timestamp || 'Just now'}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No recent activity to show</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;