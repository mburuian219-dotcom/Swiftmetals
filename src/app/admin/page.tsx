"use client";
import Link from "next/link";
import { getAuth } from "firebase/auth";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";

import {
  TrendingUp,
  Receipt,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Activity,
  DollarSign,
  ChevronRight,
  Bell,
  X,
  AlertTriangle,
  Info,
  CheckCircle,
  Plus,
  Zap,
  Search,
  Trash2,
  UserPlus,
  Phone,
  Upload,
  Copy,
  CreditCard,
  Wallet,
  Coins,
  User
} from "lucide-react";

interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
}

interface Product {
  id: number;
  name: string;
  price?: number;
  stock?: any;
  productionCost?: number;
  category?: string;
}

interface StaffInventory {
  id: number;
  staffId: number;
  productId: number;
  quantityGiven: number;
  quantitySold: number;
  quantityReturned: number;
  staff: {
    id: number;
    name: string;
  };
  product: {
    id: number;
    name: string;
    price: number;
  };
}

interface Staff {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

interface QuickSaleItem {
  productId: number;
  productName: string;
  quantity: number;
  price: number;
}

interface RestockForm {
  quantity: number;
  costPrice: string;
  paymentSource: "cash" | "credit";
  creditorName: string;
}

interface NewProductForm {
  name: string;
  productionCost: string;
  sellingPrice: string;
  initialStock: string;
  category: string;
}

interface CurrentUser {
  uid: string;
  email: string;
  message?: string;
}

interface PartialPayment {
  cash: string;
  bank_transfer: string;
  till: string;
  [key: string]: string;
}

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;

    const res = await fetch("/api/auth/session", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;

    const data: CurrentUser = await res.json();
    return data;
  } catch (err) {
    console.error("Error fetching current user:", err);
    return null;
  }
}

type PaymentOption = 'cash' | 'bank_transfer' | 'till' | 'partial' | 'credit';

