"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";

// --- Customer Type ---
export interface Customer {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
}

// --- Customer Form ---
const AddCustomerForm = ({ onAddCustomer }: { onAddCustomer: (customer: Customer) => void }) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      const res = await fetch("/api/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email }),
      });

      if (!res.ok) throw new Error("Failed to create customer");

      const newCustomer: Customer = await res.json();
      onAddCustomer(newCustomer);

      setName("");
      setPhone("");
      setEmail("");
    } catch (err) {
      console.error("Error adding customer:", err);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-6 rounded-xl shadow space-y-4 border border-slate-100"
    >
      <h2 className="text-xl font-semibold text-slate-900">Add New Customer</h2>

      <input
        type="text"
        placeholder="Customer Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-full"
        required
      />
      <input
        type="text"
        placeholder="Phone (optional)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-full"
      />
      <input
        type="email"
        placeholder="Email (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-full"
      />

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-emerald-500 to-blue-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" /> Add Customer
      </button>
    </form>
  );
};

// --- Customer List ---
const CustomerList = ({
  customers,
  onDelete,
  onUpdate,
}: {
  customers: Customer[];
  onDelete: (id: number) => void;
  onUpdate: (customer: Customer) => void;
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ name: "", phone: "", email: "" });

  const startEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setEditData({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({ name: "", phone: "", email: "" });
  };

  const saveEdit = async (id: number) => {
    try {
      const res = await fetch("/api/customer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...editData }),
      });

      if (!res.ok) throw new Error("Failed to update customer");

      const updatedCustomer: Customer = await res.json();
      onUpdate(updatedCustomer);

      cancelEdit();
    } catch (err) {
      console.error("Error updating customer:", err);
    }
  };

  if (!customers.length) {
    return <p className="text-slate-500 mt-4">No customers added yet.</p>;
  }

  return (
    <div className="space-y-4 mt-4">
      {customers.map((customer) => (
        <div
          key={customer.id}
          className="bg-white p-4 rounded-xl shadow border border-slate-100 flex justify-between items-center"
        >
          {editingId === customer.id ? (
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="p-2 border rounded w-full"
              />
              <input
                type="text"
                value={editData.phone}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                className="p-2 border rounded w-full"
              />
              <input
                type="email"
                value={editData.email}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                className="p-2 border rounded w-full"
              />
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{customer.name}</h3>
              <p className="text-sm text-slate-600">{customer.phone || "No phone"}</p>
              <p className="text-sm text-slate-600">{customer.email || "No email"}</p>
            </div>
          )}

          <div className="flex gap-2 ml-4">
            {editingId === customer.id ? (
              <>
                <button
                  onClick={() => saveEdit(customer.id)}
                  className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={cancelEdit}
                  className="p-2 bg-gray-300 text-slate-700 rounded-lg hover:bg-gray-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => startEdit(customer)}
                  className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(customer.id)}
                  className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Main Customer Page ---
const CustomerPage = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await fetch("/api/customer");
        if (!res.ok) throw new Error("Failed to fetch customers");

        const data: Customer[] = await res.json();
        setCustomers(data);
      } catch (err) {
        console.error("Error fetching customers:", err);
      }
    };

    fetchCustomers();
  }, []);

  const handleAddCustomer = (customer: Customer) => {
    setCustomers((prev) => [customer, ...prev]);
  };

  const handleDeleteCustomer = async (id: number) => {
    try {
      const res = await fetch("/api/customer", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error("Failed to delete customer");

      setCustomers((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Error deleting customer:", err);
    }
  };

  const handleUpdateCustomer = (updated: Customer) => {
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 via-emerald-50/30 to-blue-50/30 min-h-screen">
      <h1 className="text-3xl font-bold text-slate-900 mb-6">Customers</h1>
      <AddCustomerForm onAddCustomer={handleAddCustomer} />
      <CustomerList
        customers={customers}
        onDelete={handleDeleteCustomer}
        onUpdate={handleUpdateCustomer}
      />
    </div>
  );
};

export default CustomerPage;
