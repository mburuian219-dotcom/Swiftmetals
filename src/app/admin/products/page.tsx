"use client";

import { useEffect, useState } from "react";

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
  stockQuantity?: number; // normalized for frontend
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    productionCost: "",
    price: "",
    stock: "",
    category: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  // Fetch products on mount
  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data: Product[]) => {
        const normalized = data.map((p) => ({
          ...p,
          stockQuantity: p.stock?.[0]?.quantity || 0,
        }));
        setProducts(normalized);
      })
      .catch((err) => console.error("Failed to fetch products:", err));
  }, []);

  // Add or update product
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      id: editingId || undefined,
      ...form,
      productionCost: parseFloat(form.productionCost),
      price: parseFloat(form.price),
      stockQuantity: parseInt(form.stock),
    };

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

      setForm({ name: "", description: "", productionCost: "", price: "", stock: "", category: "" });
      setEditingId(null);
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Failed to save product");
    }
  };

  // Populate form for editing
  const handleEdit = (product: Product) => {
    setForm({
      name: product.name,
      description: product.description || "",
      productionCost: String(product.productionCost || 0),
      price: String(product.price),
      stock: String(product.stockQuantity || 0),
      category: product.category || "",
    });
    setEditingId(product.id);
  };

  // Delete product
  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

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
    }
  };

  return (
    <div className="p-6 text-black">
      <h1 className="text-2xl font-bold mb-4 text-black">Products</h1>

      {/* Add/Edit product form */}
      <form onSubmit={handleSubmit} className="mb-6 space-y-2 text-black">
        <input
          placeholder="Name"
          className="border p-2 w-full text-black"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          placeholder="Description"
          className="border p-2 w-full text-black"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <input
          placeholder="Production Cost"
          type="number"
          step="0.01"
          className="border p-2 w-full text-black"
          value={form.productionCost}
          onChange={(e) => setForm({ ...form, productionCost: e.target.value })}
        />
        <input
          placeholder="Selling Price"
          type="number"
          step="0.01"
          className="border p-2 w-full text-black"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
        />
        <input
          placeholder="Stock"
          type="number"
          className="border p-2 w-full text-black"
          value={form.stock}
          onChange={(e) => setForm({ ...form, stock: e.target.value })}
        />
        <input
          placeholder="Category"
          className="border p-2 w-full text-black"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          type="submit"
        >
          {editingId ? "Update Product" : "Add Product"}
        </button>
      </form>

      {/* Products list */}
      <div className="grid gap-4 text-black">
        {products.map((p) => {
          const profit = p.productionCost ? p.price - p.productionCost : null;
          const profitMargin = profit && p.price ? ((profit / p.price) * 100).toFixed(1) : null;
          
          return (
            <div
              key={p.id}
              className="border p-4 rounded flex justify-between items-center text-black"
            >
              <div>
                <h2 className="text-lg font-semibold text-black">{p.name}</h2>
                <p className="text-black">{p.description}</p>
                <p className="text-sm text-black">
                  Production Cost: {p.productionCost || 'N/A'} | Selling Price: {p.price}
                </p>
                {profit !== null && (
                  <p className="text-sm text-black">
                    Profit: {profit.toFixed(2)} ({profitMargin}% margin)
                  </p>
                )}
                <p className="text-sm text-black">
                  Stock: {p.stockQuantity} | Category: {p.category}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(p)}
                  className="bg-yellow-500 text-white px-3 py-1 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="bg-red-600 text-white px-3 py-1 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}