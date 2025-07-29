import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { paymentService } from "@/services/api/paymentService";
import { productService } from "@/services/api/productService";
import { vendorService } from "@/services/api/vendorService";
import ApperIcon from "@/components/ApperIcon";
import ProductAssignment from "@/components/molecules/ProductAssignment";
import Loading from "@/components/ui/Loading";
import Error from "@/components/ui/Error";
import Badge from "@/components/atoms/Badge";
import Input from "@/components/atoms/Input";
import Button from "@/components/atoms/Button";

// Enhanced error boundary for component stability
function VendorManagement() {
  // State management
  const [vendors, setVendors] = useState([])
  const [filteredVendors, setFilteredVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isEditing, setIsEditing] = useState(false)
  const [editingVendor, setEditingVendor] = useState(null)
  const [availableProducts, setAvailableProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    category: '',
    status: 'active'
  })

  // Payment proof management state
  const [paymentQueue, setPaymentQueue] = useState([])
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [uploadingProof, setUploadingProof] = useState(null)
  const [proofFile, setProofFile] = useState(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [verificationNotes, setVerificationNotes] = useState('')
  const fileInputRef = useRef(null)

  // Load vendors on component mount with error handling
  useEffect(() => {
    loadVendors()
    loadAvailableProducts()
    loadPaymentQueue()
  }, [])

  // Filter vendors based on search and status with error handling
  useEffect(() => {
    try {
      const filtered = vendors.filter(vendor => {
        if (!vendor) return false
        
        const matchesSearch = vendor.name?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
                             vendor.email?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
                             vendor.category?.toLowerCase()?.includes(searchTerm.toLowerCase())
        
        const matchesStatus = statusFilter === 'all' || vendor.status === statusFilter
        
        return matchesSearch && matchesStatus
      })
      setFilteredVendors(filtered)
    } catch (error) {
      console.error('Error filtering vendors:', error)
      setFilteredVendors(vendors) // Fallback to show all vendors
    }
  }, [vendors, searchTerm, statusFilter])

  // Load available products with error handling
  async function loadAvailableProducts() {
    try {
      setProductsLoading(true)
      setError(null)
      const data = await productService.getAllProducts()
      setAvailableProducts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading products:', error)
      setError(error?.message || 'Failed to load products')
      setAvailableProducts([])
      toast.error('Failed to load products')
    } finally {
      setProductsLoading(false)
    }
  }

  // Load vendors with comprehensive error handling
  async function loadVendors() {
    try {
      setLoading(true)
      setError(null)
      const data = await vendorService.getAllVendors()
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid vendor data received')
      }
      
      setVendors(data)
      setFilteredVendors(data)
    } catch (error) {
      console.error('Error loading vendors:', error)
      setError(error?.message || 'Failed to load vendors')
      setVendors([])
      setFilteredVendors([])
      toast.error('Failed to load vendors')
    } finally {
      setLoading(false)
    }
  }

  // Search handler with validation
  function handleSearch(e) {
    try {
      const value = e?.target?.value || ''
      setSearchTerm(value)
    } catch (error) {
      console.error('Error handling search:', error)
      setSearchTerm('')
    }
  }

  // Status filter handler with validation  
  function handleStatusFilter(status) {
    try {
      if (typeof status === 'string') {
        setStatusFilter(status)
      }
    } catch (error) {
      console.error('Error handling status filter:', error)
      setStatusFilter('all')
    }
  }

  // Form reset with error handling
  function resetForm() {
    try {
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        category: '',
        status: 'active'
      })
      setIsEditing(false)
      setEditingVendor(null)
    } catch (error) {
      console.error('Error resetting form:', error)
      // Force reset even if error occurs
      setIsEditing(false)
      setEditingVendor(null)
    }
  }

  // Edit vendor with validation
  async function handleEdit(vendor) {
    try {
      if (!vendor?.id) {
        throw new Error('Invalid vendor data')
      }

      setEditingVendor(vendor)
      setFormData({
        name: vendor.name || '',
        email: vendor.email || '',
        phone: vendor.phone || '',
        address: vendor.address || '',
        category: vendor.category || '',
        status: vendor.status || 'active'
      })
      setIsEditing(true)
    } catch (error) {
      console.error('Error editing vendor:', error)
      toast.error('Error loading vendor data')
    }
  }

  // Form submission with comprehensive validation
  async function handleSubmit(e) {
    e?.preventDefault()
    
    try {
      // Validate form data
      if (!formData.name?.trim()) {
        throw new Error('Vendor name is required')
      }
      if (!formData.email?.trim()) {
        throw new Error('Email is required')
      }
      if (!formData.phone?.trim()) {
        throw new Error('Phone is required')
      }

      setLoading(true)
      
      let result
      if (isEditing && editingVendor?.id) {
        result = await vendorService.updateVendor(editingVendor.id, formData)
        toast.success('Vendor updated successfully')
      } else {
        result = await vendorService.createVendor(formData)
        toast.success('Vendor created successfully')
      }

      if (result) {
        await loadVendors()
        resetForm()
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      toast.error(error?.message || 'Failed to save vendor')
    } finally {
      setLoading(false)
    }
  }

  // Delete vendor with confirmation
  async function handleDelete(vendor) {
    try {
      if (!vendor?.id) {
        throw new Error('Invalid vendor')
      }

      if (!window.confirm(`Are you sure you want to delete ${vendor.name}?`)) {
        return
      }

      setLoading(true)
      await vendorService.deleteVendor(vendor.id)
      toast.success('Vendor deleted successfully')
      await loadVendors()
    } catch (error) {
      console.error('Error deleting vendor:', error)
      toast.error(error?.message || 'Failed to delete vendor')
    } finally {
      setLoading(false)
    }
  }

  // Toggle vendor status with validation
  async function handleToggleStatus(vendor) {
    try {
      if (!vendor?.id) {
        throw new Error('Invalid vendor')
      }

      const newStatus = vendor.status === 'active' ? 'inactive' : 'active'
      const updateData = { ...vendor, status: newStatus }
      
      setLoading(true)
      await vendorService.updateVendor(vendor.id, updateData)
      toast.success(`Vendor ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
      await loadVendors()
    } catch (error) {
      console.error('Error toggling status:', error)
      toast.error(error?.message || 'Failed to update vendor status')
    } finally {
      setLoading(false)
    }
  }

  // Form change handler with validation
  function handleFormChange(e) {
    try {
      const { name, value } = e?.target || {}
      if (name && value !== undefined) {
        setFormData(prev => ({ ...prev, [name]: value }))
      }
    } catch (error) {
      console.error('Error handling form change:', error)
    }
  }

  // Load payment queue with error handling
  async function loadPaymentQueue() {
    try {
      const proofQueue = await paymentService.getPaymentProofQueue()
      setPaymentQueue(Array.isArray(proofQueue) ? proofQueue : [])
    } catch (error) {
      console.error('Error loading payment queue:', error)
      setPaymentQueue([])
      toast.error('Failed to load payment queue')
    }
  }

  // Payment proof handlers
  function handleUploadProof(payment) {
    try {
      if (!payment?.id) {
        throw new Error('Invalid payment')
      }
      setUploadingProof(payment)
      setSelectedPayment(payment)
    } catch (error) {
      console.error('Error selecting payment:', error)
      toast.error('Error selecting payment')
    }
  }

  function handleViewProof(payment) {
    try {
      if (!payment?.id) {
        throw new Error('Invalid payment')
      }
      setSelectedPayment(payment)
    } catch (error) {
      console.error('Error viewing proof:', error)
      toast.error('Error viewing payment proof')
    }
  }

  function handleVerifyProof(payment) {
    try {
      if (!payment?.id) {
        throw new Error('Invalid payment')
      }
      setSelectedPayment(payment)
      setVerificationNotes('')
    } catch (error) {
      console.error('Error selecting payment for verification:', error)
      toast.error('Error selecting payment')
    }
  }

  // File handling with validation
  function handleFileDrop(e) {
    e.preventDefault()
    setIsDragActive(false)
    
    try {
      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        const file = files[0]
        validateAndSetFile(file)
      }
    } catch (error) {
      console.error('Error handling file drop:', error)
      toast.error('Error handling dropped file')
    }
  }

  function handleDragOver(e) {
    e.preventDefault()
    setIsDragActive(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    setIsDragActive(false)
  }

  function handleFileSelect(e) {
    try {
      const files = e.target?.files
      if (files && files.length > 0) {
        const file = files[0]
        validateAndSetFile(file)
      }
    } catch (error) {
      console.error('Error handling file select:', error)
      toast.error('Error selecting file')
    }
  }

  function validateAndSetFile(file) {
    try {
      if (!file) {
        throw new Error('No file provided')
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']
      const maxSize = 5 * 1024 * 1024 // 5MB

      if (!allowedTypes.includes(file.type)) {
        throw new Error('Only JPEG, PNG, and PDF files are allowed')
      }

      if (file.size > maxSize) {
        throw new Error('File size must be less than 5MB')
      }

      setProofFile(file)
      toast.success('File selected successfully')
    } catch (error) {
      console.error('Error validating file:', error)
      toast.error(error.message)
      setProofFile(null)
    }
  }

  // Upload proof submission
  async function handleUploadSubmit() {
    try {
      if (!uploadingProof?.id) {
        throw new Error('No payment selected')
      }
      if (!proofFile) {
        throw new Error('No file selected')
      }

      setLoading(true)
      
      const proofData = {
        fileName: proofFile.name,
        fileType: proofFile.type,
        fileSize: proofFile.size
      }

      await paymentService.uploadPaymentProof(uploadingProof.id, proofData)
      toast.success('Payment proof uploaded successfully')
      
      setUploadingProof(null)
      setProofFile(null)
      setSelectedPayment(null)
      await loadPaymentQueue()
      
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Error uploading proof:', error)
      toast.error(error?.message || 'Failed to upload payment proof')
    } finally {
      setLoading(false)
    }
  }

  // Verification submission
  async function handleVerifySubmit(approved) {
    try {
      if (!selectedPayment?.id) {
        throw new Error('No payment selected')
      }

      setLoading(true)
      
      const verificationData = {
        approved: approved,
        notes: verificationNotes
      }

      await paymentService.verifyPaymentProof(selectedPayment.id, verificationData)
      toast.success(`Payment proof ${approved ? 'approved' : 'rejected'}`)
      
      setSelectedPayment(null)
      setVerificationNotes('')
      await loadPaymentQueue()
    } catch (error) {
      console.error('Error verifying proof:', error)
      toast.error(error?.message || 'Failed to verify payment proof')
    } finally {
      setLoading(false)
    }
  }

  // Error boundary for component
  if (error && !vendors.length) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Error 
          message={error}
          onRetry={loadVendors}
          showRetry={true}
        />
      </div>
    )
  }

  // Loading state
  if (loading && !vendors.length) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Loading type="page" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ApperIcon name="store" className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-gray-900">Vendor Management</h1>
        </div>
        <Button 
          onClick={() => setIsEditing(true)}
          className="btn-primary"
          disabled={loading}
        >
          <ApperIcon name="plus" className="h-5 w-5 mr-2" />
          Add Vendor
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-card p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search vendors by name, email, or category..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full"
              icon={<ApperIcon name="search" className="h-5 w-5" />}
            />
          </div>
          <div className="w-full lg:w-48">
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilter(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Vendor Form Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-premium max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
                </h2>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={loading}
                >
                  <ApperIcon name="x" className="h-6 w-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Vendor Name"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  required
                  disabled={loading}
                />
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleFormChange}
                  required
                  disabled={loading}
                />
                <Input
                  label="Phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleFormChange}
                  required
                  disabled={loading}
                />
                <Input
                  label="Category"
                  name="category"
                  value={formData.category}
                  onChange={handleFormChange}
                  required
                  disabled={loading}
                />
              </div>
              
              <Input
                label="Address"
                name="address"
                value={formData.address}
                onChange={handleFormChange}
                required
                disabled={loading}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                  disabled={loading}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  onClick={resetForm}
                  variant="secondary"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : (editingVendor ? 'Update' : 'Create')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vendors List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredVendors.map((vendor) => (
          <div key={vendor?.id || Math.random()} className="bg-white rounded-lg shadow-card hover:shadow-premium transition-shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {vendor?.name || 'Unknown Vendor'}
                </h3>
                <p className="text-sm text-gray-600">{vendor?.category || 'No category'}</p>
              </div>
              <Badge 
                variant={vendor?.status === 'active' ? 'success' : 'secondary'}
                className="ml-2"
              >
                {vendor?.status || 'unknown'}
              </Badge>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center text-sm text-gray-600">
                <ApperIcon name="mail" className="h-4 w-4 mr-2" />
                {vendor?.email || 'No email'}
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <ApperIcon name="phone" className="h-4 w-4 mr-2" />
                {vendor?.phone || 'No phone'}
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <ApperIcon name="map-pin" className="h-4 w-4 mr-2" />
                {vendor?.address || 'No address'}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex space-x-2">
                <Button
                  onClick={() => handleEdit(vendor)}
                  size="sm"
                  variant="outline"
                  disabled={loading}
                >
                  <ApperIcon name="edit" className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => handleToggleStatus(vendor)}
                  size="sm"
                  variant="outline"
                  disabled={loading}
                >
                  <ApperIcon 
                    name={vendor?.status === 'active' ? 'pause' : 'play'} 
                    className="h-4 w-4" 
                  />
                </Button>
                <Button
                  onClick={() => handleDelete(vendor)}
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  disabled={loading}
                >
                  <ApperIcon name="trash-2" className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Product Assignment Section */}
            {(editingVendor?.id === vendor?.id || vendor?.showProducts) && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <ProductAssignment
                  vendor={editingVendor || { name: formData.name, id: 'new' }}
                  availableProducts={availableProducts}
                  loading={productsLoading}
                  onProductsChange={(products) => {
                    // Handle product assignment changes
                    console.log('Products assigned:', products)
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredVendors.length === 0 && !loading && (
        <div className="text-center py-12">
          <ApperIcon name="store" className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No vendors found</h3>
          <p className="text-gray-500 mb-6">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria' 
              : 'Get started by adding your first vendor'}
          </p>
          <Button 
            onClick={() => setIsEditing(true)}
            className="btn-primary"
            disabled={loading}
          >
            <ApperIcon name="plus" className="h-5 w-5 mr-2" />
            Add First Vendor
          </Button>
        </div>
      )}

      {/* Payment Proof Queue Section */}
      {paymentQueue.length > 0 && (
        <div className="bg-white rounded-lg shadow-card p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <ApperIcon name="credit-card" className="h-6 w-6 mr-2" />
            Payment Proof Queue ({paymentQueue.length})
          </h2>
          
          <div className="space-y-4">
            {paymentQueue.map((payment) => (
              <div key={payment?.id || Math.random()} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium">Order #{payment?.orderId || 'Unknown'}</h4>
                    <p className="text-sm text-gray-600">
                      Amount: ${payment?.amount || '0.00'} | 
                      Vendor: {payment?.vendorName || 'Unknown'}
                    </p>
                  </div>
                  <Badge variant={payment?.status === 'pending' ? 'warning' : 'success'}>
                    {payment?.status || 'unknown'}
                  </Badge>
                </div>
                
                <div className="flex space-x-2">
                  {payment?.status === 'pending' && (
                    <Button
                      onClick={() => handleUploadProof(payment)}
                      size="sm"
                      variant="outline"
                      disabled={loading}
                    >
                      Upload Proof
                    </Button>
                  )}
                  {payment?.proofUrl && (
                    <>
                      <Button
                        onClick={() => handleViewProof(payment)}
                        size="sm"
                        variant="outline"
                        disabled={loading}
                      >
                        View Proof
                      </Button>
                      <Button
                        onClick={() => handleVerifyProof(payment)}
                        size="sm"
                        className="btn-primary"
                        disabled={loading}
                      >
                        Verify
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Upload Modal */}
      {uploadingProof && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-premium max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Upload Payment Proof</h2>
                <button
                  onClick={() => {
                    setUploadingProof(null)
                    setProofFile(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={loading}
                >
                  <ApperIcon name="x" className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Order: #{uploadingProof?.orderId || 'Unknown'}
                </p>
                <p className="text-sm text-gray-600">
                  Amount: ${uploadingProof?.amount || '0.00'}
                </p>
              </div>

              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300'
                }`}
                onDrop={handleFileDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf"
                  className="hidden"
                />
                
                <ApperIcon name="upload" className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-2">
                  Drag and drop your file here, or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary hover:text-primary/80"
                    disabled={loading}
                  >
                    browse
                  </button>
                </p>
                <p className="text-xs text-gray-500">
                  Supports: JPEG, PNG, PDF (Max 5MB)
                </p>
              </div>

              {proofFile && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <ApperIcon name="file" className="h-5 w-5 text-green-600 mr-2" />
                    <span className="text-sm text-green-800">{proofFile.name}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  onClick={() => {
                    setUploadingProof(null)
                    setProofFile(null)
                  }}
                  variant="secondary"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUploadSubmit}
                  className="btn-primary"
                  disabled={!proofFile || loading}
                >
                  {loading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {selectedPayment && !uploadingProof && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-premium max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Verify Payment Proof</h2>
                <button
                  onClick={() => setSelectedPayment(null)}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={loading}
                >
                  <ApperIcon name="x" className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">
                  Order: #{selectedPayment?.orderId || 'Unknown'}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  Amount: ${selectedPayment?.amount || '0.00'}
                </p>
                <p className="text-sm text-gray-600">
                  Vendor: {selectedPayment?.vendorName || 'Unknown'}
                </p>
              </div>

              {selectedPayment?.proofUrl && (
                <div className="mb-4">
                  <img
                    src={selectedPayment.proofUrl}
                    alt="Payment Proof"
                    className="w-full h-48 object-cover rounded-lg border"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Verification Notes
                </label>
                <textarea
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                  placeholder="Add notes about the verification..."
                  disabled={loading}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => handleVerifySubmit(false)}
                  variant="secondary"
                  disabled={loading}
                  className="text-red-600 hover:text-red-700"
                >
                  {loading ? 'Processing...' : 'Reject'}
                </Button>
                <Button
                  onClick={() => handleVerifySubmit(true)}
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Approve'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VendorManagement