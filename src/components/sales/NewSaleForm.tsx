"use client";

import React, { useState } from "react";
import { apiClient } from "../../lib/api";  // ✅ Correct import
import { useRouter } from "next/navigation";

type CartItem = {
  productId: number;
  name: string;
  price: number;
  qty: number;
};

export default function NewSaleForm() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [paymentType, setPaymentType] = useState<"cash" | "credit">("cash");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!customerId) {
        alert("Please select a customer before completing the sale.");
        return;
      }

      if (items.length === 0) {
        alert("Please add at least one product before completing the sale.");
        return;
      }

      // ✅ Create order using apiClient
      const sale = await apiClient.createOrder({
        customerId,
        items: items.map((i) => ({
          productId: i.productId,
          qty: i.qty,
          price: i.price,
        })),
        paymentType,
      });

      // ✅ Prepare SMS body
      const smsBody = `Sale ${sale.id} - Items: ${items
        .map((i) => `${i.name} x${i.qty}`)
        .join(", ")} | Total: ${total.toFixed(2)} | Payment: ${paymentType}`;

      // ✅ Send SMS via apiClient
      await apiClient.sendSMS({
        phone: sale.customer?.phone || "", // fallback to empty if missing
        message: smsBody,
      });

      // ✅ Redirect to invoice/sale page
      router.push(`/sales/${sale.id}`);
    } catch (err) {
      console.error("Sale creation failed:", err);
      alert("Failed to create sale. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-4 rounded shadow space-y-4"
    >
      {/* ✅ Show total dynamically */}
      <div className="text-lg font-semibold">
        Total: <span className="text-green-600">{total.toFixed(2)}</span>
      </div>

      {/* ✅ Payment type dropdown */}
      <label className="block">
        <span className="text-gray-700">Payment Type:</span>
        <select
          value={paymentType}
          onChange={(e) => setPaymentType(e.target.value as "cash" | "credit")}
          className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
        >
          <option value="cash">Cash</option>
          <option value="credit">Credit</option>
        </select>
      </label>

      {/* ✅ Submit button */}
      <button
        disabled={loading}
        className="mt-3 w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition"
      >
        {loading ? "Saving..." : "Complete Sale"}
      </button>
    </form>
  );
}
