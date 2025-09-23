"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { 
  ChevronRight, Eye, Search, Heart, ShoppingBag, MessageCircle, Star, ArrowRight, 
  Zap, Shield, Truck, List, Grid3X3, Sparkles 
} from "lucide-react";

// ================= Types =================
interface Product {
  name: string;
  category: string;
  image: string;
  description: string;
  inStock: boolean;
}

interface ProductCardProps {
  product: Product;
  isNewProduct?: boolean;
}

interface SectionDividerProps {
  title: string;
  description: string;
  showNew?: boolean;
}

interface CatalogProps {
  products?: Product[];
}

// ================= Product Data =================
const sampleProducts: Product[] = [
  // Hand Tools
  { 
    name: "Pliers", 
    category: "Hand Tools",  
    image: "/images/pliers.jpeg", 
    description: "Professional grade pliers for various applications", 
    inStock: true 
  },
  { 
    name: "Slashers", 
    category: "Hand Tools", 
    image: "/images/slasher.jpeg", 
    description: "Sharp slashers for cutting vegetation", 
    inStock: true 
  },
  { 
    name: "Jembes", 
    category: "Hand Tools", 
    image: "/images/jembe.jpeg", 
    description: "Heavy-duty jambers for construction work", 
    inStock: true 
  },
  { 
    name: "Screwdrivers", 
    category: "Hand Tools", 
    image: "/images/screw drivers.jpeg", 
    description: "Set of professional screwdrivers", 
    inStock: true 
  },
  { 
    name: "Files", 
    category: "Hand Tools", 
    image: "/images/files.jpeg", 
    description: "Metal files for shaping and smoothing", 
    inStock: true 
  },
  { 
    name: "Cutters", 
    category: "Hand Tools", 
    image: "/images/cutters.jpeg", 
    description: "Sharp cutters for various materials", 
    inStock: true 
  },
  { 
    name: "Wire Brush", 
    category: "Hand Tools", 
    image: "/images/wire brush.jpeg", 
    description: "Wire brush for cleaning and surface prep", 
    inStock: true 
  },

  // Construction Tools
  { name: "Trowels", category: "Construction", image: "/images/trowels.jpeg", description: "Professional masonry trowels", inStock: true },
  { name: "Steel Trowels", category: "Construction", image: "/images/steel trowel.jpeg", description: "High-grade steel trowels for concrete work", inStock: true },
  { name: "Hammers", category: "Construction", image: "/images/hammer.jpeg", description: "Heavy-duty construction hammers", inStock: true },
  { name: "Chisels", category: "Construction", image: "/images/chisel.jpeg", description: "Sharp chisels for stone and wood work", inStock: true },
  { name: "Crowbars", category: "Construction", image: "/images/crowbar.jpeg", description: "Strong crowbars for demolition work", inStock: true },
  { name: "Mason Hammers", category: "Construction", image: "/images/mason-hammer.jpeg", description: "Specialized hammers for masonry work", inStock: true },
  { name: "Bangers", category: "Construction", image: "/images/banger.jpeg", description: "Heavy bangers for construction", inStock: true },
  { name: "Hammerheads", category: "Construction", image: "/images/hammerhead.jpeg", description: "Replacement hammerheads", inStock: true },

  // Hardware
  { name: "Sliding Locks", category: "Hardware", image: "/images/sliding-lock.jpeg", description: "Secure sliding locks for doors", inStock: true },
  { name: "Chains", category: "Hardware", image: "/images/chain.jpeg", description: "Heavy-duty metal chains", inStock: true },
  { name: "Wheelbarrow Wheels", category: "Hardware", image: "/images/wheelbarrow-wheel.jpeg", description: "Replacement wheels for wheelbarrows", inStock: true },
  { name: "Wheelbarrows", category: "Hardware", image: "/images/wheelbarrow.jpeg", description: "Heavy-duty wheelbarrows for construction", inStock: true },
  { name: "Barbed Wire", category: "Hardware", image: "/images/barbed-wire.jpeg", description: "Galvanized barbed wire for fencing", inStock: true },

  // Kitchen & Cooking
  { name: "Aluminum Cooking Pans", category: "Kitchen & Cooking", image: "/images/aluminum-pan.jpeg", description: "Professional aluminum cooking pans", inStock: true },
  { name: "Mop Buckets", category: "Kitchen & Cooking", image: "/images/mop-bucket.jpeg", description: "Durable mop buckets for cleaning", inStock: true },

  // Agricultural
  { name: "Rakes", category: "Agricultural", image: "/images/rake.jpeg", description: "Garden rakes for landscaping", inStock: true },
  { name: "Corn Feeders", category: "Agricultural", image: "/images/corn-feeder.jpeg", description: "Chicken corn feeders for poultry", inStock: true },
];

