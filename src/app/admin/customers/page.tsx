"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Check, X, Download, FileText, Calendar, DollarSign, ShoppingCart, BarChart3 } from "lucide-react";

export interface Customer {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  totalCredit?: number;
  totalPurchases?: number;
  totalSales?: number;
  averageOrderValue?: number;
  lastPurchase?: string | null;
}

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
      if (!('contacts' in navigator) || !('ContactsManager' in window)) {
        alert('Contact Picker API is not supported on this device/browser.');
        return;
      }

      const props = ['name', 'tel', 'email'];
      const opts = { multiple: false };

      // @ts-ignore
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
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow border border-slate-200 mb-6">
      <h2 className="text-xl font-semibold text-black mb-4">Select Customer</h2>
      <div className="space-y-4">
        <select
          value={selectedId}
          onChange={handleSelect}
          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-black"
        >
          <option value="">-- Choose a customer --</option>
          {customers.map(customer => (
            <option key={customer.id} value={customer.id}>
              {customer.name} {customer.phone ? `(${customer.phone})` : ''}
            </option>
          ))}
        </select>
        <button
          onClick={handlePickContact}
          className="w-full bg-black hover:bg-slate-900 text-white py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" /> Import from Phone Contacts
        </button>
      </div>
    </div>
  );
};

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

      const response = await res.json();
      const newCustomer: Customer = response.data || response;
      onAddCustomer(newCustomer);

      setName("");
      setPhone("");
      setEmail("");
    } catch (err) {
      console.error("Error adding customer:", err);
      alert("Failed to add customer. Please try again.");
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow space-y-4 border border-slate-200">
      <h2 className="text-xl font-semibold text-black">Add New Customer</h2>
      <input
        type="text"
        placeholder="Customer Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black w-full text-black"
        required
      />
      <input
        type="text"
        placeholder="Phone (optional)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black w-full text-black"
      />
      <input
        type="email"
        placeholder="Email (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black w-full text-black"
      />
      <button
        onClick={handleSubmit}
        className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-slate-900 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" /> Add Customer
      </button>
    </div>
  );
};

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

      const response = await res.json();
      const updatedCustomer: Customer = response.data || response;
      onUpdate(updatedCustomer);
      cancelEdit();
    } catch (err) {
      console.error("Error updating customer:", err);
      alert("Failed to update customer. Please try again.");
    }
  };

  if (!customers.length) {
    return <p className="text-black mt-4">No customers added yet.</p>;
  }

  return (
    <div className="space-y-4 mt-4">
      {customers.map((customer) => (
        <div key={customer.id} className="bg-white p-4 rounded-xl shadow border border-slate-200">
          {editingId === customer.id ? (
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="p-2 border border-slate-300 rounded w-full text-black"
              />
              <input
                type="text"
                value={editData.phone}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                className="p-2 border border-slate-300 rounded w-full text-black"
              />
              <input
                type="email"
                value={editData.email}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                className="p-2 border border-slate-300 rounded w-full text-black"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={() => saveEdit(customer.id)} className="p-2 bg-black text-white rounded-lg hover:bg-slate-900">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={cancelEdit} className="p-2 bg-slate-300 text-black rounded-lg hover:bg-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-black">{customer.name}</h3>
                <p className="text-sm text-slate-600">{customer.phone || "No phone"}</p>
                <p className="text-sm text-slate-600">{customer.email || "No email"}</p>
                {customer.totalPurchases !== undefined && (
                  <div className="mt-2 flex gap-4 text-xs text-slate-500">
                    <span>Purchases: {customer.totalPurchases}</span>
                    {customer.totalSales !== undefined && (
                      <span>Sales: KSh {customer.totalSales.toFixed(2)}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                <button onClick={() => startEdit(customer)} className="p-2 bg-black text-white rounded-lg hover:bg-slate-900">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(customer.id)} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const CustomerReport = ({ customer }: { customer: Customer | null }) => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const generateReport = async () => {
    if (!customer) {
      alert('Please select a customer first');
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`/api/customer/reports?customerId=${customer.id}&period=all`);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to generate report');
      }

      const response = await res.json();
      if (response.success && response.data) {
        setReportData(response.data);
      } else {
        setReportData(response);
      }
      setShowPreview(true);
    } catch (err) {
      console.error('Error generating report:', err);
      if ((err as any).name === 'AbortError') {
        alert('Report generation timed out. Try again.');
      } else {
        alert(err instanceof Error ? err.message : 'Failed to generate report. Please try again.');
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!reportData || !customer) return;

    try {
      // Create canvas for PDF
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      // Set up canvas dimensions (A4: 210mm x 297mm at 96 DPI = 794 x 1123)
      const width = 794;
      const height = 1123;
      canvas.width = width;
      canvas.height = height;

      // Fill background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Colors
      const black = '#000000';
      const darkGray = '#1f2937';
      const lightGray = '#f3f4f6';
      const accentGreen = '#16a34a';

      let y = 50;
      const margin = 50;
      const contentWidth = width - 2 * margin;

      // Header with gradient effect (using rectangles)
      ctx.fillStyle = black;
      ctx.fillRect(0, 0, width, 120);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Arial';
      ctx.fillText('Customer Report', margin, 50);
      ctx.font = '14px Arial';
      ctx.fillText('All Time Analysis', margin, 80);

      y = 150;

      // Customer Info Section
      ctx.fillStyle = lightGray;
      ctx.fillRect(margin, y, contentWidth, 100);
      ctx.fillStyle = black;
      ctx.font = 'bold 16px Arial';
      ctx.fillText('Customer Information', margin + 15, y + 25);

      ctx.font = '13px Arial';
      ctx.fillText(`Name: ${customer.name}`, margin + 15, y + 50);
      ctx.fillText(`ID: ${customer.id}`, margin + 15, y + 70);
      ctx.fillText(`Phone: ${customer.phone || 'N/A'}`, margin + 15, y + 90);

      ctx.fillText(`Email: ${customer.email || 'N/A'}`, margin + 380, y + 50);
      ctx.fillText(`Generated: ${new Date().toLocaleDateString()}`, margin + 380, y + 70);

      y += 130;

      // Key Metrics Section
      const metrics = [
        { label: 'Total Purchases', value: reportData.totalPurchases || 0, unit: '' },
        { label: 'Total Amount', value: `KSh ${(reportData.totalAmount || 0).toFixed(2)}`, unit: '' },
        { label: 'Average Order', value: `KSh ${(reportData.averageOrder || 0).toFixed(2)}`, unit: '' },
        { label: 'Largest Purchase', value: `KSh ${(reportData.largestPurchase || 0).toFixed(2)}`, unit: '' },
      ];

      ctx.fillStyle = darkGray;
      ctx.font = 'bold 14px Arial';
      ctx.fillText('Key Metrics', margin, y);
      y += 30;

      metrics.forEach((metric, idx) => {
        const xPos = margin + (idx % 2) * (contentWidth / 2);
        const yPos = y + Math.floor(idx / 2) * 50;

        ctx.fillStyle = lightGray;
        ctx.fillRect(xPos, yPos, contentWidth / 2 - 10, 45);

        ctx.fillStyle = '#666666';
        ctx.font = '11px Arial';
        ctx.fillText(metric.label, xPos + 15, yPos + 18);

        ctx.fillStyle = accentGreen;
        ctx.font = 'bold 18px Arial';
        ctx.fillText(metric.value, xPos + 15, yPos + 38);
      });

      y += 120;

      // Top Products Section
      if (Array.isArray(reportData.topProducts) && reportData.topProducts.length > 0) {
        ctx.fillStyle = darkGray;
        ctx.font = 'bold 14px Arial';
        ctx.fillText('Top Products', margin, y);
        y += 25;

        // Table headers
        ctx.fillStyle = black;
        ctx.fillRect(margin, y, contentWidth, 30);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.fillText('Product', margin + 15, y + 20);
        ctx.fillText('Qty', margin + 400, y + 20);
        ctx.fillText('Total', margin + 500, y + 20);

        y += 30;

        // Table rows
        reportData.topProducts.slice(0, 5).forEach((product: any, idx: number) => {
          ctx.fillStyle = idx % 2 === 0 ? lightGray : '#ffffff';
          ctx.fillRect(margin, y, contentWidth, 25);

          ctx.fillStyle = black;
          ctx.font = '11px Arial';
          const productName = product.name.length > 35 ? product.name.substring(0, 32) + '...' : product.name;
          ctx.fillText(productName, margin + 15, y + 17);
          ctx.fillText(String(product.quantity), margin + 400, y + 17);
          ctx.fillText(`KSh ${product.total.toFixed(2)}`, margin + 500, y + 17);

          y += 25;
        });
      }

      y += 20;

      // Footer
      ctx.fillStyle = '#d1d5db';
      ctx.fillRect(0, height - 50, width, 50);
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px Arial';
      ctx.fillText(`Report generated on ${new Date().toLocaleString()}`, margin, height - 20);
      ctx.fillText('© Customer Management System', width - margin - 200, height - 20);

      // Convert to PDF-like format using image download
      canvas.toBlob((blob) => {
        if (!blob) throw new Error('Failed to create blob');
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${customer.name.replace(/\s+/g, '_')}_AllTime_Report.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 'application/pdf');

    } catch (err) {
      console.error('Error creating PDF:', err);
      alert('Failed to create PDF. Please try again.');
    }
  };

  if (!customer) {
    return (
      <div className="bg-white p-6 rounded-xl shadow border border-slate-200 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-black rounded-lg">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-black">Customer Reports & Analytics</h2>
        </div>
        <p className="text-slate-600">Select a customer to generate the All Time PDF report.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow border border-slate-200 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-black rounded-lg">
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-black">Reports & Analytics</h2>
          <p className="text-sm text-slate-600">Generate All Time report for {customer.name} (PDF)</p>
        </div>
      </div>
      
      <div className="space-y-5">
        <div>
          <label className="text-sm font-semibold text-black mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Report Period
          </label>
          <div className="mt-2">
            <div className="inline-block py-2 px-4 rounded-lg bg-black text-white">All Time</div>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-black mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Export Format
          </label>
          <div className="mt-2">
            <div className="inline-block py-2 px-4 rounded-lg bg-green-600 text-white">.pdf (Portable Document)</div>
          </div>
        </div>

        <button
          onClick={generateReport}
          disabled={loading}
          className="w-full bg-gradient-to-r from-black to-slate-800 hover:from-slate-900 hover:to-black text-white py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          <BarChart3 className="w-5 h-5" />
          {loading ? 'Generating...' : 'Generate Report (All Time)'}
        </button>
        
        {showPreview && reportData && (
          <div className="mt-6 border-t pt-6">
            <h3 className="text-lg font-semibold text-black mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Report Preview
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart className="w-4 h-4 text-slate-600" />
                  <p className="text-sm text-slate-600 font-medium">Purchases</p>
                </div>
                <p className="text-2xl font-bold text-black">{reportData.totalPurchases || 0}</p>
              </div>
              
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <p className="text-sm text-green-600 font-medium">Total</p>
                </div>
                <p className="text-2xl font-bold text-green-900">KSh {reportData.totalAmount?.toFixed(2) || '0.00'}</p>
              </div>
              
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <p className="text-sm text-blue-600 font-medium">Average</p>
                </div>
                <p className="text-2xl font-bold text-blue-900">KSh {reportData.averageOrder?.toFixed(2) || '0.00'}</p>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <p className="text-sm text-purple-600 font-medium">Largest</p>
                </div>
                <p className="text-2xl font-bold text-purple-900">KSh {reportData.largestPurchase?.toFixed(2) || '0.00'}</p>
              </div>
            </div>

            {Array.isArray(reportData.topProducts) && reportData.topProducts.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-black mb-3">Top Products</h4>
                <div className="space-y-2">
                  {reportData.topProducts.slice(0, 3).map((product: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-black font-medium">{product.name}</span>
                      <div className="text-right">
                        <span className="text-slate-600 text-sm">Qty: {product.quantity}</span>
                        <span className="text-slate-800 font-semibold ml-3">KSh {product.total.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={downloadPDF}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
            >
              <Download className="w-5 h-5" />
              Download as .PDF
            </button>
          </div>
        )}
        
        <p className="text-sm text-slate-600">
          Report includes customer details, key metrics, and top products breakdown (All Time).
        </p>
      </div>
    </div>
  );
};

const CustomerPage = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [importedContact, setImportedContact] = useState<{ name: string; phone: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        setError(null);

        if ((window as any).__customersCache) {
          setCustomers((window as any).__customersCache);
          setLoading(false);
          return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch("/api/customer", { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) throw new Error("Failed to fetch customers");

        const response = await res.json();

        const list = (response.success && response.data) ? response.data : (Array.isArray(response) ? response : []);
        setCustomers(list);
        (window as any).__customersCache = list;
      } catch (err) {
        console.error("Error fetching customers:", err);
        setError("Failed to load customers. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  const handleAddCustomer = (customer: Customer) => {
    setCustomers((prev) => [customer, ...prev]);
    setImportedContact(null);
    (window as any).__customersCache = [customer, ...(window as any).__customersCache || []];
  };

  const handleDeleteCustomer = async (id: number) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    
    try {
      const res = await fetch(`/api/customer?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete customer");
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      if (selectedCustomer?.id === id) setSelectedCustomer(null);
      (window as any).__customersCache = (window as any).__customersCache?.filter((c: any) => c.id !== id) || [];
    } catch (err) {
      console.error("Error deleting customer:", err);
      alert("Failed to delete customer. Please try again.");
    }
  };

  const handleUpdateCustomer = (updated: Customer) => {
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    if (selectedCustomer?.id === updated.id) setSelectedCustomer(updated);
    (window as any).__customersCache = (window as any).__customersCache?.map((c: any) => c.id === updated.id ? updated : c) || [];
  };

  const handleSelectCustomer = (customer: Customer | null) => {
    setSelectedCustomer(customer);
  };

  const handleImportFromPhone = (contact: any) => {
    setImportedContact(contact);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="p-8 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-black mb-4"></div>
            <p className="text-slate-600">Loading customers...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 min-h-screen">
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-xl">
          <h2 className="text-lg font-semibold mb-2">Error</h2>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-black">Customers</h1>
        <p className="text-slate-600 mt-1">Manage your customer database and generate All Time PDF reports</p>
      </div>
      
      <CustomerSelector 
        customers={customers} 
        onSelect={handleSelectCustomer}
        onImportFromPhone={handleImportFromPhone}
      />
      
      {selectedCustomer && (
        <div className="bg-gradient-to-r from-black to-slate-800 text-white p-6 rounded-xl shadow-lg mb-6">
          <h3 className="text-lg font-semibold mb-2">Selected Customer</h3>
          <p className="text-xl font-bold">{selectedCustomer.name}</p>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <p className="text-sm opacity-75">Contact</p>
              <p className="text-sm opacity-90">{selectedCustomer.phone || "No phone"}</p>
              <p className="text-sm opacity-90">{selectedCustomer.email || "No email"}</p>
            </div>
            {selectedCustomer.totalPurchases !== undefined && (
              <div>
                <p className="text-sm opacity-75">Quick Stats</p>
                <p className="text-sm opacity-90">Purchases: {selectedCustomer.totalPurchases}</p>
                {selectedCustomer.totalSales !== undefined && (
                  <p className="text-sm opacity-90">Total: KSh {selectedCustomer.totalSales.toFixed(2)}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <CustomerReport customer={selectedCustomer} />

      {importedContact && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-6 rounded">
          <p className="font-semibold">Contact imported from phone!</p>
          <p className="text-sm">Review the details below and click Add Customer to save.</p>
        </div>
      )}
      
      <AddCustomerForm 
        onAddCustomer={handleAddCustomer}
        initialData={importedContact}
      />
      
      <div className="mt-6">
        <h2 className="text-2xl font-bold text-black mb-4">All Customers ({customers.length})</h2>
        <CustomerList
          customers={customers}
          onDelete={handleDeleteCustomer}
          onUpdate={handleUpdateCustomer}
        />
      </div>
    </div>
  );
};

export default CustomerPage;