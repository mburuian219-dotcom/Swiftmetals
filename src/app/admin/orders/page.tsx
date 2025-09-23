"use client";

import React, { useEffect, useState } from "react";
import { 
  Plus, 
  Trash2, 
  ShoppingCart, 
  Package, 
  Clock, 
  DollarSign,
  Edit3,
  Eye,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Truck,
  Save,
  X
} from "lucide-react";

interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  category?: string;
  stock?: number;
}

interface OrderItem {
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

interface SaleItem {
  id?: number;
  quantity: number;
  price?: number;
  product?: Product;
}

type OrderStatus = "PENDING" | "PAID" | "DELIVERED" | "CANCELLED";

interface Order {
  id: number;
  items?: OrderItem[];
  saleItems?: SaleItem[];
  totalAmount?: number;
  amount?: number;
  status: OrderStatus;
  date: string;
  customer: { id: number; name: string };
  orderNumber?: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New order state
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [orderStatus, setOrderStatus] = useState<OrderStatus>("PENDING");
  
  // UI state
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");

  // Fetch data from database
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [ordersRes, customersRes, productsRes] = await Promise.all([
          fetch("/api/orders"),
          fetch("/api/customer"),
          fetch("/api/products")
        ]);

        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setOrders(ordersData);
        }

        if (customersRes.ok) {
          const customersData = await customersRes.json();
          setCustomers(customersData);
        }

