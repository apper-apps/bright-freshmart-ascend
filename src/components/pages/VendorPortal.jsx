import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { orderService } from "@/services/api/orderService";
import { webSocketService } from "@/services/api/websocketService";
import { productService } from "@/services/api/productService";
import { vendorService } from "@/services/api/vendorService";
import { productUnitService } from "@/services/api/productUnitService";
import ApperIcon from "@/components/ApperIcon";
import OrderStatusTimeline from "@/components/molecules/OrderStatusTimeline";
import Loading from "@/components/ui/Loading";
import Error from "@/components/ui/Error";
import Orders from "@/components/pages/Orders";
import Category from "@/components/pages/Category";
import Input from "@/components/atoms/Input";
import Button from "@/components/atoms/Button";
import { formatCurrency, calculateTotals } from "@/utils/currency";
const VendorPortal = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check authentication on component mount
  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const validation = await vendorService.validateSession();
      if (validation.valid) {
        setIsAuthenticated(true);
        const profile = await vendorService.getVendorProfile(validation.session.vendorId);
        setVendor(profile);
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (credentials) => {
    try {
      const result = await vendorService.login(credentials);
      setIsAuthenticated(true);
      setVendor(result.vendor);
      toast.success(`Welcome back, ${result.vendor.name}!`);
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await vendorService.logout();
      setIsAuthenticated(false);
      setVendor(null);
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Error logging out');
    }
  };

  if (loading) {
    return <Loading type="page" />;
  }

  if (error) {
    return <Error message={error} />;
  }

  if (!isAuthenticated) {
    return <VendorLogin onLogin={handleLogin} />;
  }

  return (
    <VendorDashboard 
      vendor={vendor} 
      onLogout={handleLogout}
      onProfileUpdate={setVendor}
    />
  );
};

// Vendor Login Component
const VendorLogin = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await onLogin(formData);
    } catch (error) {
      // Error handled in onLogin
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary rounded-full flex items-center justify-center">
            <ApperIcon name="Store" size={32} className="text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Vendor Portal
          </h2>
          <p className="mt-2 text-gray-600">
            Sign in to manage your products and pricing
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              type="email"
              name="email"
              label="Email Address"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
            <Input
              type="password"
              name="password"
              label="Password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleInputChange}
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <ApperIcon name="Loader2" size={16} className="animate-spin mr-2" />
                Signing in...
              </>
            ) : (
              <>
                <ApperIcon name="LogIn" size={16} className="mr-2" />
                Sign In
              </>
            )}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Demo Credentials: ahmed.khan@vendor.com / vendor123
          </p>
        </div>
      </div>
    </div>
  );
};

