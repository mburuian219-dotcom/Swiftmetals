import React, { useState } from "react";

interface ExpenseFormProps {
  onSubmit: (data: any) => void;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ onSubmit }) => {
  const [form, setForm] = useState({
    type: "",
    description: "",
    amount: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Type</label>
        <input
          name="type"
          value={form.type}
          onChange={handleChange}
          className="w-full p-2 border rounded-lg"
          placeholder="Enter expense type"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Description</label>
        <input
          name="description"
          value={form.description}
          onChange={handleChange}
          className="w-full p-2 border rounded-lg"
          placeholder="Enter description"
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
      <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
        Add Expense
      </button>
    </form>
  );
};

export default ExpenseForm;
