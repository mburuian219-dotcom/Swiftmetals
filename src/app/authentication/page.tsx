"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, Loader2, AlertCircle, CheckCircle, Chrome } from "lucide-react";

export default function AuthenticationPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const router = useRouter();

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const user = auth.currentUser;
      if (user) {
        // Check session
        try {
          const response = await fetch("/api/auth/session");
          const data = await response.json();
          if (data.isAuthenticated) {
            redirectUser(user.email || "");
          }
        } catch (error) {
          console.error("Session check failed:", error);
        }
      }
    };
    checkAuth();
  }, []);

  // Helper to redirect users based on role - FIXED VERSION
  const redirectUser = (email: string) => {
    console.log('🔄 Redirecting user:', email);
    
    // Get admin emails from environment
    const adminEmailsString = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
    const adminEmails = adminEmailsString.split(',').map(e => e.trim().toLowerCase());
    
    console.log('📋 Admin emails:', adminEmails);
    console.log('📧 User email:', email.toLowerCase());
    
    const isAdmin = adminEmails.some(adminEmail => 
      adminEmail === email.toLowerCase()
    );
    
    console.log('✅ Is admin:', isAdmin);
    
    if (isAdmin) {
      console.log('👉 Redirecting to /admin');
      // Force a full page navigation to ensure the session is loaded
      window.location.href = '/admin';
    } else {
      console.log('👉 Redirecting to /dashboard/user');
      window.location.href = '/dashboard/user';
    }
  };

  // Login Handler - FIXED VERSION
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!email || !password) {
      setError("Please enter both email and password");
      setLoading(false);
      return;
    }

    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;
      
      // Force token refresh for latest claims
      const idToken = await user.getIdToken(true);

      console.log("✅ User authenticated:", user.email);

      // Create session on backend
      const res = await fetch("/api/auth/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setError("Access denied. You don't have admin privileges.");
          await auth.signOut();
        } else {
          throw new Error(data.error || data.details || "Session creation failed");
        }
        setLoading(false);
        return;
      }

      console.log("✅ Session created successfully", data);

      // Store user info in localStorage
      if (rememberMe) {
        localStorage.setItem("userEmail", user.email || "");
        localStorage.setItem("userName", user.displayName || "");
      }

      setSuccess("Login successful! Redirecting...");
      
      // IMPORTANT: Wait a moment for the session cookie to be set, then redirect
      setTimeout(() => {
        // Use the redirect function which uses window.location for reliable navigation
        redirectUser(email);
      }, 1500); // Increased delay to ensure cookie is set
      
    } catch (err: any) {
      console.error("Login error:", err);
      
      // Handle specific Firebase auth errors
      switch (err.code) {
        case "auth/user-not-found":
          setError("No account found with this email. Please sign up first.");
          break;
        case "auth/wrong-password":
          setError("Incorrect password. Please try again.");
          break;
        case "auth/too-many-requests":
          setError("Too many failed attempts. Please try again later.");
          break;
        case "auth/invalid-email":
          setError("Invalid email format. Please check your email.");
          break;
        default:
          setError(err.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Signup Handler
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!name.trim()) {
      setError("Please enter your full name");
      setLoading(false);
      return;
    }

    if (!email || !password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name });
      await sendEmailVerification(user);
      
      await setDoc(doc(db, "users", user.uid), {
        email: email,
        name: name,
        role: "user",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        emailVerified: false,
      });

      setSuccess("Account created successfully! Please check your email for verification.");
      
      setName("");
      setEmail("");
      setPassword("");
      
      setTimeout(() => {
        setIsLogin(true);
        setSuccess("");
      }, 3000);
      
    } catch (err: any) {
      console.error("Signup error:", err);
      
      switch (err.code) {
        case "auth/email-already-in-use":
          setError("This email is already registered. Please log in instead.");
          setTimeout(() => setIsLogin(true), 2000);
          break;
        case "auth/invalid-email":
          setError("Invalid email format. Please check your email.");
          break;
        case "auth/weak-password":
          setError("Password is too weak. Please use a stronger password.");
          break;
        default:
          setError(err.message || "Signup failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Password Reset Handler
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!resetEmail) {
      setError("Please enter your email address");
      setLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setSuccess("Password reset email sent! Check your inbox.");
      setTimeout(() => {
        setForgotPassword(false);
        setResetEmail("");
        setSuccess("");
      }, 3000);
    } catch (err: any) {
      console.error("Password reset error:", err);
      switch (err.code) {
        case "auth/user-not-found":
          setError("No account found with this email address.");
          break;
        case "auth/invalid-email":
          setError("Invalid email format.");
          break;
        default:
          setError("Failed to send reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Google Sign In - FIXED VERSION
  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          name: user.displayName,
          role: "user",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      
      const idToken = await user.getIdToken(true);
      
      const res = await fetch("/api/auth/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || data.details || "Session creation failed");
      }
      
      setSuccess("Login successful! Redirecting...");
      setTimeout(() => {
        redirectUser(user.email || "");
      }, 1500);
      
    } catch (err: any) {
      console.error("Google sign in error:", err);
      setError(err.message || "Google sign in failed");
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password Modal (unchanged)
  if (forgotPassword) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Reset Password</h2>
            <p className="text-gray-600 mt-2 text-sm">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="your@email.com"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </button>

            <button
              type="button"
              onClick={() => setForgotPassword(false)}
              className="w-full text-gray-600 text-sm hover:text-gray-800 transition-colors"
            >
              Back to Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
            Swift Metals
          </h1>
          <p className="text-gray-600 mt-2">Manage your business efficiently</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700 flex-1">{error}</p>
              <button onClick={() => setError("")} className="text-red-500 hover:text-red-700">
                ×
              </button>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-green-700 flex-1">{success}</p>
            </div>
          )}

          <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                  placeholder="John Doe"
                  required={!isLogin}
                  disabled={loading}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                  placeholder={isLogin ? "Enter your password" : "Create a password (min 6 characters)"}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {isLogin && (
                <div className="text-right mt-1">
                  <button
                    type="button"
                    onClick={() => setForgotPassword(true)}
                    className="text-xs text-emerald-600 hover:text-emerald-700"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            {isLogin && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-600">Remember me</span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-blue-600 text-white py-2.5 rounded-lg font-semibold hover:from-emerald-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isLogin ? "Logging in..." : "Creating account..."}
                </>
              ) : (
                <>{isLogin ? "Login" : "Sign Up"}</>
              )}
            </button>

            {isLogin && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>
            )}

            {isLogin && (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Chrome className="w-4 h-4" />
                Google
              </button>
            )}
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                  setSuccess("");
                  setName("");
                  setEmail("");
                  setPassword("");
                }}
                className="text-emerald-600 font-medium hover:text-emerald-700 hover:underline"
              >
                {isLogin ? "Create Account" : "Login"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}