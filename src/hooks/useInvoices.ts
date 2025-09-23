import { useEffect, useState } from "react";

export interface Invoice {
  id: number;
  invoice_uuid: string;
  customer_id: number;
  amount: number;
  status: string;
  due_date: string;
  created_at: string;
}

export const useInvoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/invoices");
      if (!res.ok) throw new Error("Failed to fetch invoices");
      const data = await res.json();
      setInvoices(data);
    } catch (err) {
      setError("Failed to fetch invoices");
    } finally {
      setLoading(false);
    }
  };

  const createInvoice = async (invoice: Omit<Invoice, "id" | "invoice_uuid" | "created_at">) => {
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoice),
      });
      if (!res.ok) throw new Error("Failed to create invoice");
      const newInvoice = await res.json();
      setInvoices((prev) => [...prev, newInvoice]);
    } catch (err) {
      setError("Failed to create invoice");
    }
  };

  const deleteInvoice = async (invoice_uuid: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoice_uuid}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete invoice");
      setInvoices((prev) => prev.filter((inv) => inv.invoice_uuid !== invoice_uuid));
    } catch (err) {
      setError("Failed to delete invoice");
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  return { invoices, loading, error, refetch: fetchInvoices, createInvoice, deleteInvoice };
};
