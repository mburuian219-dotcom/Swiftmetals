"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Search, Package, Edit2, Trash2, Plus, X, DollarSign, TrendingUp, Minus, AlertTriangle, Trash2 as TrashIcon, Loader, Eye, CheckCircle } from "lucide-react";
import { auth } from "@/lib/firebase";

interface Stock {
  quantity: number;
  costPrice: number;
}

interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  productionCost?: number;
  category?: string;
  stock: Stock[];
  stockQuantity?: number;
}

interface StockSummary {
  previousQuantity: number;
  restockedQuantity: number;
  newTotalQuantity: number;
  previousValue: number;
  restockValue: number;
  newTotalValue: number;
  newWeightedCostPrice: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [form, setForm] = useState({
    name: "",
    description: "",
    productionCost: "",
    price: "",
    stock: "",
    category: "",
  });
  const [stockOperation, setStockOperation] = useState({
    mode: 'add' as 'add' | 'remove',
    quantity: "",
    paymentSource: "cash",
    creditorName: "",
    creditorPhone: "",
    creditorEmail: "",
    reason: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processingStock, setProcessingStock] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [creditors, setCreditors] = useState<any[]>([]);
  const [loadingCreditors, setLoadingCreditors] = useState(false);
  
  // ========== SECRET RESET BUTTON STATE ==========
  const [showSecretReset, setShowSecretReset] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetReason, setResetReason] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const formRef = useRef<HTMLDivElement>(null);

  // Get current user
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser({
          email: user.email,
          name: user.displayName || user.email?.split('@')[0] || 'User',
          uid: user.uid
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch products and creditors on mount
  useEffect(() => {
    fetchProducts();
    fetchCreditors();
  }, []);

  // Scroll to form when editing starts
  useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }, [showForm]);

  // ========== SECRET TRIPLE-CLICK HANDLER ==========
  const handleSecretTripleClick = () => {
    setClickCount(prev => prev + 1);
    
    // Reset timer after 500ms of no clicks
    if (clickTimer) clearTimeout(clickTimer);
    
    const timer = setTimeout(() => {
      setClickCount(0);
    }, 500);
    setClickTimer(timer);
    
    // If triple-click detected (3 clicks in 500ms)
    if (clickCount + 1 === 3) {
      setShowSecretReset(true);
      setClickCount(0);
      // Auto-hide after 15 seconds
      setTimeout(() => {
        setShowSecretReset(false);
        setResetConfirmText("");
        setResetReason("");
        setResetError(null);
        setResetSuccess(null);
      }, 15000);
    }
  };

  // ========== INVENTORY RESET FUNCTIONS ==========
  const fetchInventoryPreview = async () => {
    setResetLoading(true);
    setResetError(null);
    
    try {
      const response = await fetch('/api/inventory/reset?preview=true');
      const data = await response.json();
      
      if (response.ok) {
        setPreviewData(data);
        setShowPreview(true);
      } else {
        throw new Error(data.error || 'Failed to fetch preview');
      }
    } catch (err: any) {
      setResetError(err.message || 'Failed to fetch inventory preview');
    } finally {
      setResetLoading(false);
    }
  };