// ================= Sidebar =================
const Sidebar: React.FC = () => {
  const router = useRouter();

  const navItems = [
    { name: "Browse Products", icon: Eye, href: "/products" },
    { name: "About Us", icon: Shield, href: "/dashboard/about" },
    { name: "Contact", icon: MessageCircle, href: "/dashboard/contact" },
  ];

  return (
    <div className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white p-6 shadow-2xl">
      {/* Logo and Title */}
      <div className="flex flex-col items-center mb-8">
        <img
          src="/images/764e8e99-c09c-4162-ac41-8b9a9f5ab3aa.png"
          alt="Swift Metals Logo"
          className="w-16 h-16 mb-3 rounded-lg shadow-lg"
        />
        <h2 className="text-xl font-bold">Swift Metals</h2>
      </div>

      {/* Navigation */}
      <nav className="space-y-2">
        {navItems.map((item) => (
          <div
            key={item.name}
            className="p-3 rounded-lg hover:bg-slate-700 transition-all duration-200 cursor-pointer group flex items-center gap-3"
            onClick={() => router.push(item.href)}
          >
            <item.icon className="w-4 h-4" />
            <span className="group-hover:translate-x-1 transition-transform duration-200">
              {item.name}
            </span>
          </div>
        ))}
      </nav>

      {/* Call to Action */}
      <div className="mt-8 p-4 bg-gradient-to-r from-emerald-500/20 to-blue-600/20 rounded-xl border border-emerald-500/30">
        <h3 className="font-semibold mb-2">New Visitor?</h3>
        <p className="text-sm text-slate-300 mb-3">
          Sign up for exclusive deals and updates!
        </p>
        <button
          onClick={() => router.push("/authentication")}
          className="w-full bg-gradient-to-r from-emerald-500 to-blue-600 text-white py-2 px-4 rounded-lg text-sm hover:shadow-lg transition-all duration-200"
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

// ================= Navbar =================
const Navbar: React.FC = () => {
  const router = useRouter();

  return (
    <nav className="bg-white/90 backdrop-blur-xl border-b border-slate-200/50 px-6 py-4 shadow-sm sticky top-0 z-40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold text-slate-800">Visitor Dashboard</h1>
          <div className="hidden md:flex items-center gap-1 text-sm text-slate-600">
            <span>Welcome, Guest!</span>
            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">Visitor</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search products..."
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-slate-50"
            />
          </div>
          <button
            onClick={() => router.push("/authentication")}
            className="bg-gradient-to-r from-emerald-500 to-blue-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all duration-200 text-sm font-medium"
          >
            Sign In
          </button>
        </div>
      </div>
    </nav>
  );
};

// ================= Welcome Banner =================
const WelcomeBanner: React.FC = () => (
  <section className="px-8 py-16 bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 text-white relative overflow-hidden">
    <div className="absolute inset-0 bg-black/10"></div>
    <div className="relative z-10 max-w-5xl mx-auto text-center">
      <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium mb-6">
        <span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse"></span>
        Welcome to Swift Metals
      </div>
      <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
        Discover Amazing Products
        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-300">
          At Unbeatable Prices
        </span>
      </h1>
      <p className="text-xl opacity-90 mb-8 leading-relaxed max-w-3xl mx-auto">
        Browse our extensive catalog of premium products, ask questions, and find exactly what you're looking for. No account required to explore!
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button className="bg-white text-slate-800 px-8 py-4 rounded-xl hover:bg-slate-100 transition-all duration-200 transform hover:scale-105 font-semibold flex items-center justify-center gap-2">
          <Eye className="w-5 h-5" />
          Browse Products
        </button>
        <button className="bg-white/20 backdrop-blur-sm text-white px-8 py-4 rounded-xl hover:bg-white/30 transition-all duration-200 transform hover:scale-105 font-semibold border border-white/30 flex items-center justify-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Ask Questions
        </button>
      </div>
    </div>
  </section>
);

// ================= Product Card =================
const ProductCard: React.FC<ProductCardProps> = ({ product, isNewProduct = false }) => (
  <div className="group cursor-pointer">
    <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-slate-100 relative">
      {/* New Product Badge */}
      {isNewProduct && (
        <div className="absolute top-0 left-0 z-10">
          <div className="bg-gradient-to-r from-emerald-500 to-blue-600 text-white px-3 py-1 rounded-tr-2xl rounded-bl-2xl text-xs font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            NEW
          </div>
        </div>
      )}
      
      <div className="relative w-full h-48">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-contain bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 group-hover:from-emerald-50 group-hover:via-blue-50 group-hover:to-purple-50 transition-all duration-300"
        />
        <div className={`absolute top-3 ${isNewProduct ? 'right-3' : 'left-3'}`}>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            product.inStock 
              ? 'bg-emerald-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            {product.inStock ? 'In Stock' : 'Out of Stock'}
          </span>
        </div>
        <div className={`absolute top-3 ${isNewProduct ? 'left-14' : 'right-3'}`}>
          <Heart className="w-5 h-5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer" />
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex gap-2">
            <button className="bg-white/90 text-slate-800 p-2 rounded-lg hover:bg-white transition-colors">
              <Eye className="w-4 h-4" />
            </button>
            <button className="bg-emerald-500 text-white p-2 rounded-lg hover:bg-emerald-600 transition-colors">
              <ShoppingBag className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-1 mb-2">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`w-4 h-4 ${i < 4 ? 'text-yellow-400 fill-current' : 'text-slate-300'}`}
            />
          ))}
          <span className="text-sm text-slate-600 ml-1">(24)</span>
        </div>
        <div className="mb-1">
          <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full font-medium">
            {product.category}
          </span>
        </div>
        <h3 className="font-semibold text-slate-800 mb-2">{product.name}</h3>
        <p className="text-slate-600 text-sm mb-4">{product.description}</p>
        <div className="flex items-center justify-between">
          <button
            onClick={() => window.location.href = "https://swiftmetals.co.ke/products"}
            className="w-full bg-gradient-to-r from-emerald-500 to-blue-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all duration-200 transform hover:scale-105 text-sm font-medium"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ================= Loading Skeleton =================
const ProductSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-100 animate-pulse">
    <div className="w-full h-48 bg-gradient-to-br from-slate-200 to-slate-300"></div>
    <div className="p-6 space-y-4">
      <div className="flex space-x-1">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-4 h-4 bg-slate-200 rounded"></div>
        ))}
      </div>
      <div className="w-16 h-4 bg-slate-200 rounded-full"></div>
      <div className="w-3/4 h-5 bg-slate-200 rounded"></div>
      <div className="w-full h-4 bg-slate-200 rounded"></div>
      <div className="w-full h-10 bg-slate-200 rounded-lg"></div>
    </div>
  </div>
);

// ================= Section Divider =================
const SectionDivider: React.FC<SectionDividerProps> = ({ title, description, showNew = false }) => (
  <div className="text-center py-8">
    <div className="flex items-center justify-center gap-3 mb-4">
      {showNew && <Sparkles className="w-6 h-6 text-emerald-500" />}
      <h3 className="text-2xl font-bold text-slate-800">{title}</h3>
      {showNew && <Sparkles className="w-6 h-6 text-emerald-500" />}
    </div>
    <p className="text-slate-600 max-w-2xl mx-auto">{description}</p>
    <div className="w-24 h-1 bg-gradient-to-r from-emerald-500 to-blue-600 mx-auto mt-4 rounded-full"></div>
  </div>
);

