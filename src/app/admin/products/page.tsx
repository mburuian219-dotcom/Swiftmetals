"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, Package, Edit2, Trash2, Plus, X, DollarSign } from "lucide-react";

interface Stock {
  quantity: number;
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [restockModal, setRestockModal] = useState<{
    show: boolean;
    product: Product | null;
  }>({ show: false, product: null });
  const [restockForm, setRestockForm] = useState({
    quantity: "",
    paymentSource: "cash",
    totalCost: "",
    creditorName: "",
    creditorPhone: "",
    creditorEmail: "",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [restocking, setRestocking] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [creditors, setCreditors] = useState<any[]>([]);
  const [loadingCreditors, setLoadingCreditors] = useState(false);

  // Fetch products and creditors on mount
  useEffect(() => {
    fetchProducts();
    fetchCreditors();
  }, []);

  const fetchCreditors = async () => {
    setLoadingCreditors(true);
    try {
      const res = await fetch("/api/creditors");
      if (res.ok) {
        const data = await res.json();
        // Ensure data is an array
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
        stockQuantity: p.stock?.[0]?.quantity || 0,
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
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

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

    // Only include stock when creating or if explicitly changed during edit
    if (!editingId) {
      payload.stockQuantity = form.stock ? parseInt(form.stock) : 0;
    } else {
      payload.id = editingId;
      // Only include stockQuantity if user wants to change it
      if (form.stock) {
        payload.stockQuantity = parseInt(form.stock);
      }
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
      savedProduct.stockQuantity = savedProduct.stock?.[0]?.quantity || 0;

      if (editingId) {
        setProducts((prev) =>
          prev.map((p) => (p.id === editingId ? savedProduct : p))
        );
      } else {
        setProducts((prev) => [savedProduct, ...prev]);
      }

      setForm({
        name: "",
        description: "",
        productionCost: "",
        price: "",
        stock: "",
        category: "",
      });
      setEditingId(null);
      setShowForm(false);
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Failed to save product");
    } finally {
      setSubmitting(false);
    }
  };

  // Populate form for editing
  const handleEdit = (product: Product) => {
    setForm({
      name: product.name,
      description: product.description || "",
      productionCost: product.productionCost ? String(product.productionCost) : "",
      price: String(product.price),
      stock: "", // Leave empty - user can optionally update it
      category: product.category || "",
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  // Delete product
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
    } catch (err) {
      console.error(err);
      alert("Error deleting product");
    } finally {
      setDeleting(null);
    }
  };

  // Handle restock
  const handleRestock = async () => {
    if (!restockModal.product) return;

    const quantity = parseInt(restockForm.quantity);
    const totalCost = parseFloat(restockForm.totalCost);

    if (isNaN(quantity) || quantity <= 0) {
      return alert("Please enter a valid quantity");
    }

    if (isNaN(totalCost) || totalCost < 0) {
      return alert("Please enter a valid total cost");
    }

    if (!restockForm.paymentSource) {
      return alert("Please select a payment source");
    }

    if (restockForm.paymentSource === "credit") {
      if (!restockForm.creditorName.trim()) {
        return alert("Please enter the creditor name");
      }
      if (!restockForm.creditorPhone.trim()) {
        return alert("Please enter the creditor phone number");
      }
    }

    setRestocking(true);

    try {
      // Step 1: Restock the product
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restock",
          productId: restockModal.product.id,
          quantity,
          totalCost,
          paymentSource: restockForm.paymentSource,
          creditorName:
            restockForm.paymentSource === "credit"
              ? restockForm.creditorName
              : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        return alert(data.error || "Failed to restock");
      }

      const updatedProduct = await res.json();
      updatedProduct.stockQuantity = updatedProduct.stock?.[0]?.quantity || 0;

      // Step 2: If paymentSource = credit, record or update creditor
      if (restockForm.paymentSource === "credit" && restockForm.creditorName) {
        // Ensure creditors is an array
        const creditorsList = Array.isArray(creditors) ? creditors : [];
        
        // Check if creditor already exists
        const existingCreditor = creditorsList.find(
          (c) => c.name && c.name.toLowerCase() === restockForm.creditorName.toLowerCase()
        );

        if (existingCreditor) {
          // Update existing creditor - add to their balance
          await fetch("/api/creditors", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: existingCreditor.id,
              amountOwed: (existingCreditor.amountOwed || 0) + totalCost,
            }),
          });
        } else {
          // Create new creditor
          await fetch("/api/creditors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: restockForm.creditorName,
              phone: restockForm.creditorPhone,
              email: restockForm.creditorEmail || null,
              amountOwed: totalCost,
            }),
          });
        }

        // Refresh creditors list
        await fetchCreditors();
      }

