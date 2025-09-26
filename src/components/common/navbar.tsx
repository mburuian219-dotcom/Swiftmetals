"use client";
import React from "react";
import { Bell, User, Menu } from "lucide-react";

interface NavbarProps {
  onMenuClick: () => void; // passed from parent
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  return (
    <header className="bg-white shadow-md fixed top-0 left-0 w-full z-40">
      <div className="flex justify-between items-center px-4 sm:px-6 py-3">
        {/* Left Section */}
        <div className="flex items-center gap-3">
          {/* Hamburger - only visible on mobile */}
          <button
            onClick={onMenuClick}
            className="md:hidden text-gray-700 focus:outline-none"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Logo */}
          <h1 className="text-xl font-bold text-blue-600">Swift METALS</h1>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-6">
          {/* Notifications */}
          <button className="relative">
            <Bell className="h-5 w-5 text-gray-600" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full px-1 text-xs">
              3
            </span>
          </button>

          {/* Profile */}
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
              OLA
            </div>
            <span className="text-gray-700 font-medium hidden sm:block">
              HELLO ADMIN
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
