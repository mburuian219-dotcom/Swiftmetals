// src/app/page.tsx
"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // Always show user dashboard for guests
      if (!user) {
        router.push("/dashboard");
      } else {
        // Logged-in users
        router.push(isAdmin ? "/admin/dashboard" : "/dashboard");
      }
    }
  }, [user, loading, isAdmin, router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-lg font-medium">Loading...</p>
    </div>
  );
}
