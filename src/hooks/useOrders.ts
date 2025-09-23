import { useEffect, useState } from "react";

export interface Order {
  id: number;
  customerId: string; // BigInt serialized as string
  recordedBy?: string;
  totalAmount: number;
  paymentStatus: string;
  createdAt?: string;
}

export const useOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      console.log("📦 Fetching orders...");
      const res = await fetch("/api/orders");
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data: Order[] = await res.json();
      setOrders(data);
      console.log("✅ Orders fetched:", data);
    } catch (err: any) {
      console.error("❌ Failed to fetch orders:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createOrder = async (order: Omit<Order, "id" | "createdAt">) => {
    try {
      console.log("📤 Adding order...", order);
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      });
      if (!res.ok) throw new Error("Failed to add order");
      const newOrder: Order = await res.json();
      setOrders((prev) => [...prev, newOrder]);
      console.log("✅ Order added successfully!", newOrder);
    } catch (err: any) {
      console.error("❌ Failed to add order:", err);
      setError(err.message);
    }
  };

  const deleteOrder = async (id: string) => {
    try {
      console.log("🗑 Deleting order id:", id);
      const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete order");
      setOrders((prev) => prev.filter((o) => o.id.toString() !== id));
      console.log("✅ Order deleted:", id);
    } catch (err: any) {
      console.error("❌ Failed to delete order:", err);
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return { orders, loading, error, refetch: fetchOrders, createOrder, deleteOrder };
};
