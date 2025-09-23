// src/components/dashboard/KpiCard.tsx
"use client";
export default function KpiCard({ title, value }: {title: string, value: string}) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
