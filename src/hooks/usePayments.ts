import { useEffect, useState } from "react";
import { apiClient } from "../lib/api";

export interface Payment {
  id: number;
  sale_id: number;
  amount: number;
  method: string;
  status: string;
  created_at: string;
}

export const usePayments = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const data = (await apiClient.getPayments()) as Payment[]; // 👈 typed
      setPayments(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createPayment = async (payment: Omit<Payment, "id" | "created_at">) => {
    try {
      await apiClient.createPayment(payment);
      await fetchPayments();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deletePayment = async (id: string) => {
    try {
      await apiClient.deletePayment(id);
      await fetchPayments();
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  return {
    payments,
    loading,
    error,
    refetch: fetchPayments,
    createPayment,
    deletePayment,
  };
};