// Vendor Dashboard Component
const VendorDashboard = ({ vendor, onLogout, onProfileUpdate }) => {
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadVendorData();
  }, [vendor]);

  const loadVendorData = async () => {
if (!vendor) return;
    
setLoading(true);
setError(null);
try {
const [vendorProducts, vendorStats] = await Promise.all([
        productService.getVendorProducts(vendor.Id),
        productService.getVendorStats(vendor.Id)
      ]);
      
      setProducts(vendorProducts);
      
      // Calculate enhanced stats with cost/selling/margin totals
      const enhancedStats = {
        ...vendorStats,
        ...calculateTotals(vendorProducts, {
          costField: 'purchasePrice',
          sellingField: 'price',
          quantityField: 'stock'
        })
      };
      
      setStats(enhancedStats);
    } catch (error) {
      console.error('Error loading vendor data:', error);
      setError(error.message);
      toast.error('Failed to load vendor data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals for vendor products
  const calculateTotals = (products, fields) => {
    if (!products || products.length === 0) {
      return {
        totalCost: 0,
        totalSellingValue: 0,
        totalMargin: 0,
        averageMargin: 0
      };
    }

    const totals = products.reduce((acc, product) => {
      const cost = product[fields.costField] || 0;
      const selling = product[fields.sellingField] || 0;
      const quantity = product[fields.quantityField] || 0;
      
      acc.totalCost += cost * quantity;
      acc.totalSellingValue += selling * quantity;
      acc.totalMargin += (selling - cost) * quantity;
      
      return acc;
    }, {
      totalCost: 0,
      totalSellingValue: 0,
      totalMargin: 0
    });

    const averageMargin = totals.totalCost > 0 
      ? ((totals.totalSellingValue - totals.totalCost) / totals.totalCost) * 100 
      : 0;

    return {
      ...totals,
      averageMargin: Math.round(averageMargin * 100) / 100
    };
  };

  const handleProductUpdate = async (productId, priceData) => {
    try {
      const updatedProduct = await productService.updateVendorPrice(vendor.Id, productId, priceData);
      
      setProducts(prev => 
        prev.map(product => 
          product.id === productId ? updatedProduct : product
        )
      );
      
      toast.success('Product price updated successfully');
      
      // Reload stats
      const newStats = await productService.getVendorStats(vendor.Id);
      setStats(newStats);
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  };

const tabs = [
    { id: 'products', label: 'My Products', icon: 'Package' },
    { id: 'availability', label: 'Availability Confirmation', icon: 'CheckCircle', priority: 'critical' },
    { id: 'packing', label: 'Packing Station', icon: 'Package2', priority: 'critical' },
    { id: 'payment_verification', label: 'Payment Verification', icon: 'Receipt', priority: 'critical' },
    { id: 'fulfillment', label: 'Payment Flow', icon: 'CreditCard', priority: 'critical' },
    { id: 'orders', label: 'Active Orders', icon: 'ClipboardList' },
    { id: 'completed_orders', label: 'Completed Orders', icon: 'CheckCircle2' },
    { id: 'profile', label: 'Profile', icon: 'User' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center">
                <ApperIcon name="Store" size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Vendor Portal
                </h1>
                <p className="text-sm text-gray-600">
                  Welcome, {vendor.name}
                </p>
              </div>
            </div>
            
            <Button
              onClick={onLogout}
              variant="outline"
              size="sm"
            >
              <ApperIcon name="LogOut" size={16} className="mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ApperIcon name="Package" size={24} className="text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Products</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totalProducts}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ApperIcon name="TrendingUp" size={24} className="text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg. Margin</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.averageMargin}%</p>
                </div>
              </div>
            </div>
            
<div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <ApperIcon name="DollarSign" size={24} className="text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Value</p>
                  <p className="text-2xl font-semibold text-gray-900">{formatCurrency(stats.totalValue)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <ApperIcon name="AlertTriangle" size={24} className="text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Low Stock</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.lowStockCount}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow">
<div className="border-b border-gray-200">
            <nav className="flex flex-wrap gap-2 sm:space-x-8 overflow-x-auto pb-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 relative ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <ApperIcon name={tab.icon} size={16} />
                  <span>{tab.label}</span>
                  {tab.priority === 'critical' && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  )}
                </button>
              ))}
            </nav>
          </div>
          <div className="p-6">
            {loading ? (
              <Loading type="component" />
            ) : error ? (
              <Error message={error} />
) : (
              <>
                {activeTab === 'products' && (
                  <VendorProductsTab 
                    products={products}
                    vendor={vendor}
                    onProductUpdate={handleProductUpdate}
                  />
                )}
                {activeTab === 'availability' && (
                  <VendorAvailabilityTab 
                    vendor={vendor}
                  />
                )}
                {activeTab === 'packing' && (
                  <VendorPackingTab 
                    vendor={vendor}
                  />
                )}
                {activeTab === 'payment_verification' && (
                  <VendorPaymentVerificationTab 
                    vendor={vendor}
                  />
                )}
                {activeTab === 'fulfillment' && (
                  <VendorFulfillmentTab 
                    vendor={vendor}
                  />
                )}
                {activeTab === 'orders' && (
                  <VendorOrdersTab 
                    vendor={vendor}
                    showCompleted={false}
                  />
                )}
                {activeTab === 'completed_orders' && (
                  <VendorOrdersTab 
                    vendor={vendor}
                    showCompleted={true}
                  />
                )}
                {activeTab === 'profile' && (
                  <VendorProfileTab 
                    vendor={vendor}
                    onProfileUpdate={onProfileUpdate}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Vendor Products Tab Component
const VendorProductsTab = ({ products, vendor, onProductUpdate }) => {
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = [...new Set(products.map(p => p.category))];
  
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleEditPrice = (product) => {
    setEditingProduct(product);
  };

  const handleSavePrice = async (productId, priceData) => {
    try {
      await onProductUpdate(productId, priceData);
      setEditingProduct(null);
    } catch (error) {
      // Error handled in onProductUpdate
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon="Search"
          />
        </div>
        <div className="sm:w-48">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Current Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cost Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Margin
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stock
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProducts.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <img
                      className="h-10 w-10 rounded-lg object-cover"
                      src={product.imageUrl}
                      alt={product.name}
                    />
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {product.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {product.unit}
                      </div>
                    </div>
</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {product.category}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCurrency(product.price)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {product.purchasePrice ? formatCurrency(product.purchasePrice) : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    product.profitMargin >= 20 
                      ? 'bg-green-100 text-green-800'
                      : product.profitMargin >= 10
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {product.profitMargin?.toFixed(1) || '0'}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`text-sm ${
                    product.stock <= (product.minStock || 10)
                      ? 'text-red-600 font-medium'
                      : 'text-gray-900'
                  }`}>
                    {product.stock}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <Button
                    onClick={() => handleEditPrice(product)}
                    variant="outline"
                    size="sm"
                    disabled={!product.vendorInfo?.canEditPrice}
                  >
                    <ApperIcon name="Edit" size={14} className="mr-1" />
                    Edit Price
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <ApperIcon name="Package" size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
          <p className="text-gray-500">
            {searchTerm || categoryFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'You have no assigned products yet.'
            }
          </p>
        </div>
      )}

      {/* Edit Price Modal */}
      {editingProduct && (
        <EditPriceModal
          product={editingProduct}
          vendor={vendor}
          onSave={handleSavePrice}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </div>
  );
};

// Edit Price and Stock Modal Component
const EditPriceModal = ({ product, vendor, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    price: product.price,
    purchasePrice: product.purchasePrice || 0,
    stock: product.stock || 0
  });
  const [loading, setLoading] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [errors, setErrors] = useState({});
  const [approvalStatus, setApprovalStatus] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const numericValue = name === 'stock' ? parseInt(value) || 0 : parseFloat(value) || 0;
    
    setFormData(prev => ({
      ...prev,
      [name]: numericValue
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Price validation
    if (formData.price <= 0) {
      newErrors.price = 'Price must be greater than 0';
    }
    
    // Purchase price validation
    if (formData.purchasePrice < 0) {
      newErrors.purchasePrice = 'Purchase price cannot be negative';
    }
    
    // Stock validation
    if (formData.stock < 0) {
      newErrors.stock = 'Stock cannot be negative';
    }
    
    // Selling price > buying price validation
    if (formData.purchasePrice > 0 && formData.price <= formData.purchasePrice) {
      newErrors.price = 'Selling price must be greater than purchase price';
    }
    
    // Margin validation
    const margin = formData.purchasePrice > 0 
      ? ((formData.price - formData.purchasePrice) / formData.purchasePrice) * 100 
      : 0;
    
    if (margin < (product.vendorInfo?.minMargin || 5)) {
      newErrors.price = `Minimum margin required: ${product.vendorInfo?.minMargin || 5}%`;
    }
    
    // Max 20% price change validation
    const priceChangePercent = Math.abs(((formData.price - product.price) / product.price) * 100);
    if (priceChangePercent > 20) {
      newErrors.price = 'Maximum 20% price change allowed per update';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDirectSave = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    try {
      await onSave(product.id, formData);
    } catch (error) {
      // Error handled in onSave
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!validateForm()) {
      return;
    }
    
    setSubmittingApproval(true);
    try {
      // Simulate submission for approval
      const approvalData = {
        productId: product.id,
        vendorId: vendor.Id,
        changes: formData,
        requestedAt: new Date().toISOString(),
        reason: 'Price update approval request'
      };
      
      await productService.submitPriceApproval(approvalData);
      setApprovalStatus('submitted');
      toast.success('Price update submitted for approval');
    } catch (error) {
      console.error('Error submitting approval:', error);
      toast.error('Failed to submit for approval');
    } finally {
      setSubmittingApproval(false);
    }
  };

  const calculatePriceChange = () => {
    if (product.price > 0) {
      return ((formData.price - product.price) / product.price) * 100;
    }
    return 0;
  };

  const hasChanges = formData.price !== product.price || 
                    formData.stock !== product.stock || 
                    formData.purchasePrice !== (product.purchasePrice || 0);

  const margin = formData.purchasePrice > 0 
    ? ((formData.price - formData.purchasePrice) / formData.purchasePrice) * 100 
    : 0;
return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Edit Product Price
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <ApperIcon name="X" size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Price Input */}
          <div>
            <Input
              type="number"
              name="price"
              label="Selling Price (Rs.)"
              value={formData.price}
              onChange={handleInputChange}
              error={errors.price}
              required
            />
          </div>

          {/* Purchase Price Input */}
          <div>
            <Input
              type="number"
              name="purchasePrice"
              label="Purchase Price (Rs.)"
              value={formData.purchasePrice}
              onChange={handleInputChange}
              error={errors.purchasePrice}
            />
          </div>

          {/* Stock Input */}
          <div>
            <Input
              type="number"
              name="stock"
              label="Stock Quantity"
              value={formData.stock}
              onChange={handleInputChange}
              error={errors.stock}
              required
            />
          </div>

          {/* Summary */}
          {hasChanges && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">
                  Profit Margin:
                </span>
                <span className={`text-sm font-semibold ${
                  margin >= 20 ? 'text-green-600' : margin >= 10 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {margin.toFixed(1)}%
                </span>
              </div>

              {/* Price Change */}
              {formData.price !== product.price && (
<div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">
                    Price Change:
                  </span>
                  <span className={`text-sm font-semibold ${
                    Math.abs(calculatePriceChange()) <= 20
                      ? 'text-blue-600'
                      : 'text-red-600'
                  }`}>
                    {calculatePriceChange() > 0 ? '+' : ''}{calculatePriceChange().toFixed(1)}%
                  </span>
                </div>
              )}

              {/* Stock Change */}
              {formData.stock !== product.stock && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">
                    Stock Change:
                  </span>
                  <span className="text-sm font-semibold text-blue-600">
                    {formData.stock - product.stock > 0 ? '+' : ''}{formData.stock - product.stock} units
                  </span>
                </div>
              )}

              <div className="text-xs text-gray-500 pt-2 border-t">
                Min margin: {product.vendorInfo?.minMargin || 5}% • 
                Max price change: 20% • 
                Profit: {formData.purchasePrice > 0 && formData.price > formData.purchasePrice ? 
                  formatCurrency(formData.price - formData.purchasePrice) : 'Rs. 0'}
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex flex-col space-y-3 pt-4">
            {/* Submit for Approval Button */}
            <Button
              type="button"
              onClick={handleSubmitForApproval}
              variant="primary"
              className="w-full"
              disabled={!hasChanges || submittingApproval || Object.keys(errors).length > 0}
            >
              {submittingApproval ? (
                <>
                  <ApperIcon name="Loader2" size={16} className="animate-spin mr-2" />
                  Submitting for Approval...
                </>
              ) : (
                <>
                  <ApperIcon name="Send" size={16} className="mr-2" />
                  Submit for Approval
                </>
              )}
            </Button>

            {/* Direct Save and Cancel buttons */}
            <div className="flex space-x-3">
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDirectSave}
                variant="ghost"
                className="flex-1"
                disabled={!hasChanges || loading || Object.keys(errors).length > 0}
              >
                {loading ? (
                  <>
                    <ApperIcon name="Loader2" size={16} className="animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Direct'
                )}
              </Button>
            </div>
          </div>

          {/* Validation Summary */}
          {Object.keys(errors).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center mb-2">
                <ApperIcon name="AlertCircle" size={16} className="text-red-600 mr-2" />
                <span className="text-sm font-medium text-red-800">Please fix the following issues:</span>
              </div>
              <ul className="text-sm text-red-700 space-y-1">
                {Object.values(errors).map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// VendorOrdersTab - Updated to show order history with availability status and completed orders
function VendorOrdersTab({ vendor, showCompleted = false }) {
  const [vendorOrders, setVendorOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOrders, setExpandedOrders] = useState(new Set());

  useEffect(() => {
    loadVendorOrders();
  }, [vendor.id, searchTerm, statusFilter, showCompleted]);

  async function loadVendorOrders() {
    try {
      setLoading(true);
      const vendorOrders = await orderService.getVendorOrders(vendor.id);
      
      // Filter by completion status
      const statusFilteredOrders = vendorOrders.filter(order => {
        const completedStatuses = ['delivered', 'cancelled'];
        const isCompleted = completedStatuses.includes(order.status);
        return showCompleted ? isCompleted : !isCompleted;
      });
      
      const filteredOrders = statusFilteredOrders.filter(order => {
        const matchesSearch = searchTerm === '' || 
          order.id.toString().includes(searchTerm) ||
          order.deliveryAddress?.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
        return matchesSearch && matchesStatus;
      });
      
      setVendorOrders(filteredOrders);
    } catch (error) {
      console.error('Error loading vendor orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }

  const toggleOrderExpansion = (orderId) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  async function handleAvailabilityUpdate(orderId, productId, available, notes = '') {
    try {
      const key = `${orderId}-${productId}`;
      const availability = available ? 'available' : 'unavailable';
      
      await orderService.updateVendorAvailability(orderId, vendor.id, productId, {
        availability,
        notes,
        responseTimestamp: new Date().toISOString()
      });
      
      toast.success(`Product marked as ${availability}`);
      loadVendorOrders();
    } catch (error) {
      console.error('Error updating availability:', error);
      toast.error('Failed to update availability');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            {showCompleted ? 'Completed Orders' : 'Active Orders'}
          </h2>
          <p className="text-sm text-gray-600">
            {showCompleted 
              ? 'View completed and cancelled orders with full status history' 
              : 'Track and manage your active order requests'
            }
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative">
            <ApperIcon name="Search" size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            {!showCompleted && (
              <>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="packed">Packed</option>
                <option value="shipped">Shipped</option>
              </>
            )}
            {showCompleted && (
              <>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </>
            )}
          </select>
        </div>
      </div>

      {vendorOrders.length === 0 ? (
        <div className="text-center py-12">
          <ApperIcon name="ClipboardList" size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Orders Found</h3>
          <p className="text-gray-500">
            {searchTerm || statusFilter !== 'all' 
              ? 'No orders match your current filters.' 
              : showCompleted 
                ? 'No completed orders yet.'
                : 'You have no active orders.'
            }
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {vendorOrders.map(order => {
            const vendorItems = order.items?.filter(item => 
              (item.productId % 3 + 1) === parseInt(vendor.id)
            ) || [];
            
            if (vendorItems.length === 0) return null;
            
            const isPacked = order.status === 'packed' || order.status === 'shipped' || order.status === 'delivered';
            const allItemsPhotoSkipped = vendorItems.every(item => 
              order.packingInfo?.skippedFields?.photo === true
            );
            const isExpanded = expandedOrders.has(order.id);
            
            return (
              <div key={order.id} className="bg-white rounded-xl shadow-card border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-800">
                          Order #{order.id}
                        </h3>
                        <div className="flex items-center gap-2">
                          {getOrderStatusBadge(order)}
                          <ApperIcon name="Clock" size={16} className="text-gray-400" />
                          <span className="text-sm text-gray-500">  
                            {format(new Date(order.createdAt), 'MMM dd, yyyy • hh:mm a')}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <ApperIcon name="User" size={16} />
                          <span>{order.deliveryAddress?.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ApperIcon name="MapPin" size={16} />
                          <span>{order.deliveryAddress?.city}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ApperIcon name="Phone" size={16} />
                          <span>{order.deliveryAddress?.phone}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-800">
                          {formatCurrency(order.total)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {vendorItems.length} item{vendorItems.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      
                      {(showCompleted || order.statusHistory) && (
                        <Button
                          variant="outline"
                          onClick={() => toggleOrderExpansion(order.id)}
                          className="flex items-center gap-2"
                        >
                          <ApperIcon name="History" size={16} />
                          {isExpanded ? 'Hide Timeline' : 'View Timeline'}
                          <ApperIcon 
                            name={isExpanded ? "ChevronUp" : "ChevronDown"} 
                            size={16} 
                          />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Timeline Section - Show when expanded */}
                  {isExpanded && (
                    <div className="border-t pt-6 mb-6">
                      <OrderStatusTimeline order={order} />
                    </div>
                  )}

                  {/* Vendor Items Section */}
                  <div className="border-t pt-6">
                    <h4 className="font-medium text-gray-800 mb-4 flex items-center">
                      <ApperIcon name="Package" size={18} className="mr-2 text-blue-600" />
                      Your Items in this Order
                    </h4>
                    
                    <div className="grid gap-3">
                      {vendorItems.map((item) => (
                        <div key={item.productId} className="p-3 bg-gray-50 rounded-lg border">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-medium text-gray-900">{item.name}</h5>
                              <p className="text-sm text-gray-600">
                                {item.quantity} {item.unit} × {formatCurrency(item.price)}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-gray-900">
                                {formatCurrency(item.price * item.quantity)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// Get order status badge helper function
const getOrderStatusBadge = (order) => {
  const statusColors = {
    'pending': 'bg-yellow-100 text-yellow-800',
    'confirmed': 'bg-blue-100 text-blue-800',
    'packed': 'bg-purple-100 text-purple-800',
    'shipped': 'bg-indigo-100 text-indigo-800',
    'delivered': 'bg-green-100 text-green-800',
    'cancelled': 'bg-red-100 text-red-800'
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
      {order.status?.toUpperCase() || 'UNKNOWN'}
    </span>
  );
};

// Format date helper function
const format = (date, formatString) => {
  const d = new Date(date);
  if (formatString === 'MMM dd, yyyy • hh:mm a') {
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: '2-digit', 
      year: 'numeric' 
    }) + ' • ' + d.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    });
  }
  return d.toLocaleDateString();
};

// Vendor Profile Tab Component
const VendorProfileTab = ({ vendor, onProfileUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: vendor.name,
    email: vendor.email,
    company: vendor.company || '',
    phone: vendor.phone || '',
    address: vendor.address || ''
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const updatedProfile = await vendorService.updateVendorProfile(vendor.Id, formData);
      onProfileUpdate(updatedProfile);
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: vendor.name,
      email: vendor.email,
      company: vendor.company || '',
      phone: vendor.phone || '',
      address: vendor.address || ''
    });
    setIsEditing(false);
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>
          {!isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              size="sm"
            >
              <ApperIcon name="Edit" size={16} className="mr-2" />
              Edit Profile
            </Button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                name="name"
                label="Full Name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
              <Input
                type="email"
                name="email"
                label="Email Address"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                name="company"
                label="Company Name"
                value={formData.company}
                onChange={handleInputChange}
              />
              <Input
                type="tel"
                name="phone"
                label="Phone Number"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </div>
            
            <Input
              type="text"
              name="address"
              label="Address"
              value={formData.address}
              onChange={handleInputChange}
            />

            <div className="flex space-x-3 pt-4">
              <Button
                type="button"
                onClick={handleCancel}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <ApperIcon name="Loader2" size={16} className="animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <p className="text-sm text-gray-900">{vendor.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <p className="text-sm text-gray-900">{vendor.email}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name
                </label>
                <p className="text-sm text-gray-900">{vendor.company || 'Not specified'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <p className="text-sm text-gray-900">{vendor.phone || 'Not specified'}</p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <p className="text-sm text-gray-900">{vendor.address || 'Not specified'}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Permissions
              </label>
              <div className="flex flex-wrap gap-2">
                {vendor.permissions?.map((permission) => (
                  <span
                    key={permission}
                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
                  >
                    {permission.replace('_', ' ')}
                  </span>
))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Enhanced Vendor Availability Tab Component
const VendorAvailabilityTab = ({ vendor }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [bulkAvailability, setBulkAvailability] = useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);

  useEffect(() => {
    loadPendingAvailabilityOrders();
    
    // Phase 1: Real-time order sync - WebSocket listener for immediate order updates
    const handleOrderUpdate = (data) => {
      if (data.type === 'order_created_immediate' || data.type === 'real_time_order_notification') {
        loadPendingAvailabilityOrders();
        toast.info(`New order #${data.orderId} requires immediate attention`, {
          icon: '🕐',
          autoClose: 5000
        });
      }
    };

    // Subscribe to real-time order updates
    let unsubscribe;
    if (typeof window !== 'undefined' && window.webSocketService) {
      unsubscribe = window.webSocketService.subscribe('order_created_immediate', handleOrderUpdate);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [vendor]);

const loadPendingAvailabilityOrders = async () => {
    if (!vendor) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Load both pending availability requests and immediate visibility orders
      const pendingOrders = await orderService.getPendingAvailabilityRequests();
      const allOrders = await orderService.getAll();
      
      // Phase 1: Include orders with immediate vendor visibility - NEW ORDERS PRIORITIZED
      const immediateOrders = allOrders.filter(order => 
        order.vendor_visibility === 'immediate' && 
        (order.status === 'awaiting_payment_verification' || order.status === 'pending')
      );
      
      // Combine and deduplicate orders
      const combinedOrders = [...pendingOrders, ...immediateOrders];
      const uniqueOrders = combinedOrders.filter((order, index, self) => 
        index === self.findIndex(o => o.id === order.id)
      );
      
      const vendorOrders = uniqueOrders.filter(order => {
        return order.items?.some(item => (item.productId % 3 + 1) === vendor.Id);
      });
      
      // Sort orders - new orders (awaiting payment verification) appear at TOP with highest priority
      const sortedOrders = vendorOrders.sort((a, b) => {
        // Priority 1: New orders awaiting payment verification (RED PRIORITY)
        if (a.status === 'awaiting_payment_verification' && b.status !== 'awaiting_payment_verification') return -1;
        if (b.status === 'awaiting_payment_verification' && a.status !== 'awaiting_payment_verification') return 1;
        
        // Priority 2: Most recent orders first
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      
      setOrders(sortedOrders);
    } catch (error) {
      console.error('Error loading availability orders:', error);
      setError(error.message);
      toast.error('Failed to load pending orders');
    } finally {
      setLoading(false);
    }
  };

  const handleAvailabilityUpdate = async (orderId, productId, available, notes = '') => {
    try {
      await orderService.updateVendorAvailability(orderId, vendor.Id, productId, {
        available,
        notes,
        timestamp: new Date().toISOString(),
        responseDeadline: getResponseDeadline()
      });
      
      await loadPendingAvailabilityOrders();
      toast.success(`Product availability updated successfully`);
    } catch (error) {
      toast.error('Failed to update availability: ' + error.message);
    }
  };

  const handleBulkAvailabilityUpdate = async () => {
    if (selectedOrders.length === 0 || bulkAvailability === null) {
      toast.error('Please select orders and availability status');
      return;
    }

    try {
      setLoading(true);
      const updatePromises = selectedOrders.map(orderId => {
        const order = orders.find(o => o.id === orderId);
        const vendorProducts = order.items.filter(item => (item.productId % 3 + 1) === vendor.Id);
        
        return Promise.all(vendorProducts.map(item => 
          orderService.updateVendorAvailability(orderId, vendor.Id, item.productId, {
            available: bulkAvailability,
            notes: `Bulk ${bulkAvailability ? 'confirmed' : 'declined'} availability`,
            timestamp: new Date().toISOString()
          })
        ));
      });

      await Promise.all(updatePromises);
      await loadPendingAvailabilityOrders();
      
      setSelectedOrders([]);
      setBulkAvailability(null);
      setShowBulkModal(false);
      toast.success(`Bulk availability ${bulkAvailability ? 'confirmed' : 'declined'} for ${selectedOrders.length} orders`);
    } catch (error) {
      toast.error('Bulk update failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getResponseDeadline = () => {
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 2); // 2 hour response time
    return deadline.toISOString();
  };

  const getDeadlineStatus = (createdAt) => {
    const created = new Date(createdAt);
    const deadline = new Date(created.getTime() + 2 * 60 * 60 * 1000); // 2 hours
    const now = new Date();
    const timeLeft = deadline - now;
    
    if (timeLeft <= 0) return { status: 'overdue', color: 'bg-red-100 text-red-800', timeLeft: 'Overdue' };
    if (timeLeft <= 30 * 60 * 1000) return { status: 'urgent', color: 'bg-orange-100 text-orange-800', timeLeft: `${Math.ceil(timeLeft / (60 * 1000))}m left` };
    return { status: 'normal', color: 'bg-green-100 text-green-800', timeLeft: `${Math.ceil(timeLeft / (60 * 1000))}m left` };
  };

  const getAvailabilityStatus = (order, productId) => {
    if (!order.vendor_availability) return 'pending';
    const key = `${productId}_${vendor.Id}`;
    const availability = order.vendor_availability[key];
    
    if (!availability) return 'pending';
    return availability.available ? 'available' : 'unavailable';
  };

  const getProductCardColor = (order, productId) => {
    const status = getAvailabilityStatus(order, productId);
    switch (status) {
      case 'available': return 'border-l-4 border-l-green-500 bg-green-50';
      case 'unavailable': return 'border-l-4 border-l-red-500 bg-red-50';
      default: return 'border-l-4 border-l-yellow-500 bg-yellow-50';
    }
  };

// Phase 1: Enhanced status display for immediate visibility orders
  const getOrderStatusBadge = (order) => {
    if (order.vendor_visibility === 'immediate') {
      if (order.status === 'awaiting_payment_verification') {
        return (
          <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full flex items-center animate-pulse">
            <ApperIcon name="AlertCircle" size={12} className="mr-1" />
            🔴 NEW ORDER - IMMEDIATE ATTENTION
          </span>
        );
      }
    }
    return null;
  };

  const filteredOrders = orders.filter(order => 
    order.id.toString().includes(searchTerm) ||
    order.deliveryAddress?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <Loading type="component" />;
  if (error) return <Error message={error} />;

  return (
    <div className="space-y-6">
      {/* Header with Stats - Phase 1 Enhanced */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Real-time Order Sync & Availability</h2>
            <p className="text-blue-100">Phase 1: Immediate order visibility • Respond within 2 hours</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{filteredOrders.length}</div>
            <div className="text-blue-100">Pending Responses</div>
            <div className="text-xs text-blue-200 mt-1">
              <ApperIcon name="Zap" size={12} className="inline mr-1" />
              Real-time sync active
            </div>
          </div>
        </div>
      </div>

      {/* Search and Bulk Actions */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon="Search"
          />
        </div>
        {selectedOrders.length > 0 && (
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setBulkAvailability(true);
                setShowBulkModal(true);
              }}
              variant="primary"
              size="sm"
            >
              <ApperIcon name="CheckCircle" size={16} className="mr-2" />
              Bulk Confirm ({selectedOrders.length})
            </Button>
            <Button
              onClick={() => {
                setBulkAvailability(false);
                setShowBulkModal(true);
              }}
              variant="outline"
              size="sm"
            >
              <ApperIcon name="XCircle" size={16} className="mr-2" />
              Bulk Decline ({selectedOrders.length})
            </Button>
          </div>
        )}
      </div>

      {/* Orders List - Phase 1 Enhanced */}
      <div className="space-y-4">
        {filteredOrders.map((order) => {
          const deadline = getDeadlineStatus(order.createdAt);
          const vendorProducts = order.items?.filter(item => (item.productId % 3 + 1) === vendor.Id) || [];
          
return (
            <div key={order.id} className={`rounded-lg shadow-sm border overflow-hidden ${
              order.status === 'awaiting_payment_verification'
                ? 'bg-red-50 border-l-4 border-l-red-500 border-red-200' 
                : 'bg-white border-gray-200'
            }`}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOrders([...selectedOrders, order.id]);
                        } else {
                          setSelectedOrders(selectedOrders.filter(id => id !== order.id));
                        }
                      }}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <h3 className="font-semibold text-gray-900">Order #{order.id}</h3>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                      {order.deliveryAddress?.name || 'N/A'}
                    </span>
                    {/* Phase 1: Order status badge */}
                    {getOrderStatusBadge(order)}
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${deadline.color}`}>
                      <ApperIcon name="Clock" size={12} className="mr-1 inline" />
                      {deadline.timeLeft}
                    </span>
                    <span className="text-sm text-gray-600">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                {/* Product Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {vendorProducts.map((item) => (
                    <div key={item.productId} className={`p-3 rounded-lg border ${getProductCardColor(order, item.productId)}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900 text-sm">{item.name}</h4>
                        <span className="text-xs text-gray-600">{item.quantity} {item.unit}</span>
                      </div>
                      
                      {getAvailabilityStatus(order, item.productId) === 'pending' ? (
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleAvailabilityUpdate(order.id, item.productId, true)}
                            className="flex-1"
                          >
                            <ApperIcon name="CheckCircle" size={12} className="mr-1" />
                            Available
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAvailabilityUpdate(order.id, item.productId, false)}
                            className="flex-1"
                          >
                            <ApperIcon name="XCircle" size={12} className="mr-1" />
                            Out of Stock
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-medium ${
                            getAvailabilityStatus(order, item.productId) === 'available' 
                              ? 'text-green-700' 
                              : 'text-red-700'
                          }`}>
                            {getAvailabilityStatus(order, item.productId) === 'available' ? '✓ Confirmed' : '✗ Unavailable'}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const currentStatus = getAvailabilityStatus(order, item.productId);
                              handleAvailabilityUpdate(order.id, item.productId, currentStatus !== 'available');
                            }}
                          >
                            <ApperIcon name="RefreshCw" size={12} />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <ApperIcon name="CheckCircle" size={48} className="mx-auto text-green-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
          <p className="text-gray-500">No pending availability requests at the moment.</p>
          <p className="text-xs text-gray-400 mt-2">Real-time sync is active - new orders will appear instantly</p>
        </div>
      )}

      {/* Bulk Action Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Bulk {bulkAvailability ? 'Confirm' : 'Decline'} Availability
            </h3>
            <p className="text-gray-600 mb-6">
              This will {bulkAvailability ? 'confirm' : 'decline'} availability for all products in {selectedOrders.length} selected orders.
            </p>
            <div className="flex space-x-3">
              <Button
                onClick={() => setShowBulkModal(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkAvailabilityUpdate}
                variant={bulkAvailability ? "primary" : "secondary"}
                className="flex-1"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <ApperIcon name="Loader2" size={16} className="animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  `${bulkAvailability ? 'Confirm' : 'Decline'} All`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Enhanced Vendor Packing Tab Component
const VendorPackingTab = ({ vendor }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [packingData, setPackingData] = useState({});
  const [photoCapture, setPhotoCapture] = useState(null);

  useEffect(() => {
    loadPackingOrders();
  }, [vendor]);

  const loadPackingOrders = async () => {
    if (!vendor) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const fulfillmentOrders = await orderService.getFulfillmentOrders(vendor.Id);
      // Filter orders ready for packing (availability confirmed)
      const packingOrders = fulfillmentOrders.filter(order => 
        order.fulfillment_stage === 'availability_confirmed' || order.fulfillment_stage === 'packed'
      );
      setOrders(packingOrders);
    } catch (error) {
      console.error('Error loading packing orders:', error);
      setError(error.message);
      toast.error('Failed to load packing orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStartPacking = (order) => {
    setSelectedOrder(order);
setPackingData({
      orderId: order.id,
      items: order.items?.filter(item => (item.productId % 3 + 1) === vendor.Id).map(item => {
        const fieldConfig = productUnitService.getFieldConfig(item);
        return {
          ...item,
          packedQuantity: item.quantity,
          actualMeasurement: '',
          measurementSkipped: false,
          photoSkipped: false,
          verified: false,
          fieldConfig
        };
      }) || []
    });
  };
const handleItemVerification = (itemIndex, field, value) => {
    setPackingData(prev => ({
      ...prev,
      items: prev.items.map((item, index) => {
        if (index !== itemIndex) return item;
        
        const updatedItem = { ...item, [field]: value };
        
        // Auto-verify if measurement is skipped or not required
        if (field === 'measurementSkipped' && value) {
          updatedItem.actualMeasurement = '';
          updatedItem.verified = true; // Auto-verify when skipped
        }
        
        // Handle verification logic
        if (field === 'verified') {
          updatedItem.verified = value;
        } else if (field !== 'verified') {
          // Auto-verify if all required fields are completed or skipped
          const hasRequiredMeasurement = !productUnitService.isMeasurementRequired(item) || 
                                        updatedItem.measurementSkipped || 
                                        updatedItem.actualMeasurement;
          const hasRequiredPhoto = updatedItem.photoSkipped || photoCapture;
          
          if (hasRequiredMeasurement && hasRequiredPhoto) {
            updatedItem.verified = true;
          }
        }
        
        return updatedItem;
      })
    }));
  };

  const handlePhotoCapture = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoCapture({
          file: file,
          dataUrl: e.target.result,
          timestamp: new Date().toISOString()
        });
      };
      reader.readAsDataURL(file);
    }
  };
const handlePackingComplete = async () => {
    // Validate that all items are verified or properly skipped

    // Validate that all items are verified or properly skipped
    const invalidItems = packingData.items.filter(item => {
      if (!item.verified) return true;
      
      // Check if measurement is required but not provided or skipped
      if (productUnitService.isMeasurementRequired(item) && 
          !item.measurementSkipped && 
          !item.actualMeasurement) {
        return true;
      }
      
      return false;
    });
    
    if (invalidItems.length > 0) {
      toast.error('Please verify all items or skip optional fields before completing packing');
      return;
    }

    try {
      const packingInfo = {
        packingTimestamp: new Date().toISOString(),
        vendorId: vendor.Id,
        packedItems: packingData.items,
        totalMeasurement: packingData.items.reduce((sum, item) => {
          if (item.measurementSkipped) return sum;
          return sum + (parseFloat(item.actualMeasurement) || 0);
        }, 0),
        photo: photoCapture,
        photoSkipped: packingData.items.some(item => item.photoSkipped),
        qualityChecked: true,
        skippedFields: {
          measurement: packingData.items.filter(item => item.measurementSkipped).length,
          photo: packingData.items.some(item => item.photoSkipped)
        }
      };

      await orderService.updateFulfillmentStage(selectedOrder.id, 'packed', packingInfo);
      await loadPackingOrders();
      
      setSelectedOrder(null);
      setPackingData({});
      setPhotoCapture(null);
      toast.success('Order packed successfully!');
    } catch (error) {
      toast.error('Failed to complete packing: ' + error.message);
    }
  };

  const filteredOrders = orders.filter(order => 
    order.id.toString().includes(searchTerm) ||
    order.deliveryAddress?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <Loading type="component" />;
  if (error) return <Error message={error} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Digital Packing Station</h2>
            <p className="text-green-100">Pack confirmed orders with quality verification</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{filteredOrders.length}</div>
            <div className="text-green-100">Orders Ready</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon="Search"
          />
        </div>
      </div>

      {/* Orders List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredOrders.map((order) => {
          const vendorItems = order.items?.filter(item => (item.productId % 3 + 1) === vendor.Id) || [];
          const isPacked = order.fulfillment_stage === 'packed';
          
          return (
            <div key={order.id} className={`p-6 rounded-lg border-l-4 ${
              isPacked ? 'border-l-green-500 bg-green-50' : 'border-l-yellow-500 bg-yellow-50'
            } shadow-sm`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">Order #{order.id}</h3>
                  <p className="text-sm text-gray-600">{order.deliveryAddress?.name}</p>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  isPacked ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {isPacked ? '✓ Packed' : 'Ready for Packing'}
                </span>
              </div>
              
              <div className="space-y-2 mb-4">
                {vendorItems.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div>
                      <span className="font-medium text-gray-900">{item.name}</span>
                      <span className="text-sm text-gray-600 ml-2">{item.quantity} {item.unit}</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              
              {!isPacked && (
                <Button
                  onClick={() => handleStartPacking(order)}
                  variant="primary"
                  className="w-full"
                >
                  <ApperIcon name="Package" size={16} className="mr-2" />
                  Start Packing
                </Button>
              )}
              
              {isPacked && (
                <div className="flex items-center text-green-700">
                  <ApperIcon name="CheckCircle" size={16} className="mr-2" />
                  <span className="text-sm font-medium">Packed and verified</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <ApperIcon name="Package" size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders ready for packing</h3>
          <p className="text-gray-500">Orders will appear here once availability is confirmed.</p>
        </div>
      )}

      {/* Packing Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Packing Order #{selectedOrder.id}
              </h3>
            </div>
            
<div className="p-6 space-y-6">
              {/* Items Checklist */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Items Verification</h4>
                <div className="space-y-4">
                  {packingData.items?.map((item, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="font-medium text-gray-900">{item.name}</span>
                          <span className="text-sm text-gray-600 ml-2">({item.fieldConfig?.unit || item.unit})</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={item.verified}
                          onChange={(e) => handleItemVerification(index, 'verified', e.target.checked)}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </div>
                      
                      <div className="space-y-3">
                        {/* Quantity */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Packed Quantity
                          </label>
                          <input
                            type="number"
                            value={item.packedQuantity}
                            onChange={(e) => handleItemVerification(index, 'packedQuantity', parseInt(e.target.value))}
                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>

                        {/* Dynamic Measurement Field */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-medium text-gray-700">
                              <ApperIcon name={item.fieldConfig?.icon || 'Scale'} size={12} className="inline mr-1" />
                              {item.fieldConfig?.label || 'Weight (kg)'}
                              {!productUnitService.isMeasurementRequired(item) && (
                                <span className="text-gray-500 ml-1">(Optional)</span>
                              )}
                            </label>
                            
                            {!productUnitService.isMeasurementRequired(item) && (
                              <div className="flex items-center">
                                <Button
                                  onClick={() => handleItemVerification(index, 'measurementSkipped', !item.measurementSkipped)}
                                  variant={item.measurementSkipped ? "primary" : "outline"}
                                  size="sm"
                                  className="text-xs px-2 py-1"
                                >
                                  {item.measurementSkipped ? (
                                    <>
                                      <ApperIcon name="Check" size={10} className="mr-1" />
                                      Skipped
                                    </>
                                  ) : (
                                    <>
                                      <ApperIcon name="SkipForward" size={10} className="mr-1" />
                                      Skip
                                    </>
                                  )}
                                </Button>
                                
                                <div className="relative group ml-2">
                                  <ApperIcon name="Info" size={12} className="text-gray-400 cursor-help" />
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                    Optional - only if quality verification needed
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {!item.measurementSkipped && (
                            <input
                              type="number"
                              step="0.1"
                              value={item.actualMeasurement}
                              onChange={(e) => handleItemVerification(index, 'actualMeasurement', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                              placeholder={item.fieldConfig?.placeholder || 'Enter measurement'}
                              required={productUnitService.isMeasurementRequired(item)}
                            />
                          )}
                          
                          {item.measurementSkipped && (
                            <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                              <ApperIcon name="SkipForward" size={12} className="inline mr-1" />
                              Measurement skipped - quality verification not required
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Photo Capture - Optional */}
              <div>
              
              {/* Photo Capture - Optional */}
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">
                    Package Photo 
                    <span className="text-gray-500 text-sm font-normal ml-2">(Optional)</span>
                  </h4>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => {
                        const allItemsPhotoSkipped = !packingData.items.some(item => !item.photoSkipped);
                        packingData.items.forEach((_, index) => {
                          handleItemVerification(index, 'photoSkipped', !allItemsPhotoSkipped);
                        });
                        if (!allItemsPhotoSkipped) {
                          setPhotoCapture(null);
                        }
                      }}
                      variant={packingData.items.some(item => item.photoSkipped) ? "primary" : "outline"}
                      size="sm"
                    >
                      {packingData.items.some(item => item.photoSkipped) ? (
                        <>
                          <ApperIcon name="Check" size={12} className="mr-1" />
                          Photo Skipped
                        </>
                      ) : (
                        <>
                          <ApperIcon name="SkipForward" size={12} className="mr-1" />
                          Skip Photo
                        </>
                      )}
                    </Button>
                    
                    <div className="relative group">
                      <ApperIcon name="Info" size={14} className="text-gray-400 cursor-help" />
                      <div className="absolute bottom-full right-0 mb-2 px-3 py-2 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        Optional - only if quality verification needed
                      </div>
                    </div>
                  </div>
                </div>
                
                {!packingData.items.some(item => item.photoSkipped) && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    {photoCapture ? (
                      <div>
                        <img 
                          src={photoCapture.dataUrl} 
                          alt="Package" 
                          className="mx-auto max-h-32 rounded mb-2"
                        />
                        <p className="text-sm text-gray-600 mb-2">Photo captured</p>
                        <button
                          onClick={() => setPhotoCapture(null)}
                          className="text-red-600 text-xs hover:underline"
                        >
                          Remove Photo
                        </button>
                      </div>
                    ) : (
                      <div>
                        <ApperIcon name="Camera" size={32} className="mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600 mb-3">Capture package photo for quality verification</p>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoCapture}
                          className="hidden"
                          id="photo-capture"
                        />
                        <label
                          htmlFor="photo-capture"
                          className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg cursor-pointer hover:bg-primary-dark transition-colors"
                        >
                          <ApperIcon name="Camera" size={16} className="mr-2" />
                          Take Photo
                        </label>
                      </div>
                    )}
                  </div>
                )}
                
                {packingData.items.some(item => item.photoSkipped) && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                    <ApperIcon name="SkipForward" size={20} className="mx-auto text-yellow-600 mb-2" />
                    <p className="text-sm text-yellow-800 font-medium">Photo capture skipped</p>
                    <p className="text-xs text-yellow-700 mt-1">Quality verification not required for this order</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <Button
                onClick={() => {
                  setSelectedOrder(null);
                  setPackingData({});
                  setPhotoCapture(null);
                }}
                variant="outline"
              >
Cancel
              </Button>
              <Button
                onClick={handlePackingComplete}
                variant="primary"
                disabled={!packingData.items?.every(item => item.verified)}
              >
                <ApperIcon name="CheckCircle" size={16} className="mr-2" />
                Complete Packing
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Vendor Orders Tab Component
const VendorOrdersTab = ({ vendor }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');

  useEffect(() => {
    loadVendorOrders();
  }, [vendor]);

  const loadVendorOrders = async () => {
    if (!vendor) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const vendorOrders = await orderService.getVendorOrders(vendor.Id);
      setOrders(vendorOrders);
    } catch (error) {
      console.error('Error loading vendor orders:', error);
      setError(error.message);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleAvailabilityUpdate = async (orderId, productId, available, notes = '') => {
    try {
      await orderService.updateVendorAvailability(orderId, vendor.Id, productId, {
        available,
        notes,
        timestamp: new Date().toISOString()
      });
      
      // Reload orders to reflect changes
      await loadVendorOrders();
      
      toast.success(`Product availability updated successfully`);
    } catch (error) {
      toast.error('Failed to update availability: ' + error.message);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toString().includes(searchTerm) ||
                         order.deliveryAddress?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'pending' && order.status === 'pending') ||
                         (statusFilter === 'responded' && order.vendor_availability);
    
    return matchesSearch && matchesStatus;
  });

  const getAvailabilityStatus = (order, productId) => {
    if (!order.vendor_availability) return 'pending';
    const key = `${productId}_${vendor.Id}`;
    const availability = order.vendor_availability[key];
    
    if (!availability) return 'pending';
    return availability.available ? 'available' : 'unavailable';
  };

  if (loading) {
    return <Loading type="component" />;
  }

  if (error) {
    return <Error message={error} />;
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon="Search"
          />
        </div>
        <div className="sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="all">All Orders</option>
            <option value="pending">Pending Response</option>
            <option value="responded">Responded</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
{filteredOrders.map((order) => (
          <div key={order.id} className={`border rounded-lg overflow-hidden transition-all duration-200 ${
            // Color-code orders by status for better visual tracking
            order.status === 'pending' ? 'border-red-200 bg-red-50 shadow-red-100' :
            order.status === 'confirmed' || order.verificationStatus === 'verified' ? 'border-green-200 bg-green-50 shadow-green-100' :
            order.status === 'packed' ? 'border-yellow-200 bg-yellow-50 shadow-yellow-100' :
            order.status === 'shipped' ? 'border-blue-200 bg-blue-50 shadow-blue-100' :
            'border-gray-200 bg-white'
          }`}>
            <div className={`px-4 py-3 flex items-center justify-between ${
              order.status === 'pending' ? 'bg-red-100' :
              order.status === 'confirmed' || order.verificationStatus === 'verified' ? 'bg-green-100' :
              order.status === 'packed' ? 'bg-yellow-100' :
              order.status === 'shipped' ? 'bg-blue-100' :
              'bg-gray-50'
            }`}>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {/* Status indicator icon */}
                  <div className={`w-3 h-3 rounded-full ${
                    order.status === 'pending' ? 'bg-red-500 animate-pulse' :
                    order.status === 'confirmed' || order.verificationStatus === 'verified' ? 'bg-green-500' :
                    order.status === 'packed' ? 'bg-yellow-500' :
                    order.status === 'shipped' ? 'bg-blue-500' :
                    'bg-gray-400'
                  }`}></div>
                  <h3 className={`font-semibold ${
                    order.status === 'pending' ? 'text-red-900' :
                    order.status === 'confirmed' || order.verificationStatus === 'verified' ? 'text-green-900' :
                    order.status === 'packed' ? 'text-yellow-900' :
                    order.status === 'shipped' ? 'text-blue-900' :
                    'text-gray-900'
                  }`}>Order #{order.id}</h3>
                  
                  {/* Priority badge for pending orders */}
                  {order.status === 'pending' && (
                    <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse flex items-center">
                      <ApperIcon name="AlertTriangle" size={10} className="mr-1" />
                      URGENT
                    </span>
                  )}
                </div>
                
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  order.status === 'pending' ? 'bg-red-200 text-red-800' :
                  order.status === 'confirmed' || order.verificationStatus === 'verified' ? 'bg-green-200 text-green-800' :
                  'bg-blue-200 text-blue-800'
                }`}>
                  {order.deliveryAddress?.name || 'N/A'}
                </span>
              </div>
              <div className="text-sm text-gray-600 flex items-center space-x-2">
                <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                {/* Response deadline for pending orders */}
                {order.status === 'pending' && (
                  <span className="text-xs text-red-600 font-medium bg-red-100 px-2 py-1 rounded">
                    <ApperIcon name="Clock" size={10} className="mr-1 inline" />
                    {(() => {
                      const deadline = new Date(new Date(order.createdAt).getTime() + 30 * 60 * 1000);
                      const now = new Date();
                      const timeLeft = deadline - now;
                      const minutesLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60)));
                      return minutesLeft > 0 ? `${minutesLeft}m left` : 'OVERDUE';
                    })()}
                  </span>
                )}
              </div>
            </div>
            
            <div className="p-4">
              <div className="space-y-3">
                {order.items?.filter(item => 
                  // Filter items assigned to this vendor (simplified logic)
                  item.productId % 3 + 1 === vendor.Id
                ).map((item) => (
                  <div key={item.productId} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    getAvailabilityStatus(order, item.productId) === 'pending' ? 'bg-red-50 border border-red-100' :
                    getAvailabilityStatus(order, item.productId) === 'available' ? 'bg-green-50 border border-green-100' :
                    'bg-gray-50 border border-gray-100'
                  }`}>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.name}</h4>
                      <p className="text-sm text-gray-600">
                        Qty: {item.quantity} {item.unit} × {formatCurrency(item.price)}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-gray-900">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                      
                      {/* Enhanced Availability Status & Actions with colors */}
                      <div className="flex items-center space-x-2">
                        {getAvailabilityStatus(order, item.productId) === 'pending' ? (
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="primary"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleAvailabilityUpdate(order.id, item.productId, true)}
                            >
                              <ApperIcon name="CheckCircle" size={14} className="mr-1" />
                              Available
                            </Button>
                            <Button
                              size="sm"
                              variant="outline" 
                              className="border-red-300 text-red-600 hover:bg-red-50"
                              onClick={() => handleAvailabilityUpdate(order.id, item.productId, false)}
                            >
                              <ApperIcon name="XCircle" size={14} className="mr-1" />
                              Unavailable
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              getAvailabilityStatus(order, item.productId) === 'available' 
                                ? 'bg-green-100 text-green-800 border border-green-200' 
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}>
                              <ApperIcon 
                                name={getAvailabilityStatus(order, item.productId) === 'available' ? 'CheckCircle' : 'XCircle'} 
                                size={12} 
                                className="mr-1" 
                              />
                              {getAvailabilityStatus(order, item.productId) === 'available' ? 'Available' : 'Unavailable'}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="hover:bg-gray-100"
                              onClick={() => {
                                const currentStatus = getAvailabilityStatus(order, item.productId);
                                handleAvailabilityUpdate(order.id, item.productId, currentStatus !== 'available');
                              }}
                            >
                              <ApperIcon name="RefreshCw" size={14} />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <ApperIcon name="ClipboardList" size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-500">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'No orders requiring availability response yet.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

// Legacy Vendor Fulfillment Tab Component (kept for compatibility)
const VendorFulfillmentTab = ({ vendor }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  useEffect(() => {
    loadFulfillmentOrders();
  }, [vendor]);

  const loadFulfillmentOrders = async () => {
    if (!vendor) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const fulfillmentOrders = await orderService.getFulfillmentOrders(vendor.Id);
      setOrders(fulfillmentOrders);
    } catch (error) {
      console.error('Error loading fulfillment orders:', error);
      setError(error.message);
      toast.error('Failed to load fulfillment orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStageUpdate = async (orderId, newStage) => {
    try {
      await orderService.updateFulfillmentStage(orderId, newStage);
      await loadFulfillmentOrders();
      toast.success(`Order updated to ${newStage.replace('_', ' ')}`);
    } catch (error) {
      toast.error('Failed to update fulfillment stage: ' + error.message);
    }
  };

  const handlePackProducts = async (orderId) => {
    try {
      const updatedOrder = await orderService.updateFulfillmentStage(orderId, 'packed');
      await loadFulfillmentOrders();
      toast.success('Products packed successfully');
    } catch (error) {
      toast.error('Failed to pack products: ' + error.message);
    }
  };

  const handleProcessPayment = async (orderId) => {
    try {
      await orderService.updateFulfillmentStage(orderId, 'payment_processed');
      await loadFulfillmentOrders();
      toast.success('Payment processed');
    } catch (error) {
      toast.error('Failed to process payment: ' + error.message);
    }
  };

  const handleHandover = (order) => {
    setSelectedOrder(order);
    setShowSignatureModal(true);
  };

  const handleSignatureComplete = async (signatureData) => {
    try {
      await orderService.confirmHandover(selectedOrder.id, {
        signature: signatureData,
        vendorId: vendor.Id,
        timestamp: new Date().toISOString()
      });
      
      setShowSignatureModal(false);
      setSelectedOrder(null);
      await loadFulfillmentOrders();
      toast.success('Order handed over to delivery successfully');
    } catch (error) {
      toast.error('Failed to complete handover: ' + error.message);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toString().includes(searchTerm) ||
                         order.deliveryAddress?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStage = stageFilter === 'all' || order.fulfillment_stage === stageFilter;
    
    return matchesSearch && matchesStage;
  });

  const getStageColor = (stage) => {
    switch (stage) {
      case 'availability_confirmed': return 'bg-blue-100 text-blue-800';
      case 'packed': return 'bg-green-100 text-green-800';
      case 'payment_processed': return 'bg-yellow-100 text-yellow-800';
      case 'admin_paid': return 'bg-purple-100 text-purple-800';
      case 'handed_over': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCardColor = (stage) => {
    switch (stage) {
      case 'packed':
      case 'payment_processed':
      case 'admin_paid':
        return 'border-l-4 border-l-green-500 bg-green-50';
      case 'availability_confirmed':
        return 'border-l-4 border-l-yellow-500 bg-yellow-50';
      default:
        return 'border-l-4 border-l-gray-300 bg-white';
    }
  };

  const getNextAction = (stage) => {
    switch (stage) {
      case 'availability_confirmed':
        return { action: 'pack', label: 'Pack Products', icon: 'Package' };
      case 'packed':
        return { action: 'process_payment', label: 'Process Payment', icon: 'CreditCard' };
      case 'payment_processed':
        return { action: 'await_admin', label: 'Awaiting Admin Payment', icon: 'Clock', disabled: true };
      case 'admin_paid':
        return { action: 'handover', label: 'Handover to Delivery', icon: 'Truck' };
      case 'handed_over':
        return { action: 'completed', label: 'Completed', icon: 'CheckCircle', disabled: true };
      default:
        return null;
    }
  };

  if (loading) {
    return <Loading type="component" />;
  }

  if (error) {
    return <Error message={error} />;
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon="Search"
          />
        </div>
        <div className="sm:w-64">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="all">All Stages</option>
            <option value="availability_confirmed">Availability Confirmed</option>
            <option value="packed">Packed</option>
            <option value="payment_processed">Payment Processed</option>
            <option value="admin_paid">Admin Paid</option>
            <option value="handed_over">Handed Over</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.map((order) => {
          const nextAction = getNextAction(order.fulfillment_stage);
          
          return (
            <div key={order.id} className={`rounded-lg overflow-hidden shadow-sm ${getCardColor(order.fulfillment_stage)}`}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <h3 className="font-semibold text-gray-900">Order #{order.id}</h3>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStageColor(order.fulfillment_stage)}`}>
                      {order.fulfillment_stage?.replace('_', ' ').toUpperCase() || 'PENDING'}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                      {order.deliveryAddress?.name || 'N/A'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatCurrency(order.total)}
                  </div>
                </div>

                {/* Order Items */}
                <div className="mb-4">
                  <div className="space-y-2">
                    {order.items?.filter(item => 
                      (item.productId % 3 + 1) === vendor.Id
                    ).map((item) => (
                      <div key={item.productId} className="flex items-center justify-between p-2 bg-white rounded border">
                        <div>
                          <span className="font-medium text-gray-900">{item.name}</span>
                          <span className="text-sm text-gray-600 ml-2">
                            {item.quantity} {item.unit} × {formatCurrency(item.price)}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Assignment Info */}
                {order.assignedDelivery && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center mb-2">
                      <ApperIcon name="Truck" size={16} className="text-blue-600 mr-2" />
                      <span className="font-medium text-blue-900">Delivery Assignment</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Personnel:</span>
                        <span className="ml-2 font-medium">{order.assignedDelivery.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Phone:</span>
                        <span className="ml-2 font-medium">{order.assignedDelivery.phone}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">ETA:</span>
                        <span className="ml-2 font-medium">{order.assignedDelivery.eta}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Vehicle:</span>
                        <span className="ml-2 font-medium">{order.assignedDelivery.vehicle}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                {nextAction && (
                  <div className="flex justify-end">
                    <Button
                      onClick={() => {
                        if (nextAction.action === 'pack') {
                          handlePackProducts(order.id);
                        } else if (nextAction.action === 'process_payment') {
                          handleProcessPayment(order.id);
                        } else if (nextAction.action === 'handover') {
                          handleHandover(order);
                        }
                      }}
                      variant={nextAction.disabled ? "outline" : "primary"}
                      size="sm"
                      disabled={nextAction.disabled}
                    >
                      <ApperIcon name={nextAction.icon} size={16} className="mr-2" />
                      {nextAction.label}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <ApperIcon name="Truck" size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No fulfillment orders found</h3>
          <p className="text-gray-500">
            {searchTerm || stageFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'No orders require fulfillment processing yet.'
            }
          </p>
        </div>
      )}

      {/* Signature Modal */}
      {showSignatureModal && selectedOrder && (
        <SignatureModal
          order={selectedOrder}
          onSignatureComplete={handleSignatureComplete}
          onClose={() => {
            setShowSignatureModal(false);
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
};

// Signature Capture Modal Component
// Payment Verification Tab Component
function VendorPaymentVerificationTab({ vendor }) {
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    loadPendingVerifications();
  }, []);

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        handleAutoRefresh();
      }, 30000); // Auto-refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  async function loadPendingVerifications() {
    try {
      setLoading(true);
      const verifications = await orderService.getPendingVerifications();
      setPendingVerifications(verifications);
    } catch (error) {
      toast.error('Failed to load payment verifications');
      setPendingVerifications([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoRefresh() {
    try {
      setRefreshing(true);
      const verifications = await orderService.getPendingVerifications();
      const newCount = await orderService.getNewOrdersCount(lastRefresh);
      
      if (newCount > 0) {
        toast.success(`${newCount} new payment${newCount > 1 ? 's' : ''} to verify!`);
      }
      
      setPendingVerifications(verifications);
      setLastRefresh(Date.now());
    } catch (error) {
      toast.error('Auto-refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleManualRefresh() {
    await handleAutoRefresh();
    toast.info('Payment verifications refreshed');
  }

  async function handleVerificationUpdate(orderId, status, notes = '') {
    try {
      await orderService.updateVerificationStatus(orderId, status, notes);
      toast.success(`Payment ${status === 'verified' ? 'approved' : 'rejected'} successfully`);
      await loadPendingVerifications();
    } catch (error) {
      toast.error(`Failed to ${status === 'verified' ? 'approve' : 'reject'} payment`);
    }
  }

  if (loading) {
    return <Loading type="component" />;
  }

  return (
    <div className="space-y-6">
      {/* Header with Auto-Refresh Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Payment Verification</h2>
          <p className="text-gray-600 text-sm">
            Review and verify payment proofs from customers
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <input
              id="auto-refresh"
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <label htmlFor="auto-refresh" className="text-sm text-gray-700">
              Auto-refresh
            </label>
          </div>
          
          <Button
            onClick={handleManualRefresh}
            disabled={refreshing}
            variant="outline"
            size="small"
            className="flex items-center space-x-2"
          >
            <ApperIcon 
              name="RefreshCw" 
              size={16} 
              className={refreshing ? 'animate-spin' : ''} 
            />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <ApperIcon name="Clock" size={20} className="text-yellow-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-yellow-800">Pending</p>
              <p className="text-2xl font-bold text-yellow-900">
                {pendingVerifications.filter(v => v.verificationStatus === 'pending').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <ApperIcon name="CheckCircle" size={20} className="text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-green-800">Verified Today</p>
              <p className="text-2xl font-bold text-green-900">
                {pendingVerifications.filter(v => v.verificationStatus === 'verified').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <ApperIcon name="DollarSign" size={20} className="text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-blue-800">Total Amount</p>
              <p className="text-2xl font-bold text-blue-900">
                {formatCurrency(pendingVerifications.reduce((sum, v) => sum + v.amount, 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Verifications List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Pending Payment Verifications ({pendingVerifications.length})
          </h3>
        </div>
        
        <div className="divide-y divide-gray-200">
          {pendingVerifications.length === 0 ? (
            <div className="p-8 text-center">
              <ApperIcon name="CheckCircle" size={48} className="text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No pending payment verifications</p>
              <p className="text-gray-400 text-sm">All payments have been processed</p>
            </div>
          ) : (
            pendingVerifications.map((verification) => (
              <div key={verification.orderId} className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-medium text-gray-900">
                        Order #{verification.orderId}
                      </h4>
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        verification.statusColor === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                        verification.statusColor === 'green' ? 'bg-green-100 text-green-800' :
                        verification.statusColor === 'red' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {verification.statusLabel}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Customer</p>
                        <p className="font-medium text-gray-900">{verification.customerName}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Amount</p>
                        <p className="font-medium text-gray-900">{formatCurrency(verification.amount)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Payment Method</p>
                        <p className="font-medium text-gray-900 capitalize">{verification.paymentMethod}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Transaction ID</p>
                        <p className="font-medium text-gray-900">{verification.transactionId}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                    {verification.paymentProof && (
                      <div className="flex-shrink-0">
                        <img
                          src={verification.paymentProof}
                          alt="Payment proof"
                          className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                        />
                      </div>
                    )}
                    
                    {verification.canProcess && (
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => handleVerificationUpdate(verification.orderId, 'rejected')}
                          variant="outline"
                          size="small"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          <ApperIcon name="X" size={16} className="mr-1" />
                          Reject
                        </Button>
                        <Button
                          onClick={() => handleVerificationUpdate(verification.orderId, 'verified')}
                          variant="primary"
                          size="small"
                        >
                          <ApperIcon name="Check" size={16} className="mr-1" />
                          Verify
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const SignatureModal = ({ order, onSignatureComplete, onClose }) => {
  const canvasRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [signature, setSignature] = React.useState(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
    }
  }, []);

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const signatureData = canvas.toDataURL();
    setSignature(signatureData);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
  };

  const handleSubmit = () => {
    if (!signature) {
      toast.error('Please provide your signature');
      return;
    }
    onSignatureComplete(signature);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Handover Signature
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <ApperIcon name="X" size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-700 mb-2">
              <strong>Order:</strong> #{order.id}
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Customer:</strong> {order.deliveryAddress?.name}
            </p>
            <p className="text-sm text-gray-700">
              <strong>Total:</strong> {formatCurrency(order.total)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendor Signature
            </label>
            <div className="border-2 border-gray-300 rounded-lg">
              <canvas
                ref={canvasRef}
                width={350}
                height={150}
                className="w-full cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Sign above to confirm handover to delivery personnel
            </p>
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={clearSignature}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <ApperIcon name="RotateCcw" size={16} className="mr-2" />
              Clear
            </Button>
            <Button
              onClick={handleSubmit}
              variant="primary"
              size="sm"
              className="flex-1"
              disabled={!signature}
            >
              <ApperIcon name="Check" size={16} className="mr-2" />
              Confirm Handover
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorPortal;