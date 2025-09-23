import React, { useState } from "react";

interface PaymentFormProps {
  onSubmit: (data: any) => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ onSubmit }) => {
  const [form, setForm] = useState({
    sale_id: "",
    amount: "",
    payment_type: "CASH",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Sale ID</label>
        <input
          name="sale_id"
          value={form.sale_id}
          onChange={handleChange}
          className="w-full p-2 border rounded-lg"
          placeholder="Enter sale ID"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Amount</label>
        <input
          name="amount"
          value={form.amount}
          onChange={handleChange}
          className="w-full p-2 border rounded-lg"
          placeholder="Enter amount"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Payment Type</label>
        <select
          name="payment_type"
          value={form.payment_type}
          onChange={handleChange}
          className="w-full p-2 border rounded-lg"
        >
          <option value="CASH">Cash</option>
          <option value="MOBILE">Mobile</option>
          <option value="CARD">Card</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
        </select>
      </div>
      <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
        Record Payment
      </button>
    </form>
  );
};

export default PaymentForm;
