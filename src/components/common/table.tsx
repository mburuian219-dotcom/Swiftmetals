"use client";

import React from "react";

interface TableProps {
  columns: string[];
  data: any[];
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
}

const Table: React.FC<TableProps> = ({ columns, data, onEdit, onDelete }) => {
  return (
    <div className="overflow-x-auto rounded-lg shadow">
      <table className="min-w-full border-collapse border border-gray-200">
        <thead>
          <tr className="bg-gray-100 text-left">
            {columns.map((col, i) => (
              <th key={i} className="px-4 py-2 border-b border-gray-200 font-medium">
                {col}
              </th>
            ))}
            {(onEdit || onDelete) && (
              <th className="px-4 py-2 border-b border-gray-200 font-medium">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + 1}
                className="text-center py-6 text-gray-500"
              >
                No records found
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`hover:bg-gray-50 ${
                  rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
                }`}
              >
                {columns.map((col, colIndex) => (
                  <td
                    key={colIndex}
                    className="px-4 py-2 border-b border-gray-200"
                  >
                    {row[col.toLowerCase()] ?? "-"}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className="px-4 py-2 border-b border-gray-200">
                    <div className="flex gap-2">
                      {onEdit && (
                        <button
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                          onClick={() => onEdit(row)}
                        >
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                          onClick={() => onDelete(row)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
