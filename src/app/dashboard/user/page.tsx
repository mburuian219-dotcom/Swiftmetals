"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronRight, 
  ShoppingBag, 
  User, 
  Menu, 
  X, 
  Eye, 
  Bell,
  Search,
  Filter,
  Grid3X3,
  List
} from "lucide-react";
import Image from "next/image";

// --- Sidebar Props ---
interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  activeSection: string;
  setActiveSection: (section: string) => void;
}

// --- Sidebar ---
const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, activeSection, setActiveSection }) => {
  const menuItems = [
    { name: "Browse Products", icon: ShoppingBag },
    { name: "Profile", icon: User }
  ];

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      <div className={`fixed lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out z-50 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } w-64 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl min-h-screen`}>
        
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              Swift Metals
            </h2>
            <p className="text-slate-400 text-sm mt-1">Customer Portal</p>
          </div>
          <button 
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setIsOpen(false)}
          >
            <X size={24} />
          </button>
        </div>

        <nav className="p-6 space-y-2">
          {menuItems.map((item) => (
            <div
              key={item.name}
              onClick={() => setActiveSection(item.name)}
              className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all duration-200 group ${
                activeSection === item.name 
                  ? 'bg-gradient-to-r from-emerald-500/20 to-blue-500/20 border border-emerald-500/30' 
                  : 'hover:bg-slate-700/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <item.icon className={`w-5 h-5 ${
                  activeSection === item.name ? 'text-emerald-400' : 'text-slate-400 group-hover:text-white'
                }`} />
                <span className={`font-medium ${
                  activeSection === item.name ? 'text-white' : 'text-slate-300'
                }`}>
                  {item.name}
                </span>
              </div>
              <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${
                activeSection === item.name ? 'rotate-90' : ''
              }`} />
            </div>
          ))}
        </nav>

        {/* Product Categories */}
        {activeSection === "Browse Products" && (
          <div className="px-6 pb-6">
            <h3 className="text-slate-300 text-sm font-semibold mb-3 uppercase tracking-wider">Categories</h3>
            <div className="space-y-2">
              {["Hand Tools", "Construction", "Kitchen & Cooking", "Agricultural", "Hardware"].map((category) => (
                <div key={category} className="text-slate-400 hover:text-emerald-400 cursor-pointer text-sm py-1 px-2 rounded hover:bg-slate-800/50 transition-all duration-200">
                  {category}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// --- Navbar Props ---
interface NavbarProps {
  onMenuClick: () => void;
}

// --- Navbar ---
const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const router = useRouter();

  return (
    <nav className="bg-white/95 backdrop-blur-xl border-b border-slate-200 px-6 py-4 shadow-sm sticky top-0 z-30">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button 
            className="lg:hidden text-slate-600 hover:text-slate-900"
            onClick={onMenuClick}
          >
            <Menu size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Welcome back!</h1>
            <p className="text-sm text-slate-600">Browse our professional product catalog</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <Bell className="w-6 h-6 text-slate-600 cursor-pointer hover:text-slate-900" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center"></span>
          </div>
          <button
            className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all duration-200 font-medium"
            onClick={() => router.push("/authentication")}
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
};

// --- Product Card Props ---
interface ProductCardProps {
  product: {
    name: string;
    category: string;
    image: string;
    description?: string;
    inStock?: boolean;
  };
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  // Change this to your company’s website or product page
  const companyWebsite = "https://swiftmetals.co.ke/products";

  const handleViewDetails = () => {
    window.open(companyWebsite, "_blank"); // opens in new tab
  };

  return (
    <div className="group cursor-pointer relative">
      <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-slate-100 hover:border-emerald-200 hover:-translate-y-2">
        
        {/* Product Image */}
        <div className="relative h-56 bg-slate-50 overflow-hidden flex items-center justify-center">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              width={300}
              height={200}
              className="object-contain w-full h-full"
            />
          ) : (
            <div className="w-32 h-32 bg-slate-300 rounded-lg flex items-center justify-center text-slate-600 text-sm">
              No Image
            </div>
          )}

          {/* Stock Status */}
          <div className="absolute top-3 left-3">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                product.inStock !== false
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {product.inStock !== false ? "In Stock" : "Out of Stock"}
            </span>
          </div>

          {/* Category Badge */}
          <div className="absolute top-3 right-3">
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {product.category}
            </span>
          </div>
        </div>

        {/* Product Info */}
        <div className="p-6">
          <h3 className="font-bold text-slate-900 text-lg mb-2 capitalize">
            {product.name}
          </h3>

          {product.description && (
            <p className="text-slate-600 text-sm mb-3 line-clamp-2">
              {product.description}
            </p>
          )}

          

          <div className="flex gap-2">
            <button
              onClick={handleViewDetails}
              className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-r from-emerald-500 to-blue-600 text-white hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" /> View Details
            </button>
            <button className="px-4 py-3 rounded-xl font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all duration-200">
              <ShoppingBag className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};



// --- Product Catalog ---
const ProductCatalog: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const products = [
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

  const categories = ["All", ...new Set(products.map(product => product.category))];

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          
          <div className="flex gap-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            
            <button
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              {viewMode === "grid" ? <List className="w-5 h-5" /> : <Grid3X3 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Product Results */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-900">
            {selectedCategory === "All" ? "All Products" : selectedCategory}
          </h3>
          <span className="text-slate-600 bg-slate-100 px-3 py-1 rounded-full text-sm">
            {filteredProducts.length} products
          </span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No products found</h3>
            <p className="text-slate-500">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className={viewMode === "grid" 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
            : "space-y-4"
          }>
            {filteredProducts.map((product, index) => (
              <ProductCard key={index} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


// --- Profile Section ---
const ProfileSection: React.FC = () => (
  <div className="space-y-6">
    {/* Profile Header */}
    <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100 text-center">
      <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
      ola
      </div>
      <h2 className="text-2xl font-bold text-slate-900">welcome again </h2>
      <p className="text-slate-600">Customer</p>
      <p className="text-sm text-slate-500">we value your presence</p>
    </div>

    {/* Quick Features */}
   

    {/* Logout */}
    <div className="text-center">
     
    </div>
  </div>
);


// --- Main User Dashboard ---
function UserDashboard() {
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("Browse Products");

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex h-screen bg-slate-50 items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-blue-50/30">
      <Sidebar 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-8">
          {activeSection === "Browse Products" ? (
            <section>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Product Catalog</h2>
                <p className="text-slate-600">Discover our comprehensive range of professional tools and equipment</p>
              </div>
              <ProductCatalog />
            </section>
          ) : (
            <section>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">My Profile</h2>
                <p className="text-slate-600">Manage your account and view your account</p>
              </div>
              <ProfileSection />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default UserDashboard;