import { useEffect, useState } from "react";

export interface Expense {
  id: number;
  expense_uuid: string;
  expense_type: string;
  amount: number;
  date: string;
  recorded_by: string;
}

export const useExpenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/expenses");
      const data = await res.json();
      setExpenses(data);
    } catch (err) {
      setError("Failed to fetch expenses");
    } finally {
      setLoading(false);
    }
  };

  const createExpense = async (expense: Omit<Expense, "id" | "expense_uuid">) => {
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expense),
      });
      const newExpense = await res.json();
      setExpenses((prev) => [...prev, newExpense]);
    } catch (err) {
      setError("Failed to create expense");
    }
  };

  const deleteExpense = async (expense_uuid: string) => {
    try {
      await fetch(`/api/expenses/${expense_uuid}`, {
        method: "DELETE",
      });
      setExpenses((prev) =>
        prev.filter((exp) => exp.expense_uuid !== expense_uuid)
      );
    } catch (err) {
      setError("Failed to delete expense");
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  return { expenses, loading, error, refetch: fetchExpenses, createExpense, deleteExpense };
};