      // Step 3: Update UI
      setProducts((prev) =>
        prev.map((p) =>
          p.id === restockModal.product!.id ? updatedProduct : p
        )
      );

      // Step 4: Reset form & modal
      setRestockForm({
        quantity: "",
        paymentSource: "cash",
        totalCost: "",
        creditorName: "",
        creditorPhone: "",
        creditorEmail: "",
      });
      setRestockModal({ show: false, product: null });
      alert("✅ Stock updated successfully!");
    } catch (error) {
      console.error("Error restocking:", error);
      alert("❌ Failed to restock product");
    } finally {
      setRestocking(false);
    }
  };

  // Open restock modal
  const openRestockModal = (product: Product) => {
    setRestockModal({ show: true, product });
    setRestockForm({
      quantity: "",
      paymentSource: "cash",
      totalCost: "",
      creditorName: "",
      creditorPhone: "",
      creditorEmail: "",
    });
  };

  // Import contact from phone
  const importContact = async () => {
    try {
      // Check if Contact Picker API is supported
      if (!("contacts" in navigator && "ContactsManager" in window)) {
        alert(
          "Contact picker is not supported on this device/browser. Please enter the details manually."
        );
        return;
      }

      const props = ["name", "tel", "email"];
      const opts = { multiple: false };

      // @ts-ignore - Contact Picker API is not in TypeScript types yet
      const contacts = await navigator.contacts.select(props, opts);

      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        setRestockForm({
          ...restockForm,
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-8 h-8" />
            Products Management
          </h1>
          <button
            onClick={() => {
              setShowForm(!showForm);
              if (showForm) {
                setEditingId(null);
                setForm({
                  name: "",
                  description: "",
                  productionCost: "",
                  price: "",
                  stock: "",
                  category: "",
                });
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {showForm ? "Cancel" : "Add Product"}
          </button>
        </div>

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
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              {editingId ? "Edit Product" : "Add New Product"}
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <input
                placeholder="Product Name *"
                required
                className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                placeholder="Category"
                className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <input
                placeholder="Description"
                className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent md:col-span-2"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
              <input
                placeholder="Production Cost"
                type="number"
                step="0.01"
                className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.productionCost}
                onChange={(e) =>
                  setForm({ ...form, productionCost: e.target.value })
                }
              />
              <input
                placeholder="Selling Price *"
                type="number"
                step="0.01"
                required
                className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
              <input
                placeholder={editingId ? "Stock (leave empty to keep current)" : "Initial Stock"}
                type="number"
                className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {submitting
                  ? editingId
                    ? "Updating..."
                    : "Adding..."
                  : editingId
                  ? "Update Product"
                  : "Add Product"}
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

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-lg shadow-sm p-5 hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h2 className="text-xl font-semibold text-gray-800">
                            {p.name}
                          </h2>
                          {p.category && (
                            <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mt-1">
                              {p.category}
                            </span>
                          )}
                        </div>
                      </div>
                      {p.description && (
                        <p className="text-gray-600 mb-3">{p.description}</p>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Production Cost:</span>
                          <p className="font-semibold text-gray-800">
                            KSh {p.productionCost?.toFixed(2) || "N/A"}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Selling Price:</span>
                          <p className="font-semibold text-gray-800">
                            KSh {p.price.toFixed(2)}
                          </p>
                        </div>
                        {profit !== null && (
                          <div>
                            <span className="text-gray-500">Profit/Unit:</span>
                            <p className="font-semibold text-green-600">
                              KSh {profit.toFixed(2)} ({profitMargin}%)
                            </p>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Stock:</span>
                          <p
                            className={`font-semibold ${
                              isLowStock ? "text-red-600" : "text-gray-800"
                            }`}
                          >
                            {p.stockQuantity} units
                            {isLowStock && " ⚠️"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => openRestockModal(p)}
                        className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition"
                        title="Restock"
                      >
                        <DollarSign className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleEdit(p)}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white p-2 rounded-lg transition"
                        title="Edit"
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

        {/* Restock Modal */}
        {restockModal.show && restockModal.product && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">
                Restock {restockModal.product.name}
              </h2>
              <div className="mb-4 p-3 bg-gray-100 rounded">
                <p className="text-sm text-gray-600">Current Stock:</p>
                <p className="text-xl font-semibold text-gray-800">
                  {restockModal.product.stockQuantity} units
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity to Add *
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Enter quantity"
                    value={restockForm.quantity}
                    onChange={(e) =>
                      setRestockForm({ ...restockForm, quantity: e.target.value })
                    }
                    className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Cost *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Total cost for this restock"
                    value={restockForm.totalCost}
                    onChange={(e) =>
                      setRestockForm({ ...restockForm, totalCost: e.target.value })
                    }
                    className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Source *
                  </label>

                  <select
                    value={restockForm.paymentSource}
                    onChange={(e) =>
                      setRestockForm({
                        ...restockForm,
                        paymentSource: e.target.value,
                        creditorName: "",
                        creditorPhone: "",
                        creditorEmail: "",
                      })
                    }
                    className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select payment source</option>
                    <option value="cash">Cash (Deduct from balance)</option>
                    <option value="credit">Credit / Account</option>
                    <option value="other">Other</option>
                  </select>

                  {/* Cash warning */}
                  {restockForm.paymentSource === "cash" && (
                    <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                      <span>⚠️</span>
                      <span>This amount will be deducted from your cash balance</span>
                    </p>
                  )}

                  {/* Creditor details if "credit" selected */}
                  {restockForm.paymentSource === "credit" && (
                    <div className="mt-4 space-y-4 p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-800">Creditor Information</h3>
                        <button
                          type="button"
                          onClick={importContact}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition"
                        >
                          📱 Import from Contacts
                        </button>
                      </div>

                      {/* Select existing creditor */}
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
                                  setRestockForm({
                                    ...restockForm,
                                    creditorName: selected.name || "",
                                    creditorPhone: selected.phone || "",
                                    creditorEmail: selected.email || "",
                                  });
                                }
                              }}
                              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="">-- Select from saved creditors --</option>
                              {creditors.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} {c.phone ? `(${c.phone})` : ""} - Owed: KSh {c.amountOwed?.toFixed(2) || "0.00"}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}

                      {/* Manual creditor entry */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Creditor Name *
                        </label>
                        <input
                          type="text"
                          placeholder="Enter creditor name"
                          value={restockForm.creditorName}
                          onChange={(e) =>
                            setRestockForm({
                              ...restockForm,
                              creditorName: e.target.value,
                            })
                          }
                          className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                          value={restockForm.creditorPhone}
                          onChange={(e) =>
                            setRestockForm({
                              ...restockForm,
                              creditorPhone: e.target.value,
                            })
                          }
                          className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                          value={restockForm.creditorEmail}
                          onChange={(e) =>
                            setRestockForm({
                              ...restockForm,
                              creditorEmail: e.target.value,
                            })
                          }
                          className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <p className="text-xs text-gray-600 mt-2">
                        💡 The total cost (KSh {restockForm.totalCost || "0"}) will be added to this creditor's balance
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleRestock}
                  disabled={restocking}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-medium transition disabled:bg-green-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {restocking ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Restocking...</span>
                    </>
                  ) : (
                    "Confirm Restock"
                  )}
                </button>
                <button
                  onClick={() => {
                    setRestockModal({ show: false, product: null });
                    setRestockForm({
                      quantity: "",
                      paymentSource: "cash",
                      totalCost: "",
                      creditorName: "",
                      creditorPhone: "",
                      creditorEmail: "",
                    });
                  }}
                  disabled={restocking}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-3 rounded-lg font-medium transition disabled:bg-gray-200 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}