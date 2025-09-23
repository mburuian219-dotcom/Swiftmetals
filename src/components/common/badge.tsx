import React from "react";

interface BadgeProps {
  label: string;
  type?: "success" | "warning" | "error" | "info";
}

const colors = {
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
};

const Badge: React.FC<BadgeProps> = ({ label, type = "info" }) => {
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors[type]}`}>
      {label}
    </span>
  );
};

export default Badge;