  const handleInventoryReset = async () => {
    if (resetConfirmText !== 'CONFIRM_DELETE_ALL_INVENTORY') {
      setResetError('Please type CONFIRM_DELETE_ALL_INVENTORY to confirm');
      return;
    }

    if (!resetReason.trim()) {
      setResetError('Please provide a reason for resetting inventory');
      return;
    }

    if (!currentUser) {
      setResetError('Please log in to reset inventory');
      return;
    }

    setResetLoading(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      
      const response = await fetch('/api/inventory/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirm: resetConfirmText,
          preserveSalesItems: true,
          performedBy: currentUser.name,
          performedByEmail: currentUser.email,
          ipAddress: ipData.ip,
          reason: resetReason
        })
      });

      const data = await response.json();

      if (response.ok) {
        setResetSuccess(`Inventory reset completed! Deleted ${data.results.products} products, ${data.results.stock} stock records.`);
        // Refresh products
        await fetchProducts();
        // Close after 2 seconds
        setTimeout(() => {
          setShowSecretReset(false);
          setResetConfirmText("");
          setResetReason("");
          setResetSuccess(null);
          setShowPreview(false);
        }, 2000);
      } else {
        throw new Error(data.error || 'Failed to reset inventory');
      }
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset inventory');
    } finally {
      setResetLoading(false);
    }
  };

  const fetchCreditors = async () => {
    setLoadingCreditors(true);
    try {
      const res = await fetch("/api/creditors");
      if (res.ok) {
        const data = await res.json();
        setCreditors(Array.isArray(data) ? data : []);
      } else {
        setCreditors([]);
      }
    } catch (err) {
      console.error("Failed to fetch creditors:", err);
      setCreditors([]);
    } finally {
      setLoadingCreditors(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      const data: Product[] = await res.json();
      const normalized = data.map((p) => ({
        ...p,
        stockQuantity: p.stock?.reduce((sum, s) => sum + s.quantity, 0) || 0,
      }));
      setProducts(normalized);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoading(false);
    }
  };

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean));
    return Array.from(cats);
  }, [products]);

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.name) return false;
      
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Calculate total cost based on quantity and production cost
  const calculateTotalCost = useMemo(() => {
    if (!editingId || !stockOperation.quantity) return 0;
    
    const currentProduct = products.find(p => p.id === editingId);
    const productionCost = currentProduct?.productionCost || 0;
    const quantity = parseInt(stockOperation.quantity);
    
    if (isNaN(quantity) || quantity <= 0 || productionCost <= 0) return 0;
    
    return quantity * productionCost;
  }, [editingId, stockOperation.quantity, products]);

  // Add or update product
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!form.name.trim()) {
      return alert("Product name is required");
    }

    if (!form.price || isNaN(parseFloat(form.price))) {
      return alert("Valid price is required");
    }

    setSubmitting(true);

    const payload: any = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price: parseFloat(form.price),
      productionCost: form.productionCost ? parseFloat(form.productionCost) : undefined,
      category: form.category.trim() || undefined,
    };

    if (!editingId) {
      payload.stockQuantity = form.stock ? parseInt(form.stock) : 0;
    } else {
      payload.id = editingId;
    }

    const method = editingId ? "PUT" : "POST";

    try {
      const res = await fetch("/api/products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        return alert(data.error || "Failed to save product");
      }

      const savedProduct: Product = await res.json();
      savedProduct.stockQuantity = savedProduct.stock?.reduce((sum, s) => sum + s.quantity, 0) || 0;

      if (editingId) {
        setProducts((prev) =>
          prev.map((p) => (p.id === editingId ? savedProduct : p))
        );
      } else {
        setProducts((prev) => [savedProduct, ...prev]);
      }

      resetFormAndClose();
      alert(editingId ? "✅ Product updated successfully!" : "✅ Product added successfully!");
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Failed to save product");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle stock operation (add or remove)
  const handleStockOperation = async () => {
    if (!editingId) return;

    const quantity = parseInt(stockOperation.quantity);
    const currentProduct = products.find(p => p.id === editingId);
    const currentStock = currentProduct?.stockQuantity || 0;
    const productionCost = currentProduct?.productionCost || 0;

    if (isNaN(quantity) || quantity <= 0) {
      return alert("Please enter a valid quantity");
    }

    if (stockOperation.mode === 'remove' && quantity > currentStock) {
      return alert(`Cannot remove more than current stock (${currentStock} units)`);
    }

    if (stockOperation.mode === 'add' && productionCost <= 0) {
      return alert("Please set a production cost before adding stock");
    }

    setProcessingStock(true);

    try {
      if (stockOperation.mode === 'add') {
        const totalCost = calculateTotalCost;

        if (totalCost <= 0) {
          return alert("Invalid calculation. Please check quantity and production cost.");
        }

        if (!stockOperation.paymentSource) {
          return alert("Please select a payment source");
        }

        if (stockOperation.paymentSource === "credit") {
          if (!stockOperation.creditorName.trim()) {
            return alert("Please enter the creditor name");
          }
          if (!stockOperation.creditorPhone.trim()) {
            return alert("Please enter the creditor phone number");
          }
        }

        const res = await fetch("/api/restock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: editingId,
            quantity,
            totalCost,
            paymentSource: stockOperation.paymentSource,
            creditorName: stockOperation.paymentSource === "credit" ? stockOperation.creditorName : undefined,
            creditorPhone: stockOperation.paymentSource === "credit" ? stockOperation.creditorPhone : undefined,
            creditorEmail: stockOperation.paymentSource === "credit" && stockOperation.creditorEmail ? stockOperation.creditorEmail : undefined,
          }),
        });

        const responseData = await res.json();

        if (!res.ok) {
          return alert(responseData.error || "Failed to add stock");
        }

        const { product: updatedProduct, stockSummary } = responseData;
        const normalizedProduct = {
          ...updatedProduct,
          stockQuantity: updatedProduct.stock?.reduce((sum: number, s: Stock) => sum + s.quantity, 0) || 0,
        };

        setProducts((prev) =>
          prev.map((p) => p.id === editingId ? normalizedProduct : p)
        );

        if (stockOperation.paymentSource === "credit") {
          await fetchCreditors();
        }

        const successMessage = stockOperation.paymentSource === "cash"
          ? `✅ Stock Added Successfully!\n\nPrevious Stock: ${stockSummary.previousQuantity} units\nAdded: ${stockSummary.restockedQuantity} units\nNew Total: ${stockSummary.newTotalQuantity} units\n\nCash deducted: KSh ${totalCost.toFixed(2)}\nNew Weighted Cost Price: KSh ${stockSummary.newWeightedCostPrice.toFixed(2)}/unit`
          : `✅ Stock Added Successfully!\n\nPrevious Stock: ${stockSummary.previousQuantity} units\nAdded: ${stockSummary.restockedQuantity} units\nNew Total: ${stockSummary.newTotalQuantity} units\n\nAdded to ${stockOperation.creditorName}'s balance: KSh ${totalCost.toFixed(2)}\nNew Weighted Cost Price: KSh ${stockSummary.newWeightedCostPrice.toFixed(2)}/unit`;

        alert(successMessage);
      } else {
        const res = await fetch("/api/restock", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: editingId,
            quantity,
            reason: stockOperation.reason.trim() || "Stock adjustment",
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          return alert(data.error || "Failed to remove stock");
        }

        const { product: updatedProduct } = await res.json();
        const normalizedProduct = {
          ...updatedProduct,
          stockQuantity: updatedProduct.stock?.reduce((sum: number, s: Stock) => sum + s.quantity, 0) || 0,
        };

        setProducts((prev) =>
          prev.map((p) => p.id === editingId ? normalizedProduct : p)
        );

        alert(`✅ Successfully removed ${quantity} units from ${currentProduct?.name}\nReason: ${stockOperation.reason || "Stock adjustment"}`);
      }

      resetFormAndClose();
      await fetchProducts();
    } catch (error) {
      console.error(`Error ${stockOperation.mode === 'add' ? 'adding' : 'removing'} stock:`, error);
      alert(`❌ Failed to ${stockOperation.mode === 'add' ? 'add' : 'remove'} stock. Please try again.`);
    } finally {
      setProcessingStock(false);
    }
  };

  const resetFormAndClose = () => {
    setForm({
      name: "",
      description: "",
      productionCost: "",
      price: "",
      stock: "",
      category: "",
    });
    setStockOperation({
      mode: 'add',
      quantity: "",
      paymentSource: "cash",
      creditorName: "",
      creditorPhone: "",
      creditorEmail: "",
      reason: "",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (product: Product) => {
    setForm({
      name: product.name,
      description: product.description || "",
      productionCost: product.productionCost ? String(product.productionCost) : "",
      price: String(product.price),
      stock: "",
      category: product.category || "",
    });
    setStockOperation({
      mode: 'add',
      quantity: "",
      paymentSource: "cash",
      creditorName: "",
      creditorPhone: "",
      creditorEmail: "",
      reason: "",
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    setDeleting(id);

    try {
      const res = await fetch("/api/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        const data = await res.json();
        return alert(data.error || "Failed to delete product");
      }

      setProducts((prev) => prev.filter((p) => p.id !== id));
      alert("✅ Product deleted successfully!");
    } catch (err) {
      console.error(err);
      alert("Error deleting product");
    } finally {
      setDeleting(null);
    }
  };

  const importContact = async () => {
    try {
      if (!("contacts" in navigator && "ContactsManager" in window)) {
        alert("Contact picker is not supported on this device/browser. Please enter the details manually.");
        return;
      }

      const props = ["name", "tel", "email"];
      const opts = { multiple: false };

      // @ts-ignore - Contact Picker API is not in TypeScript types yet
      const contacts = await navigator.contacts.select(props, opts);

      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        setStockOperation({
          ...stockOperation,
          creditorName: contact.name?.[0] || "",
          creditorPhone: contact.tel?.[0] || "",
          creditorEmail: contact.email?.[0] || "",
        });
      }
    } catch (error) {
      console.error("Error importing contact:", error);
      alert("Failed to import contact. Please enter details manually.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const currentProduct = editingId ? products.find(p => p.id === editingId) : null;
  const currentStock = currentProduct?.stockQuantity || 0;
  const productionCost = currentProduct?.productionCost || 0;

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with SECRET TRIPLE-CLICK AREA */}
        <div 
          className="flex justify-between items-center mb-6 cursor-pointer"
          onClick={handleSecretTripleClick}
          title="Products Management"
        >
          <h1 className="text-3xl font-bold text-black flex items-center gap-2 select-none">
            <Package className="w-8 h-8" />
            Products Management
          </h1>
          <button
            onClick={() => {
              setShowForm(!showForm);
              if (showForm) {
                resetFormAndClose();
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {showForm ? "Cancel" : "Add Product"}
          </button>
        </div>

        {/* ========== SECRET INVENTORY RESET BUTTON ========== */}
        {/* 
          🔐 SECRET ACCESS: Triple-click on the "Products Management" header above!
          The button will appear here in the top-right corner.
        */}
        {showSecretReset && (
          <div className="fixed top-20 right-6 z-50">
            <div className="bg-white rounded-lg shadow-2xl border-2 border-red-500 p-4 w-96 animate-in slide-in-from-top duration-300">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-red-100 p-1 rounded-full">
                    <AlertTriangle className="text-red-600" size={20} />
                  </div>
                  <h3 className="font-bold text-red-600">⚠️ EMERGENCY: Reset All Inventory</h3>
                </div>
                <button
                  onClick={() => {
                    setShowSecretReset(false);
                    setResetConfirmText("");
                    setResetReason("");
                    setResetError(null);
                    setResetSuccess(null);
                    setShowPreview(false);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={18} />
                </button>
              </div>

              {resetSuccess ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="text-green-600" size={16} />
                    <p className="text-sm text-green-700">{resetSuccess}</p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    This will permanently delete ALL products, stock records, and inventory data. Sales and customer data will be preserved.
                  </p>

                  {/* Preview Button */}
                  <button
                    onClick={fetchInventoryPreview}
                    disabled={resetLoading}
                    className="w-full mb-3 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm"
                  >
                    <Eye size={16} />
                    Preview what will be deleted
                  </button>

                  {/* Preview Modal */}
                  {showPreview && previewData && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg border max-h-60 overflow-y-auto">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold text-sm">Data to be deleted:</h4>
                        <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span>Products:</span>
                          <span className="font-bold text-red-600">{formatNumber(previewData.counts.products)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Stock Records:</span>
                          <span className="font-bold text-red-600">{formatNumber(previewData.counts.stock)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Restock History:</span>
                          <span className="font-bold text-red-600">{formatNumber(previewData.counts.restock)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Catalog Products:</span>
                          <span className="font-bold text-red-600">{formatNumber(previewData.counts.catalogproducts)}</span>
                        </div>
                        {previewData.sampleProducts && previewData.sampleProducts.length > 0 && (
                          <div className="mt-2 pt-2 border-t">
                            <p className="font-semibold mb-1">Sample products:</p>
                            {previewData.sampleProducts.slice(0, 3).map((p: any) => (
                              <div key={p.id} className="text-gray-600 text-xs">• {p.name}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Reason Input */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Reason for reset *
                    </label>
                    <textarea
                      value={resetReason}
                      onChange={(e) => setResetReason(e.target.value)}
                      placeholder="e.g., Clearing old inventory, System cleanup, New season products..."
                      rows={2}
                      className="w-full p-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>

                  {/* Confirmation Input */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Type <span className="font-mono text-red-600">CONFIRM_DELETE_ALL_INVENTORY</span> to confirm
                    </label>
                    <input
                      type="text"
                      value={resetConfirmText}
                      onChange={(e) => setResetConfirmText(e.target.value)}
                      placeholder="Type CONFIRM_DELETE_ALL_INVENTORY"
                      className="w-full p-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>

                  {/* Error Display */}
                  {resetError && (
                    <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-2">
                      <p className="text-xs text-red-700">{resetError}</p>
                    </div>
                  )}

                  {/* Reset Button */}
                  <button
                    onClick={handleInventoryReset}
                    disabled={resetLoading || !resetConfirmText || !resetReason.trim()}
                    className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    {resetLoading ? (
                      <>
                        <Loader className="animate-spin" size={16} />
                        Resetting...
                      </>
                    ) : (
                      <>
                        <TrashIcon size={16} />
                        Permanently Delete All Inventory
                      </>
                    )}
                  </button>

                  <p className="text-xs text-gray-500 mt-3 text-center">
                    This action cannot be undone. All inventory data will be permanently deleted.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search products by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Showing {filteredProducts.length} of {products.length} products
          </div>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div ref={formRef} className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-black">
              {editingId ? `Edit Product: ${currentProduct?.name}` : "Add New Product"}
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <input
                placeholder="Product Name *"
                required
                className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                placeholder="Category"
                className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <input
                placeholder="Description"
                className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent md:col-span-2 text-black"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <input
                placeholder="Production Cost *"
                type="number"
                step="0.01"
                required
                className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                value={form.productionCost}
                onChange={(e) => {
                  setForm({ ...form, productionCost: e.target.value });
                  if (editingId) {
                    const currentProduct = products.find(p => p.id === editingId);
                    if (currentProduct) {
                      const updatedProduct = {
                        ...currentProduct,
                        productionCost: parseFloat(e.target.value) || 0
                      };
                      setProducts(prev => prev.map(p => 
                        p.id === editingId ? updatedProduct : p
                      ));
                    }
                  }
                }}
              />
              <input
                placeholder="Selling Price *"
                type="number"
                step="0.01"
                required
                className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
              
              {!editingId && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Initial Stock
                  </label>
                  <input
                    placeholder="Initial Stock"
                    type="number"
                    min="0"
                    className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  />
                </div>
              )}

              {editingId && (
                <div className="md:col-span-2">
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-lg font-semibold mb-4 text-black">Stock Management</h3>
                    
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Current Stock:</p>
                          <p className="text-2xl font-bold text-black">{currentStock} units</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Production Cost:</p>
                          <p className="text-2xl font-bold text-blue-600">
                            KSh {productionCost.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">per unit</p>
                        </div>
                        {currentProduct?.stock?.[0]?.costPrice && (
                          <div>
                            <p className="text-sm text-gray-600">Avg. Cost Price:</p>
                            <p className="text-xl font-bold text-purple-600">
                              KSh {currentProduct.stock[0].costPrice.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">per unit</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setStockOperation({...stockOperation, mode: 'add'})}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                          stockOperation.mode === 'add' 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        <Plus className="w-4 h-4 inline mr-2" />
                        Add Stock
                      </button>
                      <button
                        type="button"
                        onClick={() => setStockOperation({...stockOperation, mode: 'remove'})}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                          stockOperation.mode === 'remove' 
                            ? 'bg-red-600 text-white' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        <Minus className="w-4 h-4 inline mr-2" />
                        Remove Stock
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quantity to {stockOperation.mode === 'add' ? 'Add' : 'Remove'} *
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={stockOperation.mode === 'remove' ? currentStock : undefined}
                          placeholder={`Enter quantity ${stockOperation.mode === 'remove' ? `(max: ${currentStock})` : ''}`}
                          value={stockOperation.quantity}
                          onChange={(e) => setStockOperation({ ...stockOperation, quantity: e.target.value })}
                          className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                        />
                      </div>

                      {stockOperation.mode === 'add' && (
                        <>
                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="text-sm text-gray-700">Total Cost:</p>
                                <p className="text-2xl font-bold text-blue-700">
                                  KSh {calculateTotalCost.toFixed(2)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-gray-600">
                                  {stockOperation.quantity || 0} units × KSh {productionCost.toFixed(2)}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Automatically calculated
                                </p>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Payment Source *
                            </label>
                            <select
                              value={stockOperation.paymentSource}
                              onChange={(e) => setStockOperation({
                                ...stockOperation,
                                paymentSource: e.target.value,
                                creditorName: "",
                                creditorPhone: "",
                                creditorEmail: "",
                              })}
                              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                            >
                              <option value="cash">Cash (Deduct from balance)</option>
                              <option value="credit">Credit / Account</option>
                              <option value="other">Other</option>
                            </select>

                            {stockOperation.paymentSource === "credit" && (
                              <div className="mt-4 space-y-4 p-4 bg-blue-50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <h3 className="font-semibold text-black">Creditor Information</h3>
                                  <button
                                    type="button"
                                    onClick={importContact}
                                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition"
                                  >
                                    📱 Import from Contacts
                                  </button>
                                </div>

                                {Array.isArray(creditors) && creditors.length > 0 && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Select Existing Creditor (optional)
                                    </label>
                                    {loadingCreditors ? (
                                      <p className="text-gray-500 text-sm">Loading contacts...</p>
                                    ) : (
                                      <select
                                        value=""
                                        onChange={(e) => {
                                          const selected = creditors.find(
                                            (c) => c.id === parseInt(e.target.value)
                                          );
                                          if (selected) {
                                            setStockOperation({
                                              ...stockOperation,
                                              creditorName: selected.name || "",
                                              creditorPhone: selected.phone || "",
                                              creditorEmail: selected.email || "",
                                            });
                                          }
                                        }}
                                        className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                      >
                                        <option value="">-- Select from saved creditors --</option>
                                        {creditors.map((c) => (
                                          <option key={c.id} value={c.id}>
                                            {c.name} {c.phone ? `(${c.phone})` : ""} - Owed: KSh {c.totalOwed?.toFixed(2) || "0.00"}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </div>
                                )}

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Creditor Name *
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Enter creditor name"
                                    value={stockOperation.creditorName}
                                    onChange={(e) => setStockOperation({ ...stockOperation, creditorName: e.target.value })}
                                    className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                    required
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Phone Number *
                                  </label>
                                  <input
                                    type="tel"
                                    placeholder="Enter phone number"
                                    value={stockOperation.creditorPhone}
                                    onChange={(e) => setStockOperation({ ...stockOperation, creditorPhone: e.target.value })}
                                    className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                    required
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email (optional)
                                  </label>
                                  <input
                                    type="email"
                                    placeholder="Enter email address"
                                    value={stockOperation.creditorEmail}
                                    onChange={(e) => setStockOperation({ ...stockOperation, creditorEmail: e.target.value })}
                                    className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {stockOperation.mode === 'remove' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Reason for Removal (Optional)
                          </label>
                          <textarea
                            placeholder="Enter reason (e.g., damaged, expired, sold, etc.)"
                            value={stockOperation.reason}
                            onChange={(e) => setStockOperation({ ...stockOperation, reason: e.target.value })}
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                            rows={2}
                          />
                        </div>
                      )}

                      {stockOperation.quantity && (
                        <div className={`p-3 rounded-lg border ${
                          stockOperation.mode === 'add' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                        }`}>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600 font-medium">Current Stock</p>
                              <p className="text-2xl font-bold text-gray-800">{currentStock}</p>
                              <p className="text-xs text-gray-500">units</p>
                            </div>
                            <div className="flex items-center justify-center">
                              <div className={stockOperation.mode === 'add' ? 'text-green-600' : 'text-red-600'}>
                                {stockOperation.mode === 'add' ? <Plus className="w-6 h-6" /> : <Minus className="w-6 h-6" />}
                              </div>
                              <div className="ml-2">
                                <p className="text-gray-600 font-medium">{stockOperation.mode === 'add' ? 'Adding' : 'Removing'}</p>
                                <p className={`text-2xl font-bold ${stockOperation.mode === 'add' ? 'text-green-600' : 'text-red-600'}`}>
                                  {stockOperation.quantity}
                                </p>
                                <p className="text-xs text-gray-500">units</p>
                              </div>
                            </div>
                            <div className={`bg-white rounded-lg p-2 border-2 ${
                              stockOperation.mode === 'add' ? 'border-green-500' : 'border-red-500'
                            }`}>
                              <p className="text-gray-600 font-medium">New Total</p>
                              <p className={`text-2xl font-bold ${stockOperation.mode === 'add' ? 'text-green-600' : 'text-red-600'}`}>
                                {stockOperation.mode === 'add' 
                                  ? currentStock + parseInt(stockOperation.quantity || '0')
                                  : currentStock - parseInt(stockOperation.quantity || '0')
                                }
                              </p>
                              <p className="text-xs text-gray-500">units</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleStockOperation}
                        disabled={processingStock || !stockOperation.quantity || 
                          (stockOperation.mode === 'add' && (calculateTotalCost <= 0 || productionCost <= 0))}
                        className={`w-full ${
                          stockOperation.mode === 'add' 
                            ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-400' 
                            : 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
                        } text-white px-4 py-3 rounded-lg font-medium transition disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                      >
                        {processingStock ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>{stockOperation.mode === 'add' ? 'Adding...' : 'Removing...'}</span>
                          </>
                        ) : (
                          `${stockOperation.mode === 'add' ? 'Add' : 'Remove'} Stock`
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {submitting ? (editingId ? "Updating..." : "Adding...") : (editingId ? "Update Product" : "Add Product")}
              </button>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchQuery || selectedCategory !== "all"
                ? "No products found matching your search"
                : "No products yet. Add your first product to get started!"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredProducts.map((p) => {
              const profit = p.productionCost ? p.price - p.productionCost : null;
              const profitMargin = profit && p.price ? ((profit / p.price) * 100).toFixed(1) : null;
              const isLowStock = (p.stockQuantity || 0) < 10;
              const avgCostPrice = p.stock?.[0]?.costPrice;

              return (
                <div key={p.id} className="bg-white rounded-lg shadow-sm p-5 hover:shadow-md transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h2 className="text-xl font-semibold text-black">{p.name}</h2>
                          {p.category && (
                            <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mt-1">
                              {p.category}
                            </span>
                          )}
                        </div>
                      </div>
                      {p.description && <p className="text-gray-600 mb-3">{p.description}</p>}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Production Cost:</span>
                          <p className="font-semibold text-black">KSh {p.productionCost?.toFixed(2) || "N/A"}</p>
                        </div>
                        {avgCostPrice && (
                          <div>
                            <span className="text-gray-500">Avg. Cost Price:</span>
                            <p className="font-semibold text-purple-600">KSh {avgCostPrice.toFixed(2)}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Selling Price:</span>
                          <p className="font-semibold text-black">KSh {p.price.toFixed(2)}</p>
                        </div>
                        {profit !== null && (
                          <div>
                            <span className="text-gray-500">Profit/Unit:</span>
                            <p className="font-semibold text-green-600">KSh {profit.toFixed(2)} ({profitMargin}%)</p>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Stock:</span>
                          <p className={`font-semibold ${isLowStock ? "text-red-600" : "text-black"}`}>
                            {p.stockQuantity} units {isLowStock && "⚠️"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(p)}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white p-2 rounded-lg transition"
                        title="Edit Product & Manage Stock"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                        className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition disabled:bg-red-400 disabled:cursor-not-allowed"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}