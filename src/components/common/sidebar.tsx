"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, UserCheck } from "lucide-react";

const Sidebar: React.FC = () => {
  const pathname = usePathname();

  // Guest-friendly links
  const links = [
    { name: "Home", path: "/", icon: Home },
     // login/signup page
  ];

  return (
    <aside className="w-64 bg-gray-900 h-screen text-white flex flex-col shadow-lg">
      {/* Logo Section */}
      <div className="p-6 text-2xl font-bold tracking-wide text-center border-b border-gray-700">
        SWIFT METALS
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.path || pathname.startsWith(link.path);

          return (
            <Link
              key={link.name}
              href={link.path}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              {Icon && <Icon className="w-5 h-5" />}
              <span>{link.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