export default function AdminDashboard() {
  const [quickStats, setQuickStats] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showQuickSale, setShowQuickSale] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [saleItems, setSaleItems] = useState<QuickSaleItem[]>([]);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [currentQuantity, setCurrentQuantity] = useState<number>(0);
  const [currentPrice, setCurrentPrice] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [saleSuccess, setSaleSuccess] = useState<string | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);
  const [bankBalance, setBankBalance] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<{ uid: string; email: string } | null>(null);

  // New state for staff inventory
  const [staffInventories, setStaffInventories] = useState<StaffInventory[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [showStaffInventory, setShowStaffInventory] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [assignProductMode, setAssignProductMode] = useState(false);
  const [selectedProductForAssign, setSelectedProductForAssign] = useState<Product | null>(null);
  const [assignQuantity, setAssignQuantity] = useState<number>(1);
  const [assignStaffId, setAssignStaffId] = useState<number | null>(null);

  useEffect(() => {
    fetchCurrentUser().then(user => setCurrentUser(user));
  }, []);

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: ""
  });
  const [addingCustomer, setAddingCustomer] = useState(false);

  const [paymentOption, setPaymentOption] = useState<PaymentOption>('cash');
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [partialPayment, setPartialPayment] = useState<PartialPayment>({
    cash: "",
    bank_transfer: "",
    till: ""
  });

  const [optimisticSale, setOptimisticSale] = useState<any>(null);
  const [optimisticProducts, setOptimisticProducts] = useState<Product[]>([]);

  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockingProduct, setRestockingProduct] = useState<Product | null>(null);
  const [restockForm, setRestockForm] = useState<RestockForm>({
    quantity: 1,
    costPrice: "",
    paymentSource: "cash",
    creditorName: ""
  });
  const [restocking, setRestocking] = useState(false);
  const [restockError, setRestockError] = useState<string | null>(null);

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<NewProductForm>({
    name: "",
    productionCost: "",
    sellingPrice: "",
    initialStock: "0",
    category: ""
  });
  const [addingProduct, setAddingProduct] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [productSuccess, setProductSuccess] = useState<string | null>(null);

  const [categories, setCategories] = useState<string[]>([
    "Metals",
    "Hardware",
    "Tools",
    "Construction",
    "Electrical",
    "Plumbing",
    "Fasteners",
    "Raw Materials",
    "Finished Goods",
    "Other"
  ]);

  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const createSaleButtonRef = useRef<HTMLButtonElement>(null);
  const createSaleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const adminSections = [
    {
      title: "Sales",
      description: "View and manage all sales records and transactions.",
      href: "/admin/sales",
      icon: TrendingUp,
      color: "bg-emerald-500",
      stats: "↑ 12% this month",
    },
    {
      title: "Expenses",
      description: "Track and manage expenses and payments efficiently.",
      href: "/admin/expenses",
      icon: Receipt,
      color: "bg-red-500",
      stats: "KSh 45,230 this month",
    },
    {
      title: "Customers",
      description: "Manage customer relationships and information.",
      href: "/admin/customers",
      icon: Users,
      color: "bg-purple-500",
      stats: "1,247 total customers",
    },
    {
      title: "Reports",
      description: "Generate comprehensive business analytics.",
      href: "/admin/reports",
      icon: BarChart3,
      color: "bg-teal-500",
      stats: "8 reports available",
    },
    {
      title: "Products",
      description: "View and manage your inventory.",
      href: "/admin/products",
      icon: Package,
      color: "bg-gray-600",
      stats: "Last updated 2d ago",
    },
    {
      title: "Staff",
      description: "View and manage your staff.",
      href: "/admin/staff", 
      icon: Users,
      color: "bg-indigo-600",
      stats: "Manage staff inventory",
    },
  ];

  // Fetch staff inventory data
  const fetchStaffInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      // Fetch staff inventory
      const inventoryRes = await fetch("/api/staff-inventory").catch(() => null);
      if (inventoryRes && inventoryRes.ok) {
        const inventoryData = await inventoryRes.json();
        setStaffInventories(Array.isArray(inventoryData) ? inventoryData : []);
      }

      // Fetch staff list
      const staffRes = await fetch("/api/staff").catch(() => null);
      if (staffRes && staffRes.ok) {
        const staffData = await staffRes.json();
        setStaffList(Array.isArray(staffData) ? staffData : []);
      }
    } catch (error) {
      console.error("Error fetching staff inventory:", error);
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ordersRes, productsRes, salesRes] = await Promise.all([
        fetch("/api/orders").catch(() => null),
        fetch("/api/products").catch(() => null),
        fetch("/api/sales").catch(() => null)
      ]);

      let customersRes = await fetch("/api/customer").catch(() => null);
      if (!customersRes || !customersRes.ok) {
        customersRes = await fetch("/api/customer").catch(() => null);
      }

      const parseJSON = async (response: Response | null) => {
        if (!response || !response.ok) return [];
        const text = await response.text();
        if (!text || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
          return [];
        }
        try {
          return JSON.parse(text);
        } catch {
          return [];
        }
      };

      const [orders, productsData, sales, customersData] = await Promise.all([
        parseJSON(ordersRes),
        parseJSON(productsRes),
        parseJSON(salesRes),
        parseJSON(customersRes)
      ]);

      setProducts(Array.isArray(productsData) ? productsData : []);
      setCustomers(Array.isArray(customersData) ? customersData : (customersData?.customers || customersData?.data || []));

      if (Array.isArray(productsData)) {
        const uniqueCategories = Array.from(
          new Set(productsData
            .filter(p => p.category && typeof p.category === 'string')
            .map(p => p.category.trim())
            .filter(Boolean)
          )
        );
        if (uniqueCategories.length > 0) {
          setCategories(prev => {
            const combined = [...new Set([...prev, ...uniqueCategories])];
            return combined;
          });
        }
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayRevenue = sales
        .filter((s: any) => {
          const dateStr = s.createdAt || s.saleDate || s.date || s.created_at;
          if (!dateStr) return false;
          const saleDate = new Date(dateStr);
          saleDate.setHours(0, 0, 0, 0);
          return saleDate.getTime() === today.getTime();
        })
        .reduce((sum: number, s: any) => {
          const amount = s.totalAmount || s.total || s.amount || s.total_amount || 0;
          return sum + amount;
        }, 0);

      const activeOrders = orders.filter((o: any) => o.status === "PENDING").length;
      const lowStockItems = productsData.filter((p: any) => {
        const stock = Array.isArray(p.stock) 
          ? p.stock.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0)
          : (p.stock?.quantity || 0);
        return stock <= 5;
      });
      const criticalStockItems = productsData.filter((p: any) => {
        const stock = Array.isArray(p.stock) 
          ? p.stock.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0)
          : (p.stock?.quantity || 0);
        return stock === 0;
      });

      const newNotifications: any[] = [];

      if (criticalStockItems.length > 0) {
        newNotifications.push({
          id: `critical-stock-${Date.now()}`,
          type: "critical",
          priority: 1,
          icon: AlertTriangle,
          title: "Out of Stock Alert",
          message: `${criticalStockItems.length} product${criticalStockItems.length > 1 ? 's are' : ' is'} out of stock`,
          details: criticalStockItems.slice(0, 3).map((i: any) => i.name).join(", ") + 
                   (criticalStockItems.length > 3 ? ` and ${criticalStockItems.length - 3} more` : ""),
          link: "/admin/products",
          timestamp: new Date().toISOString(),
        });
      }

      if (lowStockItems.length > 0 && criticalStockItems.length < lowStockItems.length) {
        newNotifications.push({
          id: `low-stock-${Date.now()}`,
          type: "warning",
          priority: 2,
          icon: AlertTriangle,
          title: "Low Stock Warning",
          message: `${lowStockItems.length - criticalStockItems.length} product${lowStockItems.length - criticalStockItems.length > 1 ? 's are' : ' is'} running low`,
          link: "/admin/products",
          timestamp: new Date().toISOString(),
        });
      }

      if (activeOrders > 0) {
        newNotifications.push({
          id: `pending-orders-${Date.now()}`,
          type: "info",
          priority: 3,
          icon: ShoppingCart,
          title: "Pending Orders",
          message: `${activeOrders} order${activeOrders > 1 ? 's' : ''} awaiting processing`,
          link: "/admin/orders",
          timestamp: new Date().toISOString(),
        });
      }

      newNotifications.sort((a, b) => a.priority - b.priority);
      
      let bankBalanceValue = 0;

      try {
        let openingBalance = 0;
        try {
          const openingRes = await fetch("/api/daily-opening-balance");
          if (openingRes.ok) {
            const openingData = await openingRes.json();
            if (Array.isArray(openingData) && openingData.length > 0) {
              const latestOpening = openingData.sort((a: any, b: any) => 
                new Date(b.date).getTime() - new Date(a.date).getTime()
              )[0];
              openingBalance = Number(latestOpening?.amount) || 0;
            } else if (openingData && typeof openingData === 'object') {
              openingBalance = Number(openingData.amount) || 0;
            }
          } else {
            const generalRes = await fetch("/api/opening-balance");
            if (generalRes.ok) {
              const generalData = await generalRes.json();
              openingBalance = Number(generalData?.amount) || 50000;
            } else {
              openingBalance = 50000;
            }
          }
        } catch (err) {
          console.error("Error fetching opening balance:", err);
          openingBalance = 50000;
        }
        
        let totalSales = 0;
        let totalCashReceived = 0;
        let totalDebtors = 0;
        
        try {
          const salesRes = await fetch("/api/sales");
          if (!salesRes.ok) {
            throw new Error(`Sales API failed with status: ${salesRes.status}`);
          }
          
          const salesData = await salesRes.json();
          
          if (Array.isArray(salesData)) {
            salesData.forEach((sale: any) => {
              const saleAmount = Number(sale.amount) || 0;
              totalSales += saleAmount;
              
              const payments = sale.payment || sale.payments || [];
              let totalPaidForSale = 0;
              
              if (payments.length > 0) {
                totalPaidForSale = payments
                  .filter((p: any) => {
                    const status = (p.status || '').toUpperCase();
                    return status === 'CLEARED' || status === 'COMPLETED' || 
                           (p.isVerified === true && !p.status) || p.status === 'PENDING';
                  })
                  .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
              } else {
                const saleStatus = (sale.status || '').toUpperCase();
                const paymentMethod = (sale.paymentMethod || '').toUpperCase();
                
                if (saleStatus === 'PAID' && paymentMethod === 'CASH') {
                  totalPaidForSale = saleAmount;
                }
              }
              
              totalCashReceived += totalPaidForSale;
              
              const saleDebt = saleAmount - totalPaidForSale;
              if (saleDebt > 0) {
                totalDebtors += saleDebt;
              }
            });
          }
        } catch (salesError) {
          console.error("Error processing sales data:", salesError);
        }
        
        let totalExpenses = 0;
        try {
          const expensesRes = await fetch("/api/expenses");
          if (expensesRes.ok) {
            const expensesData = await expensesRes.json();
            
            if (Array.isArray(expensesData)) {
              totalExpenses = expensesData.reduce((acc: number, expense: any) => {
                return acc + (Number(expense.amount) || 0);
              }, 0);
            } else if (expensesData && typeof expensesData === 'object') {
              if (Array.isArray(expensesData.expenses)) {
                totalExpenses = expensesData.expenses.reduce((acc: number, expense: any) => {
                  return acc + (Number(expense.amount) || 0);
                }, 0);
              } else if (Array.isArray(expensesData.data)) {
                totalExpenses = expensesData.data.reduce((acc: number, expense: any) => {
                  return acc + (Number(expense.amount) || 0);
                }, 0);
              } else if (expensesData.total !== undefined) {
                totalExpenses = Number(expensesData.total) || 0;
              }
            }
          }
        } catch (expenseError) {
          console.error("Error fetching expenses:", expenseError);
        }
        
        bankBalanceValue = openingBalance + totalCashReceived - totalExpenses;
        
        setBankBalance(bankBalanceValue);
        
      } catch (err) {
        console.error("Error in bank balance calculation:", err);
        setBankBalance(prev => prev !== null ? prev : 0);
        bankBalanceValue = 0;
      }

      setNotifications(newNotifications);

      setQuickStats([
        {
          title: "Today's Revenue",
          value: `KSh ${todayRevenue.toLocaleString()}`,
          change: "+0%",
          icon: DollarSign,
          positive: true,
        },
        {
          title: "Active Orders",
          value: activeOrders.toString(),
          change: `${activeOrders} pending`,
          icon: ShoppingCart,
          positive: true,
        },
        {
          title: "Low Stock Items",
          value: lowStockItems.length.toString(),
          change: criticalStockItems.length > 0 ? `${criticalStockItems.length} critical` : "Good",
          icon: Package,
          positive: lowStockItems.length === 0,
        },
        {
          title: "Bank Balance",
          value: `KSh ${bankBalanceValue.toLocaleString()}`,
          change: "View Details",
          icon: Activity,
          positive: bankBalanceValue !== null && bankBalanceValue > 0,
        },
      ]);
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    fetchStaffInventory();
  }, [fetchDashboardData, fetchStaffInventory]);

  useEffect(() => {
    if (!showQuickSale) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(target)) {
        setShowCustomerDropdown(false);
      }
      
      if (productDropdownRef.current && !productDropdownRef.current.contains(target)) {
        setShowProductDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showQuickSale]);

  useEffect(() => {
    const total = calculateTotalAmount();
    if (paymentOption === 'cash' || paymentOption === 'bank_transfer' || paymentOption === 'till') {
      setAmountPaid(total.toFixed(2));
    } else if (paymentOption === 'credit') {
      setAmountPaid("0");
    }
  }, [saleItems, paymentOption]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 10);
    return customers.filter(c => 
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(customerSearch))
    ).slice(0, 10);
  }, [customers, customerSearch]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 10);
    return products.filter(p => 
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(productSearch.toLowerCase()))
    ).slice(0, 10);
  }, [products, productSearch]);

  const getProductStock = (product: Product) => {
    if (Array.isArray(product.stock)) {
      return product.stock.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0);
    }
    return product.stock?.quantity || 0;
  };

  // Calculate assigned inventory for a product
  const getAssignedInventory = (productId: number) => {
    return staffInventories
      .filter(inv => inv.productId === productId)
      .reduce((sum, inv) => sum + (inv.quantityGiven - inv.quantitySold - inv.quantityReturned), 0);
  };

  // Calculate available (unassigned) inventory for a product - KEEP FOR DISPLAY ONLY
  const getAvailableInventory = (product: Product) => {
    const totalStock = getProductStock(product);
    const assigned = getAssignedInventory(product.id);
    return Math.max(0, totalStock - assigned);
  };

  const isLowStock = (product: Product) => {
    const totalStock = getProductStock(product);
    return totalStock <= 5;
  };

  const isOutOfStock = (product: Product) => {
    const totalStock = getProductStock(product);
    return totalStock === 0;
  };

  const handleAssignToStaff = async () => {
    if (!selectedProductForAssign || !assignStaffId || assignQuantity <= 0) {
      setSaleError("Please select staff and enter valid quantity");
      return;
    }

    const availableStock = getAvailableInventory(selectedProductForAssign);
    if (assignQuantity > availableStock) {
      setSaleError(`Only ${availableStock} units available to assign`);
      return;
    }

    try {
      const response = await fetch("/api/staff-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: assignStaffId,
          productId: selectedProductForAssign.id,
          quantityGiven: assignQuantity
        })
      });

      if (!response.ok) {
        throw new Error("Failed to assign inventory");
      }

      await fetchStaffInventory(); // Refresh inventory data
      setAssignProductMode(false);
      setSelectedProductForAssign(null);
      setAssignQuantity(1);
      setAssignStaffId(null);
      setSaleSuccess("✅ Inventory assigned to staff successfully!");
      setTimeout(() => setSaleSuccess(null), 3000);
    } catch (error: any) {
      console.error("Error assigning inventory:", error);
      setSaleError(error.message || "Failed to assign inventory");
    }
  };

  const getStaffName = (staffId: number) => {
    const staff = staffList.find(s => s.id === staffId);
    return staff?.name || "Unknown";
  };

  const handleImportFromContacts = async () => {
    try {
      if ('contacts' in navigator && 'ContactsManager' in window) {
        // @ts-ignore
        const contacts = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: false });
        
        if (contacts && contacts.length > 0) {
          const contact = contacts[0];
          setNewCustomer({
            name: contact.name?.[0] || "",
            phone: contact.tel?.[0] || "",
            email: contact.email?.[0] || ""
          });
        }
      } else {
        try {
          const text = await navigator.clipboard.readText();
          if (text.includes('BEGIN:VCARD')) {
            const lines = text.split('\n');
            let name = '', phone = '', email = '';
            
            for (const line of lines) {
              if (line.startsWith('FN:')) name = line.substring(3);
              if (line.startsWith('TEL;')) phone = line.split(':')[1];
              if (line.startsWith('EMAIL;')) email = line.split(':')[1];
            }
            
            setNewCustomer({ name, phone, email });
          } else {
            setNewCustomer(prev => ({ ...prev, name: text }));
          }
        } catch (clipboardError) {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.vcf,.vcard,text/vcard';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (event) => {
                const content = event.target?.result as string;
                const lines = content.split('\n');
                let name = '', phone = '', email = '';
                
                for (const line of lines) {
                  if (line.startsWith('FN:')) name = line.substring(3);
                  if (line.startsWith('TEL;')) phone = line.split(':')[1];
                  if (line.startsWith('EMAIL;')) email = line.split(':')[1];
                }
                
                setNewCustomer({ name, phone, email });
              };
              reader.readAsText(file);
            }
          };
          input.click();
        }
      }
    } catch (error) {
      console.error("Error importing from contacts:", error);
      setSaleError("Failed to import contact. Please enter manually.");
      setTimeout(() => setSaleError(null), 3000);
    }
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.name.trim()) {
      setSaleError("Customer name is required");
      setTimeout(() => setSaleError(null), 3000);
      return;
    }

    setAddingCustomer(true);

    try {
      const response = await fetch("/api/customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          name: newCustomer.name.trim(),
          phone: newCustomer.phone.trim() || undefined,
          email: newCustomer.email.trim() || undefined
        })
      });

      const rawBody = await response.text();

      let data: any = null;
      let parseError = false;

      try {
        data = JSON.parse(rawBody);
      } catch {
        parseError = true;
      }

      if (!response.ok) {
        const errorMessage =
          (!parseError && (data?.error || data?.message)) ||
          rawBody ||
          "Failed to create customer";

        throw new Error(errorMessage);
      }

      const createdCustomer = !parseError
        ? data
        : {
            id: Date.now(),
            name: newCustomer.name.trim(),
            phone: newCustomer.phone.trim() || undefined,
            email: newCustomer.email.trim() || undefined
          };

      setCustomers(prev => [...prev, createdCustomer]);
      setSelectedCustomer(createdCustomer);
      setShowAddCustomer(false);
      setNewCustomer({ name: "", phone: "", email: "" });

      setSaleSuccess("Customer added successfully!");
      setTimeout(() => setSaleSuccess(null), 2000);

    } catch (error: any) {
      console.error("Error creating customer:", error);
      setSaleError(error.message || "Failed to create customer");
      setTimeout(() => setSaleError(null), 3000);
    } finally {
      setAddingCustomer(false);
    }
  };

  const handleCreateProduct = async () => {
    if (!newProduct.name.trim()) {
      setProductError("Product name is required");
      setTimeout(() => setProductError(null), 3000);
      return;
    }

    const productionCost = parseFloat(newProduct.productionCost);
    const sellingPrice = parseFloat(newProduct.sellingPrice);
    
    const stockStr = newProduct.initialStock.trim();
    const initialStock = stockStr === "" ? 0 : parseInt(stockStr, 10);

    if (isNaN(productionCost) || productionCost <= 0) {
      setProductError("Please enter a valid production cost greater than 0");
      setTimeout(() => setProductError(null), 3000);
      return;
    }

    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      setProductError("Please enter a valid selling price greater than 0");
      setTimeout(() => setProductError(null), 3000);
      return;
    }

    if (sellingPrice <= productionCost) {
      setProductError("Selling price must be greater than production cost");
      setTimeout(() => setProductError(null), 3000);
      return;
    }

    if (isNaN(initialStock) || initialStock < 0) {
      setProductError("Please enter a valid initial stock (0 or greater)");
      setTimeout(() => setProductError(null), 3000);
      return;
    }

    if (!newProduct.category.trim()) {
      setProductError("Please select a category for the product");
      setTimeout(() => setProductError(null), 3000);
      return;
    }

    setAddingProduct(true);
    setProductError(null);

    try {
      const requestBody = {
        name: newProduct.name.trim(),
        productionCost: productionCost,
        price: sellingPrice,
        stockQuantity: initialStock,
        category: newProduct.category.trim(),
        description: ""
      };

      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      const rawBody = await response.text();
      let data: any = null;
      
      try {
        data = JSON.parse(rawBody);
      } catch {
        if (response.ok) {
          data = {
            id: Date.now(),
            name: newProduct.name.trim(),
            productionCost,
            price: sellingPrice,
            stockQuantity: initialStock,
            category: newProduct.category.trim()
          };
        }
      }

      if (!response.ok) {
        const errorMessage = data?.error || data?.message || rawBody || "Failed to create product";
        throw new Error(errorMessage);
      }

      const createdProduct = {
        id: data.id || Date.now(),
        name: newProduct.name.trim(),
        productionCost,
        price: sellingPrice,
        stock: initialStock,
        category: newProduct.category.trim()
      };

      setProducts(prev => [...prev, createdProduct]);
      
      if (newProduct.category.trim() && !categories.includes(newProduct.category.trim())) {
        setCategories(prev => [...prev, newProduct.category.trim()]);
      }
      
      setNewProduct({
        name: "",
        productionCost: "",
        sellingPrice: "",
        initialStock: "0",
        category: ""
      });
      
      setShowAddProduct(false);
      setProductSuccess(`✅ Product "${createdProduct.name}" created successfully with ${initialStock} units in stock!`);
      setTimeout(() => setProductSuccess(null), 3000);

      setTimeout(() => {
        fetchDashboardData().catch(console.error);
      }, 1000);

    } catch (error: any) {
      console.error("Error creating product:", error);
      setProductError(error.message || "Failed to create product");
      setTimeout(() => setProductError(null), 5000);
    } finally {
      setAddingProduct(false);
    }
  };

  const createSaleMutation = async (saleData: any, idToken: string) => {
    const response = await fetch("/api/sales", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify(saleData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "Failed to create sale";
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    return await response.json();
  };

  const handleCreateSaleOptimistic = async () => {
    if (!selectedCustomer) {
      setSaleError("Please select a customer");
      setTimeout(() => setSaleError(null), 3000);
      return;
    }

    if (saleItems.length === 0) {
      setSaleError("Please add at least one item to the sale");
      setTimeout(() => setSaleError(null), 3000);
      return;
    }

    // Check if any items are out of stock - NOW CHECKING TOTAL STOCK INSTEAD OF AVAILABLE
    for (const item of saleItems) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        const totalStock = getProductStock(product);
        if (totalStock < item.quantity) {
          setSaleError(`Insufficient total stock for ${product.name}. Total stock: ${totalStock}`);
          return;
        }
      }
    }

    const totalAmount = calculateTotalAmount();

    if (paymentOption === "partial") {
      const totalPartial = Object.values(partialPayment)
        .reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
      
      if (totalPartial <= 0) {
        setSaleError("Please enter at least one partial payment amount");
        setTimeout(() => setSaleError(null), 3000);
        return;
      }
      
      if (totalPartial > totalAmount) {
        setSaleError("Partial payment cannot exceed total amount");
        setTimeout(() => setSaleError(null), 3000);
        return;
      }
    }

    if (paymentOption === "partial" && (!amountPaid || isNaN(parseFloat(amountPaid)) || parseFloat(amountPaid) <= 0)) {
      setSaleError("Please enter a valid payment amount");
      setTimeout(() => setSaleError(null), 3000);
      return;
    }

    if (paymentOption === "partial" && parseFloat(amountPaid) > totalAmount) {
      setSaleError("Payment amount cannot exceed total amount");
      setTimeout(() => setSaleError(null), 3000);
      return;
    }

    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      setSaleError("You must be logged in to create a sale");
      setTimeout(() => setSaleError(null), 3000);
      return;
    }

    const idToken = await user.getIdToken();
    
    const saleData: any = {
      customerId: selectedCustomer.id,
      amount: totalAmount,
      saleItems: saleItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      })),
      date: new Date().toISOString(),
      paymentMethod: paymentOption.toUpperCase().replace('_', ' '),
      payments: [],
      userId: user.uid,
      userName: user.displayName || user.email || "Unknown User",
    };

    // Add payment based on payment option
    if (paymentOption === 'cash' || paymentOption === 'bank_transfer' || paymentOption === 'till') {
      saleData.payments.push({
        amount: totalAmount,
        method: paymentOption.toUpperCase().replace('_', ' '),
        status: "CLEARED",
        paidAt: new Date().toISOString(),
      });
      saleData.status = "PAID";
    } else if (paymentOption === 'partial') {
      const paidAmount = parseFloat(amountPaid) || 0;
      
      // Create payments array based on partial payment breakdown
      saleData.payments = [];
      
      // Add cash payment if any
      const cashAmount = parseFloat(partialPayment.cash) || 0;
      if (cashAmount > 0) {
        saleData.payments.push({
          amount: cashAmount,
          method: "CASH",
          status: "CLEARED",
          paidAt: new Date().toISOString(),
        });
      }
      
      // Add bank transfer payment if any
      const bankAmount = parseFloat(partialPayment.bank_transfer) || 0;
      if (bankAmount > 0) {
        saleData.payments.push({
          amount: bankAmount,
          method: "BANK TRANSFER",
          status: "CLEARED",
          paidAt: new Date().toISOString(),
        });
      }
      
      // Add till payment if any
      const tillAmount = parseFloat(partialPayment.till) || 0;
      if (tillAmount > 0) {
        saleData.payments.push({
          amount: tillAmount,
          method: "TILL",
          status: "CLEARED",
          paidAt: new Date().toISOString(),
        });
      }
      
      saleData.status = "PARTIAL";
      saleData.partialPayments = partialPayment; // Store the breakdown
    } else if (paymentOption === 'credit') {
      saleData.status = "UNPAID";
    }

    setOptimisticSale(saleData);

    const updatedProducts = products.map(product => {
      const saleItem = saleItems.find(item => item.productId === product.id);
      if (saleItem) {
        const currentStock = getProductStock(product);
        return {
          ...product,
          stock: { quantity: Math.max(0, currentStock - saleItem.quantity) },
        };
      }
      return product;
    });

    setOptimisticProducts(updatedProducts);
    setIsCreating(true);
    setSaleError(null);

    if (createSaleTimeoutRef.current) clearTimeout(createSaleTimeoutRef.current);

    const createSalePromise = new Promise<void>(resolve => {
      createSaleTimeoutRef.current = setTimeout(async () => {
        try {
          const result = await createSaleMutation(saleData, idToken);

          setSaleSuccess("Sale created successfully! 🎉");

          setSelectedCustomer(null);
          setCustomerSearch("");
          setSaleItems([]);
          setCurrentProduct(null);
          setProductSearch("");
          setCurrentQuantity(0);
          setCurrentPrice("");
          setPaymentOption("cash");
          setAmountPaid("");
          setPartialPayment({ cash: "", bank_transfer: "", till: "" });

          setTimeout(() => {
            fetchDashboardData().catch(console.error);
            fetchStaffInventory().catch(console.error);
          }, 1000);

          setTimeout(() => {
            setSaleSuccess(null);
            setShowQuickSale(false);
            setOptimisticSale(null);
            setOptimisticProducts([]);
            setIsCreating(false);
            resolve();
          }, 1500);
        } catch (error: any) {
          setOptimisticSale(null);
          setOptimisticProducts([]);
          setSaleError(error.message || "Failed to create sale");
          setIsCreating(false);
          resolve();
        }
      }, 100);
    });

    await createSalePromise;
  };

  const displayProducts = optimisticProducts.length > 0 ? optimisticProducts : products;

  const openRestockModal = (product: Product) => {
    setRestockingProduct(product);
    setRestockForm({
      quantity: 1,
      costPrice: product.price?.toString() || "",
      paymentSource: "cash",
      creditorName: ""
    });
    setRestockError(null);
    setShowRestockModal(true);
  };

  const closeRestockModal = () => {
    setShowRestockModal(false);
    setRestockingProduct(null);
    setRestockForm({
      quantity: 1,
      costPrice: "",
      paymentSource: "cash",
      creditorName: ""
    });
    setRestockError(null);
  };

  const handleRestockSubmit = async () => {
    if (!restockingProduct) return;

    if (restockForm.quantity <= 0) {
      setRestockError("Quantity must be greater than 0");
      setTimeout(() => setRestockError(null), 3000);
      return;
    }

    const costPrice = parseFloat(restockForm.costPrice);
    if (isNaN(costPrice) || costPrice <= 0) {
      setRestockError("Please enter a valid cost price");
      setTimeout(() => setRestockError(null), 3000);
      return;
    }

    if (restockForm.paymentSource === "credit" && !restockForm.creditorName.trim()) {
      setRestockError("Creditor name is required for credit purchases");
      setTimeout(() => setRestockError(null), 3000);
      return;
    }

    setRestocking(true);
    setRestockError(null);

    try {
      const totalCost = restockForm.quantity * costPrice;

      const requestBody: any = {
        productId: restockingProduct.id,
        quantity: restockForm.quantity,
        costPrice: costPrice,
        totalCost: totalCost,
        paymentSource: restockForm.paymentSource.toLowerCase(),
      };

      if (restockForm.paymentSource === "credit") {
        requestBody.creditorName = restockForm.creditorName.trim();
      }

      const response = await fetch("/api/restock", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Failed to restock product";
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const responseData = await response.json();

      setSaleSuccess(`✅ ${restockingProduct.name} restocked successfully!`);
      setTimeout(() => setSaleSuccess(null), 3000);

      setProducts(prev => prev.map(p => 
        p.id === restockingProduct.id 
          ? { 
              ...p, 
              stock: { 
                quantity: getProductStock(p) + restockForm.quantity 
              } 
            }
          : p
      ));

      if (currentProduct && currentProduct.id === restockingProduct.id) {
        setCurrentProduct(prev => prev ? {
          ...prev,
          stock: { quantity: getProductStock(prev) + restockForm.quantity }
        } : null);
      }

      closeRestockModal();

    } catch (error: any) {
      console.error("Error restocking:", error);
      setRestockError(error.message || "Failed to restock product");
    } finally {
      setRestocking(false);
    }
  };

  const addItemToSale = () => {
    if (!currentProduct || currentQuantity <= 0) {
      setSaleError("Please select a product and enter quantity greater than 0");
      setTimeout(() => setSaleError(null), 3000);
      return;
    }

    let price = 0;
    if (currentPrice && currentPrice.trim() !== "") {
      price = parseFloat(currentPrice);
    } else if (currentProduct.price) {
      price = currentProduct.price;
    }
    
    if (isNaN(price) || price <= 0) {
      setSaleError("Please enter a valid price or ensure product has a default price");
      setTimeout(() => setSaleError(null), 3000);
      return;
    }

    // NOW CHECKING TOTAL STOCK INSTEAD OF AVAILABLE
    const totalStock = getProductStock(currentProduct);
    const existingItem = saleItems.find(i => i.productId === currentProduct.id);
    const totalQuantity = (existingItem?.quantity || 0) + currentQuantity;

    if (totalQuantity > totalStock) {
      const errorMsg = `Insufficient total stock for ${currentProduct.name}. Total stock: ${totalStock}, Requested: ${totalQuantity}`;
      setStockError(errorMsg);
      setSaleError(errorMsg);
      setTimeout(() => {
        setStockError(null);
        setSaleError(null);
      }, 5000);
      return;
    }
    
    if (existingItem) {
      setSaleItems(saleItems.map(item => 
        item.productId === currentProduct.id 
          ? { ...item, quantity: item.quantity + currentQuantity, price }
          : item
      ));
    } else {
      setSaleItems([...saleItems, {
        productId: currentProduct.id,
        productName: currentProduct.name,
        quantity: currentQuantity,
        price
      }]);
    }

    setCurrentProduct(null);
    setCurrentQuantity(0);
    setCurrentPrice("");
    setProductSearch("");
    setShowProductDropdown(false);
    setSaleError(null);
    setStockError(null);
  };

  const removeItem = (productId: number) => {
    setSaleItems(saleItems.filter(i => i.productId !== productId));
  };

  const calculateTotalAmount = () => {
    return saleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const getNotificationStyles = (type: string) => {
    switch (type) {
      case "critical":
        return {
          bg: "bg-red-50",
          border: "border-red-200",
          text: "text-red-700",
          iconBg: "bg-red-100",
          iconColor: "text-red-600",
        };
      case "warning":
        return {
          bg: "bg-orange-50",
          border: "border-orange-200",
          text: "text-orange-700",
          iconBg: "bg-orange-100",
          iconColor: "text-orange-600",
        };
      case "success":
        return {
          bg: "bg-emerald-50",
          border: "border-emerald-200",
          text: "text-emerald-700",
          iconBg: "bg-emerald-100",
          iconColor: "text-emerald-600",
        };
      default:
        return {
          bg: "bg-blue-50",
          border: "border-blue-200",
          text: "text-blue-700",
          iconBg: "bg-blue-100",
          iconColor: "text-blue-600",
        };
    }
  };

  const notificationCount = useMemo(() => notifications.length, [notifications]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header - Mobile Optimized */}
      <div className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="px-3 sm:px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-slate-900 truncate">
                SWIFT METALS <span className="text-blue-600 text-base">Admin</span>
              </h1>
              <p className="text-xs text-black mt-0.5">Your business at a glance</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowQuickSale(true)}
                type="button"
                className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-2 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow font-medium text-sm"
              >
                <Zap className="w-4 h-4" />
                <span className="hidden xs:inline">Sale</span>
              </button>

             

              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  type="button"
                  className="relative p-2 rounded-full bg-blue-100 hover:bg-blue-200 transition-colors"
                >
                  <Bell className="w-4 h-4 text-blue-700" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-xs font-bold text-white bg-red-500 rounded-full">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 md:hidden"
                      onClick={() => setShowNotifications(false)}
                    />
                    
                    <div className="fixed inset-x-3 top-16 md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-3 w-auto md:w-96 bg-white shadow-2xl rounded-xl border border-slate-200 z-50 max-h-[calc(100vh-5rem)] md:max-h-[600px] flex flex-col">
                      <div className="flex items-center justify-between px-3 py-2 border-b bg-slate-50 rounded-t-xl">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-black">Notifications</h3>
                          {notificationCount > 0 && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                              {notificationCount}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setShowNotifications(false)}
                          type="button"
                          className="text-slate-500 hover:text-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8">
                          <Bell className="w-10 h-10 text-slate-400 mb-2" />
                          <p className="text-sm text-black">All caught up!</p>
                        </div>
                      ) : (
                        <ul className="overflow-y-auto flex-1">
                          {notifications.map((note) => {
                            const styles = getNotificationStyles(note.type);
                            const Icon = note.icon || Info;
                            
                            return (
                              <li key={note.id} className={`px-3 py-3 border-b ${styles.bg}`}>
                                <div className="flex gap-2">
                                  <div className={`${styles.iconBg} p-1.5 rounded-lg h-fit`}>
                                    <Icon className={`w-4 h-4 ${styles.iconColor}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={`font-semibold text-xs ${styles.text} truncate`}>{note.title}</p>
                                    <p className="text-xs text-black line-clamp-2">{note.message}</p>
                                    {note.link && (
                                      <Link
                                        href={note.link}
                                        onClick={() => setShowNotifications(false)}
                                        className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                                      >
                                        View details →
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Inventory Modal */}
      {showStaffInventory && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl mt-4 sm:mt-0">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-4 sm:p-6 rounded-t-xl sm:rounded-t-2xl z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Users className="w-6 h-6 sm:w-8 sm:h-8" />
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold">Staff Inventory</h2>
                    <p className="text-indigo-100 text-xs sm:text-sm">Manage assigned and unassigned items</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowStaffInventory(false);
                    setAssignProductMode(false);
                  }}
                  type="button"
                  className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Assign New Items Section */}
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4">
                <h3 className="font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Assign Items to Staff
                </h3>
                
                {!assignProductMode ? (
                  <button
                    onClick={() => setAssignProductMode(true)}
                    className="w-full py-3 bg-white border-2 border-dashed border-indigo-300 rounded-lg text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Assign New Item
                  </button>
                ) : (
                  <div className="space-y-3">
                    {/* Product Selection */}
                    <div>
                      <label className="block text-sm font-medium text-indigo-900 mb-1">
                        Select Product *
                      </label>
                      <select
                        value={selectedProductForAssign?.id || ""}
                        onChange={(e) => {
                          const product = products.find(p => p.id === parseInt(e.target.value));
                          setSelectedProductForAssign(product || null);
                        }}
                        className="w-full px-3 py-2 border border-indigo-300 rounded-lg focus:border-indigo-500 text-black text-sm"
                      >
                        <option value="">Choose a product...</option>
                        {products.map(product => {
                          const available = getAvailableInventory(product);
                          return (
                            <option key={product.id} value={product.id} disabled={available === 0}>
                              {product.name} - Available: {available} units
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Staff Selection */}
                    <div>
                      <label className="block text-sm font-medium text-indigo-900 mb-1">
                        Assign to Staff *
                      </label>
                      <select
                        value={assignStaffId || ""}
                        onChange={(e) => setAssignStaffId(parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-indigo-300 rounded-lg focus:border-indigo-500 text-black text-sm"
                      >
                        <option value="">Select staff member...</option>
                        {staffList.map(staff => (
                          <option key={staff.id} value={staff.id}>
                            {staff.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-sm font-medium text-indigo-900 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={selectedProductForAssign ? getAvailableInventory(selectedProductForAssign) : 1}
                        value={assignQuantity}
                        onChange={(e) => setAssignQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 border border-indigo-300 rounded-lg focus:border-indigo-500 text-black text-sm"
                      />
                      {selectedProductForAssign && (
                        <p className="text-xs text-indigo-700 mt-1">
                          Max available: {getAvailableInventory(selectedProductForAssign)} units
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => {
                          setAssignProductMode(false);
                          setSelectedProductForAssign(null);
                          setAssignQuantity(1);
                          setAssignStaffId(null);
                        }}
                        className="flex-1 px-3 py-2 border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-100"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAssignToStaff}
                        disabled={!selectedProductForAssign || !assignStaffId || assignQuantity <= 0}
                        className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Current Assignments */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Current Staff Assignments
                </h3>

                {inventoryLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="text-sm text-gray-600 mt-2">Loading inventory...</p>
                  </div>
                ) : staffInventories.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">No items assigned yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {staffList.map(staff => {
                      const staffItems = staffInventories.filter(inv => inv.staffId === staff.id);
                      if (staffItems.length === 0) return null;

                      return (
                        <div key={staff.id} className="border rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2 border-b">
                            <h4 className="font-semibold text-gray-900">{staff.name}</h4>
                          </div>
                          <div className="divide-y">
                            {staffItems.map(inv => {
                              const remaining = inv.quantityGiven - inv.quantitySold - inv.quantityReturned;
                              return (
                                <div key={inv.id} className="px-4 py-3 flex justify-between items-center">
                                  <div>
                                    <p className="font-medium text-gray-900">{inv.product.name}</p>
                                    <p className="text-xs text-gray-600">
                                      Given: {inv.quantityGiven} | Sold: {inv.quantitySold} | 
                                      Returned: {inv.quantityReturned}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <span className={`text-sm font-bold ${
                                      remaining > 0 ? 'text-green-600' : 'text-gray-400'
                                    }`}>
                                      Remaining: {remaining}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Unassigned Inventory Overview */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Available (Unassigned) Inventory
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {products
                    .filter(p => getAvailableInventory(p) > 0)
                    .map(product => (
                      <div key={product.id} className="bg-white rounded-lg p-3 border border-green-200">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{product.name}</p>
                            <p className="text-xs text-gray-600">Category: {product.category || 'Uncategorized'}</p>
                          </div>
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm font-bold">
                            {getAvailableInventory(product)} units
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Quick Sale Modal - Mobile Optimized */}
      {showQuickSale && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl mt-4 sm:mt-0">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 sm:p-6 rounded-t-xl sm:rounded-t-2xl z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Zap className="w-6 h-6 sm:w-8 sm:h-8" />
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold">Quick Sale</h2>
                    <p className="text-blue-100 text-xs sm:text-sm">Create sale in seconds</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowQuickSale(false);
                    setSaleError(null);
                    setSaleSuccess(null);
                    setStockError(null);
                    setOptimisticSale(null);
                    setOptimisticProducts([]);
                    setPartialPayment({ cash: "", bank_transfer: "", till: "" });
                  }}
                  type="button"
                  className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {optimisticSale && (
                <div className="bg-yellow-50 border-2 border-yellow-300 text-yellow-800 px-3 py-2 rounded-lg flex items-center gap-2 text-sm">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>Creating sale... This may take a moment.</span>
                </div>
              )}

              {saleError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{saleError}</span>
                  </div>
                  <button onClick={() => setSaleError(null)} type="button" className="text-red-700 hover:text-red-900">
                    <X size={14} />
                  </button>
                </div>
              )}

              {saleSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{saleSuccess}</span>
                </div>
              )}

              {/* Customer Selection - Mobile Optimized */}
              <div className="relative" ref={customerDropdownRef}>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-black">Customer *</label>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomer(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    <UserPlus className="w-3 h-3" />
                    Add
                  </button>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                  <input
                    type="text"
                    placeholder="Search customer..."
                    value={selectedCustomer ? selectedCustomer.name : customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setSelectedCustomer(null);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="w-full pl-9 pr-4 py-2.5 border-2 border-black rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-black placeholder-black text-sm"
                  />
                </div>

                {showCustomerDropdown && !selectedCustomer && filteredCustomers.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border-2 border-black rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {filteredCustomers.map(customer => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedCustomer(customer);
                          setCustomerSearch("");
                          setShowCustomerDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0 transition-colors text-sm"
                      >
                        <div className="font-medium text-black truncate">{customer.name}</div>
                        {customer.phone && <div className="text-xs text-black truncate">{customer.phone}</div>}
                      </button>
                    ))}
                  </div>
                )}

                {selectedCustomer && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-black truncate">{selectedCustomer.name}</div>
                      {selectedCustomer.phone && <div className="text-xs text-black truncate">{selectedCustomer.phone}</div>}
                    </div>
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  </div>
                )}
              </div>

              {/* Add Customer Modal - Mobile Optimized */}
              {showAddCustomer && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-blue-900 text-sm">Add New Customer</h4>
                    <button
                      onClick={() => setShowAddCustomer(false)}
                      type="button"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-black mb-1">Name *</label>
                      <input
                        type="text"
                        value={newCustomer.name}
                        onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:border-blue-500 text-black text-sm"
                        placeholder="Enter customer name"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-black mb-1">Phone</label>
                      <input
                        type="tel"
                        value={newCustomer.phone}
                        onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:border-blue-500 text-black text-sm"
                        placeholder="Phone number"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-black mb-1">Email</label>
                      <input
                        type="email"
                        value={newCustomer.email}
                        onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:border-blue-500 text-black text-sm"
                        placeholder="Email address"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleImportFromContacts}
                      type="button"
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 text-xs"
                    >
                      <Phone className="w-3 h-3" />
                      Import
                    </button>
                    
                    <button
                      onClick={handleCreateCustomer}
                      disabled={addingCustomer || !newCustomer.name.trim()}
                      type="button"
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-xs"
                    >
                      {addingCustomer ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                          Adding...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3 h-3" />
                          Add Customer
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Product Selection - Mobile Optimized */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-black">Add Products</label>
                  <button
                    type="button"
                    onClick={() => setShowAddProduct(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="relative" ref={productDropdownRef}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black pointer-events-none z-10" />
                    <input
                      type="text"
                      placeholder="Search product..."
                      value={currentProduct ? "" : productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setShowProductDropdown(true);
                      }}
                      onFocus={() => {
                        if (!currentProduct) {
                          setShowProductDropdown(true);
                        }
                      }}
                      disabled={!!currentProduct}
                      className="w-full pl-9 pr-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:bg-slate-100 disabled:cursor-not-allowed text-black placeholder-black text-sm"
                    />

                    {showProductDropdown && !currentProduct && filteredProducts.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border-2 border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        {filteredProducts.map(product => {
                          const assigned = getAssignedInventory(product.id);
                          const available = getAvailableInventory(product);
                          const total = getProductStock(product);
                          
                          return (
                            <button
                              key={product.id}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setCurrentProduct(product);
                                setCurrentPrice(product.price?.toString() || "");
                                setProductSearch("");
                                setShowProductDropdown(false);
                                setStockError(null);
                                setTimeout(() => {
                                  document.getElementById('quantity-input')?.focus();
                                }, 100);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0 transition-colors text-sm"
                            >
                              <div className="flex justify-between items-start">
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-black truncate">{product.name}</div>
                                  <div className="text-xs text-black">
                                    {product.category && (
                                      <span className="inline-block px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs mr-1 truncate max-w-[80px]">
                                        {product.category}
                                      </span>
                                    )}
                                    <div className="mt-1 flex flex-wrap gap-2">
                                      <span className="text-green-700">Unassigned: {available}</span>
                                      <span className="text-orange-700">Assigned: {assigned}</span>
                                      <span className="text-gray-600">Total: {total}</span>
                                    </div>
                                    <span className="text-gray-600">KSh {product.price?.toLocaleString() || 0}</span>
                                  </div>
                                </div>
                                {total === 0 && (
                                  <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full ml-2 whitespace-nowrap">
                                    Out of Stock
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {currentProduct && (
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                      {/* Enhanced Stock Info with Total Stock Display */}
                      <div className={`mb-3 p-2 rounded-lg border-2 ${
                        isOutOfStock(currentProduct) 
                          ? 'bg-red-50 border-red-300' 
                          : isLowStock(currentProduct)
                          ? 'bg-orange-50 border-orange-300'
                          : 'bg-green-50 border-green-300'
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-1.5 flex-1">
                            {isOutOfStock(currentProduct) || isLowStock(currentProduct) ? (
                              <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                                isOutOfStock(currentProduct) ? 'text-red-600' : 'text-orange-600'
                              }`} />
                            ) : (
                              <Package className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold text-xs ${
                                isOutOfStock(currentProduct) 
                                  ? 'text-red-800' 
                                  : isLowStock(currentProduct)
                                  ? 'text-orange-800'
                                  : 'text-green-800'
                              } truncate`}>
                                {isOutOfStock(currentProduct) 
                                  ? '⚠️ OUT OF STOCK' 
                                  : isLowStock(currentProduct)
                                  ? '⚠️ LOW STOCK'
                                  : '✓ In Stock'}
                              </p>
                              <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
                                <div className="text-xs">
                                  <span className="text-green-700 font-medium">Unassigned: </span>
                                  <span className="font-bold">{getAvailableInventory(currentProduct)}</span>
                                </div>
                                <div className="text-xs">
                                  <span className="text-orange-700 font-medium">Assigned: </span>
                                  <span className="font-bold">{getAssignedInventory(currentProduct.id)}</span>
                                </div>
                                <div className="text-xs col-span-2">
                                  <span className="text-gray-600 font-medium">Total Stock: </span>
                                  <span className="font-bold">{getProductStock(currentProduct)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => openRestockModal(currentProduct)}
                            type="button"
                            className={`px-2 py-1 rounded-lg text-white text-xs font-medium transition-all hover:shadow-md flex items-center gap-1 whitespace-nowrap ${
                              isOutOfStock(currentProduct)
                                ? 'bg-red-600 hover:bg-red-700'
                                : isLowStock(currentProduct)
                                ? 'bg-orange-600 hover:bg-orange-700'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            <Package className="w-3 h-3" />
                            Restock
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-blue-900 text-sm truncate">{currentProduct.name}</div>
                          <div className="text-xs text-blue-700">
                            Total Stock: {getProductStock(currentProduct)} | 
                            Price: KSh {currentProduct.price?.toLocaleString() || 0}
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setCurrentProduct(null);
                            setCurrentPrice("");
                            setCurrentQuantity(0);
                            setProductSearch("");
                          }}
                          type="button"
                          className="text-blue-600 hover:text-blue-800 p-1 flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="block text-xs font-semibold text-black mb-1">Quantity *</label>
                          <input
                            id="quantity-input"
                            type="number"
                            min="0"
                            max={getProductStock(currentProduct)}
                            value={currentQuantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setCurrentQuantity(isNaN(val) ? 0 : Math.max(0, Math.min(val, getProductStock(currentProduct))));
                            }}
                            className="w-full px-2 py-1.5 border-2 border-slate-200 rounded-lg focus:border-blue-500 text-black placeholder-black text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && currentQuantity > 0) {
                                addItemToSale();
                              }
                            }}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Max: {getProductStock(currentProduct)}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-black mb-1">Unit Price (KSh)</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={currentPrice}
                              onChange={(e) => setCurrentPrice(e.target.value)}
                              placeholder={currentProduct.price?.toString() || "0.00"}
                              className={`w-full px-2 py-1.5 border-2 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm ${
                                currentPrice === currentProduct.price?.toString() 
                                  ? 'text-gray-400 italic border-gray-300 bg-gray-50' 
                                  : 'text-black border-slate-200 bg-white'
                              }`}
                            />
                            {currentPrice === currentProduct.price?.toString() && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-orange-500 font-medium bg-orange-50 px-1 py-0.5 rounded">
                                Default
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {currentQuantity > 0 && currentProduct && (
                        <div className="bg-blue-100 text-blue-900 px-2 py-1.5 rounded-lg text-xs font-bold mb-2">
                          Subtotal: KSh {(currentQuantity * (currentPrice && currentPrice.trim() !== "" ? parseFloat(currentPrice) : (currentProduct.price || 0))).toLocaleString()}
                        </div>
                      )}
                      <button
                        onClick={addItemToSale}
                        type="button"
                        disabled={!currentProduct || currentQuantity <= 0}
                        className="w-full bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Add to Sale
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Sale Items - Mobile Optimized */}
              {saleItems.length > 0 && (
                <div className="border-2 border-slate-200 rounded-lg p-3 bg-slate-50">
                  <h3 className="font-semibold text-black mb-2 flex items-center gap-1.5 text-sm">
                    <Package className="w-4 h-4 text-blue-600" />
                    Sale Items ({saleItems.length})
                  </h3>
                  <div className="space-y-1.5 mb-3">
                    {saleItems.map(item => (
                      <div key={item.productId} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-black text-sm truncate">{item.productName}</div>
                          <div className="text-xs text-black">
                            {item.quantity} × KSh {item.price.toLocaleString()} = KSh {(item.quantity * item.price).toLocaleString()}
                          </div>
                        </div>
                        <button
                          onClick={() => removeItem(item.productId)}
                          type="button"
                          className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t-2 border-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-black">Total Amount</span>
                      <span className="text-lg font-bold text-blue-600">KSh {calculateTotalAmount().toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Options - Mobile Optimized */}
              {saleItems.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-black flex items-center gap-1.5 text-sm">
                    <DollarSign className="w-4 h-4 text-blue-600" />
                    Payment Options
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentOption('cash');
                        setAmountPaid(calculateTotalAmount().toFixed(2));
                        setPartialPayment({ cash: "", bank_transfer: "", till: "" });
                      }}
                      className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-all text-xs ${
                        paymentOption === 'cash'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-25'
                      }`}
                    >
                      <div className={`p-2 rounded-full ${
                        paymentOption === 'cash' ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <Coins className={`w-5 h-5 ${
                          paymentOption === 'cash' ? 'text-blue-600' : 'text-gray-400'
                        }`} />
                      </div>
                      <span className={`font-medium ${
                        paymentOption === 'cash' ? 'text-blue-700' : 'text-gray-700'
                      }`}>Cash</span>
                      <span className="text-xs text-gray-500">Full</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentOption('bank_transfer');
                        setAmountPaid(calculateTotalAmount().toFixed(2));
                        setPartialPayment({ cash: "", bank_transfer: "", till: "" });
                      }}
                      className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-all text-xs ${
                        paymentOption === 'bank_transfer'
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-green-300 hover:bg-green-25'
                      }`}
                    >
                      <div className={`p-2 rounded-full ${
                        paymentOption === 'bank_transfer' ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <CreditCard className={`w-5 h-5 ${
                          paymentOption === 'bank_transfer' ? 'text-green-600' : 'text-gray-400'
                        }`} />
                      </div>
                      <span className={`font-medium ${
                        paymentOption === 'bank_transfer' ? 'text-green-700' : 'text-gray-700'
                      }`}>Bank Transfer</span>
                      <span className="text-xs text-gray-500">Full</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentOption('till');
                        setAmountPaid(calculateTotalAmount().toFixed(2));
                        setPartialPayment({ cash: "", bank_transfer: "", till: "" });
                      }}
                      className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-all text-xs ${
                        paymentOption === 'till'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300 hover:bg-purple-25'
                      }`}
                    >
                      <div className={`p-2 rounded-full ${
                        paymentOption === 'till' ? 'bg-purple-100' : 'bg-gray-100'
                      }`}>
                        <CreditCard className={`w-5 h-5 ${
                          paymentOption === 'till' ? 'text-purple-600' : 'text-gray-400'
                        }`} />
                      </div>
                      <span className={`font-medium ${
                        paymentOption === 'till' ? 'text-purple-700' : 'text-gray-700'
                      }`}>Till</span>
                      <span className="text-xs text-gray-500">Full</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentOption('partial');
                        setAmountPaid("");
                        setPartialPayment({ cash: "", bank_transfer: "", till: "" });
                      }}
                      className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-all text-xs ${
                        paymentOption === 'partial'
                          ? 'border-yellow-500 bg-yellow-50'
                          : 'border-gray-200 hover:border-yellow-300 hover:bg-yellow-25'
                      }`}
                    >
                      <div className={`p-2 rounded-full ${
                        paymentOption === 'partial' ? 'bg-yellow-100' : 'bg-gray-100'
                      }`}>
                        <Wallet className={`w-5 h-5 ${
                          paymentOption === 'partial' ? 'text-yellow-600' : 'text-gray-400'
                        }`} />
                      </div>
                      <span className={`font-medium ${
                        paymentOption === 'partial' ? 'text-yellow-700' : 'text-gray-700'
                      }`}>Partial</span>
                      <span className="text-xs text-gray-500">Pay some</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentOption('credit');
                        setAmountPaid("0");
                        setPartialPayment({ cash: "", bank_transfer: "", till: "" });
                      }}
                      className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-all text-xs ${
                        paymentOption === 'credit'
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-red-300 hover:bg-red-25'
                      }`}
                    >
                      <div className={`p-2 rounded-full ${
                        paymentOption === 'credit' ? 'bg-red-100' : 'bg-gray-100'
                      }`}>
                        <CreditCard className={`w-5 h-5 ${
                          paymentOption === 'credit' ? 'text-red-600' : 'text-gray-400'
                        }`} />
                      </div>
                      <span className={`font-medium ${
                        paymentOption === 'credit' ? 'text-red-700' : 'text-gray-700'
                      }`}>Credit</span>
                      <span className="text-xs text-gray-500">Pay later</span>
                    </button>
                  </div>

                  {/* Enhanced Partial Payment Details */}
                  {paymentOption === 'partial' && (
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3 space-y-3">
                      <h4 className="text-sm font-semibold text-yellow-900">How was partial payment made?</h4>
                      
                      <div className="space-y-2">
                        {/* Cash Payment */}
                        <div>
                          <label className="block text-xs font-medium text-black mb-1">
                            Cash Amount (KSh)
                          </label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">KSh</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={partialPayment.cash}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                setPartialPayment({...partialPayment, cash: newValue});
                                // Auto-calculate total
                                const total = Object.values({...partialPayment, cash: newValue})
                                  .reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
                                setAmountPaid(total.toFixed(2));
                              }}
                              placeholder="0.00"
                              className="w-full pl-10 pr-3 py-2 border border-yellow-300 rounded-lg focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 text-black placeholder-gray-400 text-sm"
                            />
                          </div>
                        </div>

                        {/* Bank Transfer */}
                        <div>
                          <label className="block text-xs font-medium text-black mb-1">
                            Bank Transfer Amount (KSh)
                          </label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">KSh</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={partialPayment.bank_transfer}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                setPartialPayment({...partialPayment, bank_transfer: newValue});
                                const total = Object.values({...partialPayment, bank_transfer: newValue})
                                  .reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
                                setAmountPaid(total.toFixed(2));
                              }}
                              placeholder="0.00"
                              className="w-full pl-10 pr-3 py-2 border border-yellow-300 rounded-lg focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 text-black placeholder-gray-400 text-sm"
                            />
                          </div>
                        </div>

                        {/* Till Payment */}
                        <div>
                          <label className="block text-xs font-medium text-black mb-1">
                            Till Amount (KSh)
                          </label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">KSh</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={partialPayment.till}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                setPartialPayment({...partialPayment, till: newValue});
                                const total = Object.values({...partialPayment, till: newValue})
                                  .reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
                                setAmountPaid(total.toFixed(2));
                              }}
                              placeholder="0.00"
                              className="w-full pl-10 pr-3 py-2 border border-yellow-300 rounded-lg focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 text-black placeholder-gray-400 text-sm"
                            />
                          </div>
                        </div>

                        {/* Summary of partial payments */}
                        <div className="pt-2 border-t border-yellow-300">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="text-black">Total Partial Payment:</div>
                            <div className="font-bold text-right text-yellow-700">
                              KSh {amountPaid ? parseFloat(amountPaid).toLocaleString() : "0.00"}
                            </div>
                            
                            <div className="text-black">Remaining Balance:</div>
                            <div className="font-bold text-right text-red-600">
                              KSh {Math.max(0, calculateTotalAmount() - (parseFloat(amountPaid) || 0)).toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {/* Breakdown of payments made */}
                        {parseFloat(amountPaid) > 0 && (
                          <div className="bg-white/50 rounded-lg p-2 border border-yellow-200">
                            <p className="text-xs font-medium text-yellow-800 mb-1">Payment Breakdown:</p>
                            <div className="space-y-1">
                              {Object.entries(partialPayment).map(([method, amount]) => {
                                const numAmount = parseFloat(amount || "0");
                                if (numAmount > 0) {
                                  const methodName = method === 'bank_transfer' ? 'Bank Transfer' : 
                                                   method === 'cash' ? 'Cash' : 'Till';
                                  return (
                                    <div key={method} className="flex justify-between text-xs">
                                      <span className="text-gray-700">{methodName}:</span>
                                      <span className="font-medium text-green-600">
                                        KSh {numAmount.toLocaleString()}
                                      </span>
                                    </div>
                                  );
                                }
                                return null;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {paymentOption === 'credit' && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
                      <div className="text-center py-2">
                        <div className="flex items-center justify-center gap-2 text-red-700">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="font-semibold">Credit Sale - Customer will pay later</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Total amount: KSh {calculateTotalAmount().toLocaleString()} will be added to customer's credit
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Payment Summary */}
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-black">Total Amount:</span>
                      <span className="font-bold text-black">KSh {calculateTotalAmount().toLocaleString()}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-black">Payment Method:</span>
                      <span className={`font-bold ${
                        paymentOption === 'cash' ? 'text-blue-600' :
                        paymentOption === 'bank_transfer' ? 'text-green-600' :
                        paymentOption === 'till' ? 'text-purple-600' :
                        paymentOption === 'partial' ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {paymentOption === 'cash' ? 'Cash' :
                         paymentOption === 'bank_transfer' ? 'Bank Transfer' :
                         paymentOption === 'till' ? 'Till' :
                         paymentOption === 'partial' ? 'Partial Payment' :
                         'Credit'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-black">Amount Paid:</span>
                      <span className={`font-bold ${
                        paymentOption === 'partial' || paymentOption === 'credit' ? 'text-gray-600' : 'text-green-600'
                      }`}>
                        {paymentOption === 'cash' || paymentOption === 'bank_transfer' || paymentOption === 'till' 
                          ? `KSh ${calculateTotalAmount().toLocaleString()}`
                          : paymentOption === 'partial'
                          ? `KSh ${(parseFloat(amountPaid) || 0).toLocaleString()}`
                          : 'KSh 0'}
                      </span>
                    </div>
                    
                    {(paymentOption === 'partial' || paymentOption === 'credit') && (
                      <div className="flex justify-between items-center pt-1 border-t border-gray-300">
                        <span className="font-bold text-black">
                          {paymentOption === 'partial' ? 'Remaining:' : 'Credit Amount:'}
                        </span>
                        <span className={`font-bold ${
                          paymentOption === 'partial' ? 'text-red-600' : 'text-red-600'
                        }`}>
                          KSh {Math.max(0, calculateTotalAmount() - (parseFloat(amountPaid) || 0)).toLocaleString()}
                        </span>
                      </div>
                    )}

                    {/* Partial Payment Breakdown in Summary */}
                    {paymentOption === 'partial' && parseFloat(amountPaid) > 0 && (
                      <div className="space-y-1 pt-2 border-t border-gray-300">
                        <p className="text-xs font-medium text-yellow-700">Partial Payment Breakdown:</p>
                        {Object.entries(partialPayment).map(([method, amount]) => {
                          const numAmount = parseFloat(amount || "0");
                          if (numAmount > 0) {
                            const methodName = method === 'bank_transfer' ? 'Bank Transfer' : 
                                             method === 'cash' ? 'Cash' : 'Till';
                            return (
                              <div key={method} className="flex justify-between text-xs pl-2">
                                <span className="text-gray-600">{methodName}:</span>
                                <span className="font-medium">KSh {numAmount.toLocaleString()}</span>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons - Mobile Optimized */}
              <div className="flex gap-2 pt-3 border-t-2 border-slate-200">
                <button
                  onClick={() => {
                    setShowQuickSale(false);
                    setSaleError(null);
                    setSaleSuccess(null);
                    setStockError(null);
                    setOptimisticSale(null);
                    setOptimisticProducts([]);
                    setPartialPayment({ cash: "", bank_transfer: "", till: "" });
                  }}
                  type="button"
                  disabled={isCreating}
                  className="flex-1 px-3 py-2 border-2 border-slate-300 text-black rounded-lg hover:bg-slate-50 font-medium transition-colors disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  ref={createSaleButtonRef}
                  onClick={handleCreateSaleOptimistic}
                  type="button"
                  disabled={isCreating || !selectedCustomer || saleItems.length === 0 || 
                    (paymentOption === 'partial' && (!amountPaid || parseFloat(amountPaid) <= 0))}
                  className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow text-sm"
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Create Sale
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal - Mobile Optimized */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-md shadow-2xl mt-4 sm:mt-0">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 sm:p-6 rounded-t-xl sm:rounded-t-2xl z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Package className="w-6 h-6 sm:w-8 sm:h-8" />
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold">Add New Product</h2>
                    <p className="text-purple-100 text-xs sm:text-sm">Create a new product</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAddProduct(false);
                    setProductError(null);
                    setProductSuccess(null);
                  }}
                  type="button"
                  className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              {productError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{productError}</span>
                  </div>
                  <button onClick={() => setProductError(null)} type="button" className="text-red-700 hover:text-red-900">
                    <X size={14} />
                  </button>
                </div>
              )}

              {productSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{productSuccess}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-black mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                    placeholder="Enter product name"
                    className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all text-black placeholder-gray-400 text-sm"
                    disabled={addingProduct}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-1">
                    Category *
                  </label>
                  <div className="flex flex-col gap-2">
                    <select
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-black text-sm"
                      disabled={addingProduct}
                    >
                      <option value="">Select a category</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                      placeholder="Or type new category"
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-black placeholder-gray-400 text-sm"
                      disabled={addingProduct}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-1">
                    Production Cost (KSh) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">KSh</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProduct.productionCost}
                      onChange={(e) => setNewProduct({...newProduct, productionCost: e.target.value})}
                      placeholder="Enter production cost"
                      className="w-full pl-10 pr-3 py-2 border-2 border-slate-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-black placeholder-gray-400 text-sm"
                      disabled={addingProduct}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-1">
                    Selling Price (KSh) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">KSh</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProduct.sellingPrice}
                      onChange={(e) => setNewProduct({...newProduct, sellingPrice: e.target.value})}
                      placeholder="Enter selling price"
                      className="w-full pl-10 pr-3 py-2 border-2 border-slate-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-black placeholder-gray-400 text-sm"
                      disabled={addingProduct}
                    />
                  </div>
                  {newProduct.productionCost && newProduct.sellingPrice && (
                    (() => {
                      const productionCost = parseFloat(newProduct.productionCost);
                      const sellingPrice = parseFloat(newProduct.sellingPrice);
                      if (!isNaN(productionCost) && !isNaN(sellingPrice) && productionCost > 0) {
                        const profit = sellingPrice - productionCost;
                        const profitMargin = (profit / productionCost) * 100;
                        return (
                          <div className={`mt-1 text-xs ${profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            Profit: KSh {profit.toLocaleString()} ({profitMargin.toFixed(1)}%)
                          </div>
                        );
                      }
                      return null;
                    })()
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-1">
                    Initial Stock *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.initialStock}
                    onChange={(e) => setNewProduct({...newProduct, initialStock: e.target.value})}
                    placeholder="Enter initial stock"
                    className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-black placeholder-gray-400 text-sm"
                    disabled={addingProduct}
                  />
                </div>

                {newProduct.name && newProduct.category && newProduct.productionCost && newProduct.sellingPrice && newProduct.initialStock && (
                  <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-3 text-sm">
                    <h4 className="font-semibold text-purple-900 mb-1">Product Summary</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-black">Product:</span>
                        <span className="font-medium truncate ml-2">{newProduct.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-black">Category:</span>
                        <span className="font-medium text-purple-700 truncate ml-2">{newProduct.category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-black">Cost:</span>
                        <span className="font-medium">KSh {parseFloat(newProduct.productionCost).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-black">Price:</span>
                        <span className="font-medium text-green-600">KSh {parseFloat(newProduct.sellingPrice).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-black">Stock:</span>
                        <span className="font-medium">{newProduct.initialStock} units</span>
                      </div>
                      {(() => {
                        const productionCost = parseFloat(newProduct.productionCost);
                        const sellingPrice = parseFloat(newProduct.sellingPrice);
                        const initialStock = parseInt(newProduct.initialStock || "0");
                        
                        if (!isNaN(productionCost) && !isNaN(sellingPrice) && !isNaN(initialStock)) {
                          const profit = sellingPrice - productionCost;
                          const totalProfit = profit * initialStock;
                          return (
                            <div className="flex justify-between pt-1 border-t border-purple-300">
                              <span className="font-bold text-black">Total Profit:</span>
                              <span className="font-bold text-green-700">KSh {totalProfit.toLocaleString()}</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  onClick={() => {
                    setShowAddProduct(false);
                    setProductError(null);
                    setProductSuccess(null);
                  }}
                  type="button"
                  disabled={addingProduct}
                  className="flex-1 px-3 py-2 border-2 border-slate-300 text-black rounded-lg hover:bg-slate-50 font-medium transition-colors disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProduct}
                  type="button"
                  disabled={addingProduct || !newProduct.name.trim() || !newProduct.category.trim() || !newProduct.productionCost || !newProduct.sellingPrice}
                  className="flex-1 px-3 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow text-sm"
                >
                  {addingProduct ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Add Product
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restock Modal - Mobile Optimized */}
      {showRestockModal && restockingProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center p-2 sm:p-4 z-[60]">
          <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-md shadow-2xl mt-4 sm:mt-0">
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-4 sm:p-6 rounded-t-xl sm:rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Package className="w-6 h-6 sm:w-8 sm:h-8" />
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold">Restock Product</h2>
                    <p className="text-orange-100 text-xs sm:text-sm truncate">{restockingProduct.name}</p>
                  </div>
                </div>
                <button
                  onClick={closeRestockModal}
                  disabled={restocking}
                  type="button"
                  className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              {restockError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{restockError}</span>
                  </div>
                  <button onClick={() => setRestockError(null)} type="button" className="text-red-700 hover:text-red-900">
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-orange-700 font-medium">Current Stock Breakdown</p>
                    <div className="mt-1 space-y-1">
                      <p className="text-sm font-bold text-orange-900">Total: {getProductStock(restockingProduct)} units</p>
                      <p className="text-xs text-green-700">Unassigned: {getAvailableInventory(restockingProduct)} units</p>
                      <p className="text-xs text-orange-700">Assigned: {getAssignedInventory(restockingProduct.id)} units</p>
                    </div>
                  </div>
                  <Package className="w-8 h-8 sm:w-12 sm:h-12 text-orange-300" />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-black mb-1">
                    Quantity to Add *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={restockForm.quantity}
                    onChange={(e) => setRestockForm({
                      ...restockForm,
                      quantity: Math.max(1, parseInt(e.target.value) || 1)
                    })}
                    className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all text-black text-sm"
                    disabled={restocking}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-1">
                    Cost Price (KSh) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={restockForm.costPrice}
                    onChange={(e) => setRestockForm({...restockForm, costPrice: e.target.value})}
                    placeholder="Enter cost price"
                    className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all text-black placeholder-gray-400 text-sm"
                    disabled={restocking}
                  />
                  {restockForm.costPrice && restockForm.quantity > 0 && (
                    <p className="text-xs text-gray-600 mt-1">
                      Total Cost: KSh {(parseFloat(restockForm.costPrice || "0") * restockForm.quantity).toLocaleString()}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black mb-1">
                    Payment Source *
                  </label>
                  <select
                    value={restockForm.paymentSource}
                    onChange={(e) => setRestockForm({
                      ...restockForm,
                      paymentSource: e.target.value as "cash" | "credit",
                      creditorName: e.target.value === "cash" ? "" : restockForm.creditorName
                    })}
                    className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all text-black text-sm"
                    disabled={restocking}
                  >
                    <option value="cash">Cash Payment</option>
                    <option value="credit">Credit/Pay Later</option>
                  </select>
                </div>

                {restockForm.paymentSource === "credit" && (
                  <div>
                    <label className="block text-sm font-semibold text-black mb-1">
                      Creditor Name *
                    </label>
                    <input
                      type="text"
                      value={restockForm.creditorName}
                      onChange={(e) => setRestockForm({...restockForm, creditorName: e.target.value})}
                      placeholder="Enter creditor name"
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all text-black placeholder-gray-400 text-sm"
                      disabled={restocking}
                    />
                  </div>
                )}

                {restockForm.quantity > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs text-green-700 font-medium mb-1">After Restock:</p>
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-green-900">
                        Total: {getProductStock(restockingProduct) + restockForm.quantity} units
                      </p>
                      <p className="text-xs text-green-700">
                        Unassigned will increase by {restockForm.quantity} units
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  onClick={closeRestockModal}
                  disabled={restocking}
                  type="button"
                  className="flex-1 px-3 py-2 border-2 border-slate-300 text-black rounded-lg hover:bg-slate-50 font-medium transition-colors disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestockSubmit}
                  disabled={restocking}
                  type="button"
                  className="flex-1 px-3 py-2 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg hover:from-orange-700 hover:to-orange-800 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow text-sm"
                >
                  {restocking ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Restocking...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Restock
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats - Mobile Optimized */}
      <div className="px-3 sm:px-4 py-4 sm:py-6">
        <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mb-3 sm:mb-4">
          Quick Overview
        </h2>
        
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 animate-pulse">
                <div className="h-8 sm:h-10 bg-slate-200 rounded mb-2"></div>
                <div className="h-5 sm:h-6 bg-slate-200 rounded mb-1.5"></div>
                <div className="h-3 sm:h-4 bg-slate-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            {quickStats.map((stat) => (
              <div
                key={stat.title}
                className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div
                    className={`p-1.5 sm:p-2 rounded-lg ${
                      stat.positive ? "bg-emerald-100" : "bg-orange-100"
                    }`}
                  >
                    <stat.icon
                      className={`w-4 h-4 sm:w-5 sm:h-5 ${
                        stat.positive ? "text-emerald-600" : "text-orange-600"
                      }`}
                    />
                  </div>
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                      stat.positive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {stat.change}
                  </span>
                </div>
                <div className="text-base sm:text-lg font-bold text-slate-900 mb-0.5 truncate">
                  {stat.value}
                </div>
                <div className="text-black text-xs">{stat.title}</div>
              </div>
            ))}
          </div>
        )}

        {/* Admin Sections - Mobile Optimized */}
        <div className="mt-6 sm:mt-8">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mb-3 sm:mb-4">
            Management Sections
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
            {adminSections.map((section) => (
              <Link
                key={section.title}
                href={section.href}
                className="group bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 hover:shadow-md hover:scale-[1.02] transition-all"
              >
                <div className="flex items-start justify-between mb-2 sm:mb-3">
                  <div className={`p-1.5 sm:p-2 rounded-lg ${section.color}`}>
                    <section.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 group-hover:text-slate-600 transition" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-1 group-hover:text-blue-600 truncate">
                  {section.title}
                </h3>
                <p className="text-xs text-black mb-2 sm:mb-3 line-clamp-2">
                  {section.description}
                </p>
                <div className="text-xs font-medium text-black bg-slate-50 rounded-full px-2 py-0.5 inline-block truncate max-w-full">
                  {section.stats}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}