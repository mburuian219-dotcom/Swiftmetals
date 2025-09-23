"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { app } from "@/lib/firebase";

const auth = getAuth(app);

const GetStartedDropdown = () => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setOpen(!open)}
        className="bg-gradient-to-r from-emerald-500 to-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
      >
        Get Started
        <ChevronDown className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-4">
          {/* Tabs */}
          <div className="flex justify-between mb-4">
            <button
              className={`w-1/2 py-2 font-medium ${tab === "login" ? "border-b-2 border-blue-600" : ""}`}
              onClick={() => setTab("login")}
            >
              Login
            </button>
            <button
              className={`w-1/2 py-2 font-medium ${tab === "signup" ? "border-b-2 border-blue-600" : ""}`}
              onClick={() => setTab("signup")}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3">
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
                required
              />
              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
                Login
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-3">
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
                required
              />
              <button type="submit" className="w-full bg-green-600 text-white py-2 rounded">
                Sign Up
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default GetStartedDropdown;
