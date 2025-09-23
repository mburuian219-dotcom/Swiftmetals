// src/components/dashboard/inquiries/page.tsx
"use client";

import React from "react";

const Inquiries = () => {
  return (
    <div className="flex flex-col space-y-2">
      <a
        href="https://wa.me/1234567890"
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-2 bg-green-600 text-white rounded"
      >
        Contact via WhatsApp
      </a>
      <a
        href="tel:+1234567890"
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Call Us
      </a>
    </div>
  );
};

export default Inquiries;
