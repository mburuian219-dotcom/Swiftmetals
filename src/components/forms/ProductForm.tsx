import React, { useState } from "react";

interface ProductFormProps {
  onSubmit: (data: any) => void;
  initialData?: any;
}

const ProductForm: React.FC<ProductFormProps> = ({ onSubmit, initialData }) => {
  const [form, setForm] = useState({
    name: initialData?.name || "",
    sku: initialData?.sku || "",
    price: initialData?.price || "",
    stock_quantity: initialData?.stock_quantity || "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Product Name</label>
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          className="w-full p-2 border rounded-lg"
          placeholder="Enter product name"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">SKU</label>
        <input
          name="sku"
          value={form.sku}
          onChange={handleChange}
          className="w-full p-2 border rounded-lg"
          placeholder="Unique SKU"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Price</label>
        <input
          name="price"
          type="number"
          value={form.price}
          onChange={handleChange}
          className="w-full p-2 border rounded-lg"
          placeholder="Price"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Stock</label>
        <input
          name="stock_quantity"
          type="number"
          value={form.stock_quantity}
          onChange={handleChange}
          className="w-full p-2 border rounded-lg"
          placeholder="Available stock"
        />
      </div>
      <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
        {initialData ? "Update Product" : "Add Product"}
      </button>
    </form>
  );
};

export default ProductForm;
