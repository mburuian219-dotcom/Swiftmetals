import React from "react";

export interface CardProps {
  children: React.ReactNode;
  className?: string;
}

// Base Card Component
export const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={`bg-white shadow-md rounded-lg p-4 ${className || ""}`}>
      {children}
    </div>
  );
};

// Card Header
export const CardHeader: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={`border-b pb-2 mb-3 font-semibold text-lg ${className || ""}`}>
      {children}
    </div>
  );
};

// Card Title
export const CardTitle: React.FC<CardProps> = ({ children, className }) => {
  return (
    <h3 className={`text-gray-800 text-lg font-bold ${className || ""}`}>
      {children}
    </h3>
  );
};

// Card Content
export const CardContent: React.FC<CardProps> = ({ children, className }) => {
  return <div className={`mt-2 text-gray-600 ${className || ""}`}>{children}</div>;
};
