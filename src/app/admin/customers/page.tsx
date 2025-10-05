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

// --- Customer Selector Component ---
const CustomerSelector = ({ 
  customers, 
  onSelect,
  onImportFromPhone
}: { 
  customers: Customer[]; 
  onSelect: (customer: Customer | null) => void;
  onImportFromPhone: (contact: any) => void;
}) => {
  const [selectedId, setSelectedId] = useState<string>("");

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedId(id);
    
    if (id === "") {
      onSelect(null);
    } else {
      const customer = customers.find(c => c.id === parseInt(id));
      onSelect(customer || null);
    }
  };

  const handlePickContact = async () => {
    try {
      // Check if Contact Picker API is supported
      if (!('contacts' in navigator) || !('ContactsManager' in window)) {
        alert('Contact Picker API is not supported on this device/browser. Please add customer manually or use a supported browser on mobile.');
        return;
      }

      const props = ['name', 'tel', 'email'];
      const opts = { multiple: false };

      // @ts-ignore - ContactsManager API
      const contacts = await navigator.contacts.select(props, opts);
      
      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        onImportFromPhone({
          name: contact.name?.[0] || '',
          phone: contact.tel?.[0] || '',
          email: contact.email?.[0] || ''
        });
      }
    } catch (err) {
      console.error('Error picking contact:', err);
      if (err instanceof Error && err.message !== 'User cancelled the contact picker') {
        alert('Unable to access contacts. Please check your browser permissions.');
      }
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow border border-slate-100 mb-6">
      <h2 className="text-xl font-semibold text-slate-900 mb-4">Select Customer</h2>
      
      <div className="space-y-4">

        <button
          onClick={handlePickContact}
          className="w-full bg-slate-700 hover:bg-slate-800 text-white py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" /> Import from Phone Contacts
        </button>
      </div>
    </div>
  );
};

// --- Customer Form ---
const AddCustomerForm = ({ 
  onAddCustomer,
  initialData
}: { 
  onAddCustomer: (customer: Customer) => void;
  initialData?: { name: string; phone: string; email: string } | null;
}) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Update form when initial data changes (from phone contacts)
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setPhone(initialData.phone || "");
      setEmail(initialData.email || "");
    }
  }, [initialData]);

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
    <div className="bg-white p-6 rounded-xl shadow space-y-4 border border-slate-100">
      <h2 className="text-xl font-semibold text-slate-900">Add New Customer</h2>

      <input
        type="text"
        placeholder="Customer Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="p-3 border rounded-lg focus:ring-2 focus:ring-black focus:border-black w-full"
        required
      />
      <input
        type="text"
        placeholder="Phone (optional)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="p-3 border rounded-lg focus:ring-2 focus:ring-black focus:border-black w-full"
      />
      <input
        type="email"
        placeholder="Email (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="p-3 border rounded-lg focus:ring-2 focus:ring-black focus:border-black w-full"
      />

      <button
        onClick={handleSubmit}
        className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-slate-800 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" /> Add Customer
      </button>
    </div>
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
                  className="p-2 bg-black text-white rounded-lg hover:bg-slate-800"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={cancelEdit}
                  className="p-2 bg-slate-300 text-slate-900 rounded-lg hover:bg-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => startEdit(customer)}
                  className="p-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800"
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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [importedContact, setImportedContact] = useState<{ name: string; phone: string; email: string } | null>(null);

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
    setImportedContact(null); // Clear imported contact after adding
  };

 const handleDeleteCustomer = async (id: number) => {
    try {
      const res = await fetch(`/api/customer?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete customer");


      

      setCustomers((prev) => prev.filter((c) => c.id !== id));
      
      // Clear selection if deleted customer was selected
      if (selectedCustomer?.id === id) {
        setSelectedCustomer(null);
      }
    } catch (err) {
      console.error("Error deleting customer:", err);
    }
  };

  const handleUpdateCustomer = (updated: Customer) => {
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    
    // Update selection if updated customer was selected
    if (selectedCustomer?.id === updated.id) {
      setSelectedCustomer(updated);
    }
  };

  const handleSelectCustomer = (customer: Customer | null) => {
    setSelectedCustomer(customer);
  };

  const handleImportFromPhone = (contact: any) => {
    setImportedContact(contact);
    // Scroll to form
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 min-h-screen">
      <h1 className="text-3xl font-bold text-slate-900 mb-6">Customers</h1>
      
      <CustomerSelector 
        customers={customers} 
        onSelect={handleSelectCustomer}
        onImportFromPhone={handleImportFromPhone}
      />
      
      {selectedCustomer && (
        <div className="bg-gradient-to-r from-black to-slate-800 text-white p-6 rounded-xl shadow-lg mb-6">
          <h3 className="text-lg font-semibold mb-2">Selected Customer</h3>
          <p className="text-xl font-bold">{selectedCustomer.name}</p>
          <p className="text-sm opacity-90">{selectedCustomer.phone || "No phone"}</p>
          <p className="text-sm opacity-90">{selectedCustomer.email || "No email"}</p>
        </div>
      )}

      {importedContact && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-6 rounded">
          <p className="font-semibold">Contact imported from phone!</p>
          <p className="text-sm">Review the details below and click "Add Customer" to save.</p>
        </div>
      )}
      
      <AddCustomerForm 
        onAddCustomer={handleAddCustomer}
        initialData={importedContact}
      />
      <CustomerList
        customers={customers}
        onDelete={handleDeleteCustomer}
        onUpdate={handleUpdateCustomer}
      />
    </div>
  );
};

export default CustomerPage;