        if (productsRes.ok) {
          const productsData = await productsRes.json();
          setProducts(productsData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Add item to order
  const addOrderItem = () => {
    setOrderItems([
      ...orderItems,
      { productId: 0, productName: "", quantity: 1, price: 0, total: 0 }
    ]);
  };

  // Remove item from order
  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  // Update order item
  const updateOrderItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const updatedItems = [...orderItems];
    const item = updatedItems[index];
    
    if (field === 'productId') {
      const productId = typeof value === 'string' ? parseInt(value) : value;
      const product = products.find(p => p.id === productId);
      if (product) {
        item.productId = product.id;
        item.productName = product.name;
        item.price = product.price;
        item.total = item.quantity * product.price;
      }
    } else if (field === 'quantity') {
      const quantity = typeof value === 'string' ? parseInt(value) : value;
      item.quantity = quantity || 0;
      item.total = item.quantity * item.price;
    } else if (field === 'productName') {
      item.productName = value as string;
    } else if (field === 'price') {
      const price = typeof value === 'string' ? parseFloat(value) : value;
      item.price = price || 0;
      item.total = item.quantity * item.price;
    } else if (field === 'total') {
      const total = typeof value === 'string' ? parseFloat(value) : value;
      item.total = total || 0;
    }
    
    setOrderItems(updatedItems);
  };

  // Calculate total amount
  const getTotalAmount = () => {
    return orderItems.reduce((sum, item) => sum + item.total, 0);
  };

  const handlePlaceOrder = async () => {
    if (!selectedCustomerId || orderItems.length === 0) {
      alert("Please select a customer and add at least one item");
      return;
    }

    // Validate all items
    const invalidItems = orderItems.some(
      (item) => !item.productId || item.quantity <= 0 || !item.price
    );
    if (invalidItems) {
      alert("Please ensure all items have a product, valid quantity, and price");
      return;
    }

    try {
      const orderData = {
        customerId: parseInt(selectedCustomerId),
        items: orderItems.map((item) => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity),
          price: Number(item.price),
        })),
        status: orderStatus,
        paymentMethod: "CASH",
      };

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (response.ok) {
        const newOrder = await response.json();
        setOrders([newOrder, ...orders]);

        // Reset form
        setOrderItems([]);
        setSelectedCustomerId("");
        setOrderStatus("PENDING");
        setIsAddingOrder(false);

        alert("Order placed successfully!");
      } else {
        const err = await response.json();
        throw new Error(err.error || "Failed to place order");
      }
    } catch (error) {
      console.error("Error placing order:", error);
      alert("Error placing order. Please try again.");
    }
  };

  // Update order status
  const updateOrderStatus = async (orderId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setOrders(orders.map(order => 
          order.id === orderId ? { ...order, status: newStatus as OrderStatus } : order
        ));
      }
    } catch (error) {
      console.error("Error updating order status:", error);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (order.items?.some(item => item.productName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          order.saleItems?.some(item => item.product?.name.toLowerCase().includes(searchTerm.toLowerCase())));
    
    const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;
    const matchesDate = !dateFilter || order.date.includes(dateFilter);
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  // Summary calculations - handle both amount and totalAmount
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === "PENDING").length;
  const paidOrders = orders.filter(o => o.status === "PAID").length;
  const deliveredOrders = orders.filter(o => o.status === "DELIVERED").length;
  const totalRevenue = orders.filter(o => o.status === "PAID" || o.status === "DELIVERED")
                            .reduce((sum, order) => sum + (order.amount || order.totalAmount || 0), 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "text-orange-600 bg-orange-100";
      case "PAID": return "text-blue-600 bg-blue-100";
      case "DELIVERED": return "text-green-600 bg-green-100";
      case "CANCELLED": return "text-red-600 bg-red-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-slate-50 items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 via-emerald-50/30 to-blue-50/30 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Orders Management</h1>
          <p className="text-slate-600">Manage customer orders and track deliveries</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">Total Orders</p>
                <p className="text-2xl font-bold text-slate-900">{totalOrders}</p>
              </div>
              <div className="p-3 bg-slate-100 rounded-xl">
                <ShoppingCart className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">Pending</p>
                <p className="text-2xl font-bold text-orange-600">{pendingOrders}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">Paid</p>
                <p className="text-2xl font-bold text-blue-600">{paidOrders}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">Delivered</p>
                <p className="text-2xl font-bold text-green-600">{deliveredOrders}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <Truck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">Revenue</p>
                <p className="text-2xl font-bold text-emerald-600">KSh {totalRevenue.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        {/* New Order Button */}
        <div className="mb-8">
          <button
            onClick={() => setIsAddingOrder(!isAddingOrder)}
            className="bg-gradient-to-r from-emerald-500 to-blue-600 text-white px-8 py-4 rounded-2xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3 font-semibold text-lg"
          >
            {isAddingOrder ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
            {isAddingOrder ? "Cancel Order" : "Place New Order"}
          </button>
        </div>

        {/* Add Order Form */}
        {isAddingOrder && (
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Create New Order</h2>
            
            {/* Customer Selection */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Select Customer
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all duration-200"
              >
                <option value="">Choose a customer...</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Order Items */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-semibold text-slate-700">
                  Order Items
                </label>
                <button
                  onClick={addOrderItem}
                  className="bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>

              <div className="space-y-4">
                {orderItems.map((item, index) => (
                  <div key={index} className="flex gap-4 items-center p-4 bg-slate-50 rounded-xl">
                    {/* Product Selection */}
                    <div className="flex-1">
                      <select
                        value={item.productId}
                        onChange={(e) => updateOrderItem(index, 'productId', e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      >
                        <option value="">Select product...</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} - KSh {product.price.toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div className="w-24">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateOrderItem(index, 'quantity', e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        placeholder="Qty"
                      />
                    </div>

                    {/* Price (readonly) */}
                    <div className="w-28">
                      <input
                        type="text"
                        value={item.price ? `KSh ${item.price.toLocaleString()}` : ''}
                        readOnly
                        className="w-full p-3 bg-gray-100 border border-slate-300 rounded-lg text-slate-600"
                        placeholder="Price"
                      />
                    </div>

                    {/* Total (readonly) */}
                    <div className="w-32">
                      <input
                        type="text"
                        value={item.total ? `KSh ${item.total.toLocaleString()}` : ''}
                        readOnly
                        className="w-full p-3 bg-gray-100 border border-slate-300 rounded-lg text-slate-600 font-semibold"
                        placeholder="Total"
                      />
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeOrderItem(index)}
                      className="p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {orderItems.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                    <p>No items added yet. Click &ldquo;Add Item&rdquo; to get started.</p>
                  </div>
                )}
              </div>

              {/* Order Total */}
              {orderItems.length > 0 && (
                <div className="mt-6 p-4 bg-emerald-50 rounded-xl border-l-4 border-emerald-500">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-slate-900">Order Total:</span>
                    <span className="text-2xl font-bold text-emerald-600">
                      KSh {getTotalAmount().toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Order Status */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Order Status
              </label>
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value as OrderStatus)}
                className="w-full md:w-auto p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                onClick={handlePlaceOrder}
                className="bg-gradient-to-r from-emerald-500 to-blue-600 text-white px-8 py-4 rounded-xl hover:shadow-lg transition-all duration-200 flex items-center gap-2 font-semibold"
              >
                <Save className="w-5 h-5" />
                Place Order
              </button>
              <button
                onClick={() => setIsAddingOrder(false)}
                className="bg-slate-200 text-slate-700 px-8 py-4 rounded-xl hover:bg-slate-300 transition-colors font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search orders, customers, or products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            
            <div className="flex gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900">Recent Orders</h2>
            <p className="text-slate-600 mt-1">Showing {filteredOrders.length} orders</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Order #</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Customer</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Items</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Total Amount</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">
                        {order.orderNumber || `ORD-${order.id.toString().padStart(3, '0')}`}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{order.customer.name}</div>
                    </td>

                    {/* Show items - handle both items and saleItems */}
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {order.saleItems && order.saleItems.length > 0 ? (
                          order.saleItems.map((item, index) => (
                            <div key={index} className="text-sm text-slate-600">
                              {item.product?.name || 'Unknown Product'} × {item.quantity}
                            </div>
                          ))
                        ) : order.items && order.items.length > 0 ? (
                          order.items.map((item, index) => (
                            <div key={index} className="text-sm text-slate-600">
                              {item.productName} × {item.quantity}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-slate-400 italic">No items</div>
                        )}
                      </div>
                    </td>

                    {/* Show total - handle both amount and totalAmount */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-emerald-600 text-lg">
                        KSh {(order.amount || order.totalAmount || 0).toLocaleString()}
                      </div>
                    </td>

                    {/* Status select */}
                    <td className="px-6 py-4">
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        className={`px-3 py-2 rounded-full text-sm font-semibold border-0 outline-none cursor-pointer ${getStatusColor(
                          order.status
                        )}`}
                      >
                        <option value="PENDING">Pending</option>
                        <option value="PAID">Paid</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-slate-600">
                        {new Date(order.date).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all duration-200">
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Edit button opens modal */}
                        <button
                          onClick={() => setEditingOrder(order)}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No orders found</h3>
              <p className="text-slate-500">Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editingOrder && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-6 rounded-xl shadow-lg w-[500px] max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">
                Edit Order #{editingOrder.orderNumber || editingOrder.id}
              </h2>

              {/* Customer Info */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
                <p className="text-slate-900 font-semibold">{editingOrder.customer.name}</p>
              </div>

              {/* Order Items Display */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Items</label>
                <div className="bg-slate-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                  {editingOrder.saleItems && editingOrder.saleItems.length > 0 ? (
                    editingOrder.saleItems.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm py-1">
                        <span>{item.product?.name || 'Unknown Product'}</span>
                        <span>× {item.quantity}</span>
                      </div>
                    ))
                  ) : editingOrder.items && editingOrder.items.length > 0 ? (
                    editingOrder.items.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm py-1">
                        <span>{item.productName}</span>
                        <span>× {item.quantity}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 italic text-sm">No items</p>
                  )}
                </div>
              </div>

              {/* Total Amount */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Total Amount</label>
                <p className="text-lg font-bold text-emerald-600">
                  KSh {(editingOrder.amount || editingOrder.totalAmount || 0).toLocaleString()}
                </p>
              </div>

              {/* Order Date */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Order Date</label>
                <p className="text-slate-700">{new Date(editingOrder.date).toLocaleDateString()}</p>
              </div>

              {/* Status update */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  value={editingOrder.status}
                  onChange={(e) =>
                    setEditingOrder({ ...editingOrder, status: e.target.value as OrderStatus })
                  }
                  className={`w-full border rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none ${getStatusColor(editingOrder.status)}`}
                >
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setEditingOrder(null)}
                  className="px-6 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      await updateOrderStatus(editingOrder.id, editingOrder.status);
                      setEditingOrder(null);
                      // Show success message
                      alert("Order status updated successfully!");
                    } catch (error) {
                      console.error("Error updating order:", error);
                      alert("Failed to update order status. Please try again.");
                    }
                  }}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-blue-600 text-white hover:shadow-lg transition-all duration-200 font-medium flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Order Details Modal (for View button) */}
        {/* You can add this later for the Eye/View functionality */}
      </div>
    </div>
  );
}