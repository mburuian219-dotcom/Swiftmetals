// src/components/dashboard/catalog/page.tsx
"use client";

import React from "react";
import { useProducts } from "@/hooks/useProducts";

const Catalog = () => {
  const { products, loading } = useProducts();

  if (loading) return <p>Loading catalog...</p>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {products.map((product: any) => (
        <div key={product.id} className="p-4 border rounded shadow-sm">
          <h3 className="font-bold">{product.name}</h3>
          <p>Price: ${product.price}</p>
          <p>Stock: {product.stockQuantity}</p>
          <a
            href={`https://wa.me/1234567890?text=Hello, I am interested in ${product.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block px-4 py-2 bg-green-600 text-white rounded"
          >
            Inquire via WhatsApp
          </a>
        </div>
      ))}
    </div>
  );
};

export default Catalog;