// ================= Catalog =================
const Catalog: React.FC<CatalogProps> = ({ products = sampleProducts }) => {
  const [adminProducts, setAdminProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
   const fetchAdminProducts = async () => {
  try {
    setLoading(true);
    const response = await fetch("/api/catalog-products", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Fetched admin products:", data);

    if (Array.isArray(data)) {
      setAdminProducts(
        data.map((p: any) => ({
          name: p.name,
          category: p.category || "Uncategorized",
          image: p.image || "/uploads/placeholder.png",
          description: p.description || "",
          inStock: p.inStock ?? true,
        }))
      );
    } else {
      console.warn("API returned non-array data:", data);
      setAdminProducts([]);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
    console.error("Failed to fetch admin products:", err);
    setError(errorMessage);
    setAdminProducts([]);
  } finally {
    setLoading(false);
  }
};


    fetchAdminProducts();
  }, []);

  if (loading) {
    return (
      <div className="space-y-12">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-emerald-600 mb-4">
            <div className="animate-spin w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full"></div>
            <span className="text-lg font-medium">Loading latest products...</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <ProductSkeleton key={index} />
          ))}
        </div>
      </div> 
    );
  }

  return (
    <div className="space-y-12">
      {/* Admin Products Section */}
      {adminProducts.length > 0 && (
        <div>
          <SectionDivider 
            title="Latest Arrivals" 
            description="Check out our newest products, recently added by our team"
            showNew={true}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {adminProducts.map((product, index) => (
              <ProductCard 
                key={`admin-${index}`} 
                product={product} 
                isNewProduct={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Default Products Section */}
      {products.length > 0 && (
        <div>
          <SectionDivider 
            title="Our Product Range" 
            description="Explore our comprehensive collection of professional-grade tools and equipment"
            showNew={false}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product, index) => (
              <ProductCard 
                key={`default-${index}`} 
                product={product} 
                isNewProduct={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && adminProducts.length === 0 && (
        <div className="text-center py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
            <h3 className="text-red-800 font-semibold mb-2">Unable to Load Latest Products</h3>
            <p className="text-red-600 text-sm">
              Don't worry! Our main catalog is still available below.
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && adminProducts.length === 0 && products.length === 0 && !error && (
        <div className="text-center py-16">
          <div className="bg-slate-50 rounded-2xl p-12 max-w-md mx-auto">
            <ShoppingBag className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-800 mb-2">No Products Available</h3>
            <p className="text-slate-600">
              Our catalog is being updated. Please check back soon!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ================= Inquiry Form =================
const InquiryForm: React.FC = () => (
  <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100">
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-800 mb-4">Have Questions?</h2>
        <p className="text-slate-600">Get in touch with us about any product or inquiry</p>
      </div>
      
      <form className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
            <input
              type="text"
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
            <input
              type="email"
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="your.email@example.com"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
          <input
            type="text"
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="What's your inquiry about?"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Message</label>
          <textarea
            rows={4}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            placeholder="Tell us more about your inquiry..."
          ></textarea>
        </div>
        
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              window.location.href = "mailto:swiftsuppliers0@gmail.com?subject=Inquiry&body=Hello, I would like to...";
            }}
            className="bg-gradient-to-r from-emerald-500 to-blue-600 text-white px-8 py-4 rounded-lg hover:shadow-lg transition-all duration-200 transform hover:scale-105 font-semibold flex items-center justify-center gap-2 mx-auto"
          >
            <MessageCircle className="w-5 h-5" />
            Send Message
          </button>
        </div>
      </form>
    </div>
  </div>
);

// ================= Main Component =================
const UserDashboard: React.FC = () => {
  return (
    <div className="flex h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 font-inter">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Navbar */}
        <Navbar />

        {/* Main Scrollable Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Welcome Banner */}
          <WelcomeBanner />

          <div className="px-8 py-16 space-y-16">
            {/* Catalog Section */}
            <section>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-800 mb-4 text-center tracking-tight">Professional Product Catalog</h2>
                <p className="text-slate-600 text-center max-w-2xl mx-auto leading-relaxed">
                  Discover our comprehensive selection of professional-grade tools and equipment engineered for excellence
                </p>
              </div>
              <Catalog products={sampleProducts} />
            </section>

            {/* Inquiry Section */}
            <section>
              <InquiryForm />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default UserDashboard;