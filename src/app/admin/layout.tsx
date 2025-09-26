"use client";

import React from "react";
import Sidebar from "@/components/common/sidebar";
import Navbar from "@/components/common/navbar";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false); // 🚀 hidden by default

  React.useEffect(() => {
    if (!loading) {
      if (!user) router.push("/login");
      if (isAdmin) router.push("/admin/dashboard");
    }
  }, [user, loading, isAdmin, router]);

  if (loading) return <p>Loading...Please wait</p>;

  return (
    <div className="bg-gray-100 flex h-screen">
      {/* Sidebar is controlled by state */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 flex flex-col">
        {/* Navbar triggers sidebar to open */}
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} />

        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
