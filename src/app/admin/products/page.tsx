"use client";

import { useEffect, useState } from "react";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", description: "", price: "", stock: "", category: "" });
  const [editingId, setEditingId] = useState<number | null>(null);

  // Fetch products
  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then(setProducts);
  }, []);

  // Add or update product
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      ...form,
      price: parseFloat(form.price),
      stock: parseInt(form.stock),
    };

    const url = editingId ? `/api/products/${editingId}` : "/api/products";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const savedProduct = await res.json();

      if (editingId) {
        setProducts(products.map((p) => (p.id === editingId ? savedProduct : p)));
      } else {
        setProducts([savedProduct, ...products]);
      }

      setForm({ name: "", description: "", price: "", stock: "", category: "" });
      setEditingId(null);
    }
  };

  // Handle edit
  const handleEdit = (product: any) => {
    setForm({
      name: product.name,
      description: product.description || "",
      price: String(product.price),
      stock: String(product.stockQuantity || 0), // if using stockQuantity
      category: product.category || "",
    });
    setEditingId(product.id);
  };

  // Handle delete
  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        // Remove product immediately from state
        setProducts((prev) => prev.filter((p) => p.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete product");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting product");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Products</h1>

      {/* Add/Edit product form */}
      <form onSubmit={handleSubmit} className="mb-6 space-y-2">
        <input
          placeholder="Name"
          className="border p-2 w-full"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          placeholder="Description"
          className="border p-2 w-full"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <input
          placeholder="Price"
          type="number"
          step="0.01"
          className="border p-2 w-full"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
        />
        <input
          placeholder="Stock"
          type="number"
          className="border p-2 w-full"
          value={form.stock}
          onChange={(e) => setForm({ ...form, stock: e.target.value })}
        />
        <input
          placeholder="Category"
          className="border p-2 w-full"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit">
          {editingId ? "Update Product" : "Add Product"}
        </button>
      </form>

      {/* Products list */}
      <div className="grid gap-4">
        {products.map((p) => (
          <div key={p.id} className="border p-4 rounded flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p>{p.description}</p>
              <p className="text-sm">Price: {p.price} | Stock: {p.stockQuantity || 0}</p>
              <p className="text-sm text-gray-500">{p.category}</p>
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
        ))}
      </div>
    </div>
  );
}
