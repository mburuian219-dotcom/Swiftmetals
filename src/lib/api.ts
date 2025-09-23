import axios from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

// ================== TYPES ==================
export interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
}

export interface OrderItem {
  productId: number;
  qty: number;
  price: number;
}

export interface Sale {
  id: number;
  customerId: number;
  customer?: Customer;
  total: number;
  paymentType: "cash" | "credit";
  items: OrderItem[];
}

export interface LoginResponse {
  access_token: string;
  user?: {
    id: number;
    email: string;
    username?: string;
    role?: string;
  };
}

// ================== API CLASS ==================
export class Api {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...options?.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (_) {}
      throw new Error(errorMessage);
    }

    return response.json() as Promise<T>;
  }

  // ----------------- AUTH -----------------
  async login(data: { email: string; password: string }): Promise<LoginResponse> {
    const res = await this.request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (res.access_token) {
      this.setToken(res.access_token);
    }
    return res;
  }

  async register(data: any) {
    return this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ----------------- CUSTOMERS -----------------
  async getCustomers() {
    return this.request<Customer[]>("/customers");
  }

  async getCustomer(id: string) {
    return this.request<Customer>(`/customers/${id}`);
  }

  async createCustomer(data: any) {
    return this.request<Customer>("/customers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCustomer(id: string, data: any) {
    return this.request<Customer>(`/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteCustomer(id: string) {
    return this.request(`/customers/${id}`, { method: "DELETE" });
  }

  // ----------------- PRODUCTS -----------------
  async getProducts() {
    return this.request("/products");
  }

  async getProduct(id: string) {
    return this.request(`/products/${id}`);
  }

  async createProduct(data: any) {
    return this.request("/products", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: any) {
    return this.request(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: string) {
    return this.request(`/products/${id}`, { method: "DELETE" });
  }

  // ----------------- ORDERS -----------------
  async getOrders() {
    return this.request<Sale[]>("/orders");
  }

  async getOrder(id: string) {
    return this.request<Sale>(`/orders/${id}`);
  }

  async createOrder(data: {
    customerId: number | null;
    items: OrderItem[];
    paymentType: "cash" | "credit";
  }): Promise<Sale> {
    return this.request<Sale>("/orders", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateOrder(id: string, data: any) {
    return this.request(`/orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteOrder(id: string) {
    return this.request(`/orders/${id}`, { method: "DELETE" });
  }

  // ----------------- INVOICES -----------------
  async getInvoices() {
    return this.request("/invoices");
  }

  async getInvoice(id: string) {
    return this.request(`/invoices/${id}`);
  }

  async createInvoice(data: any) {
    return this.request("/invoices", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ----------------- PAYMENTS -----------------
  async getPayments() {
    return this.request("/payments");
  }

  async createPayment(data: any) {
    return this.request("/payments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deletePayment(payment_uuid: string) {
    const res = await axios.delete(`/api/payments/${payment_uuid}`);
    return res.data;
  }

  // ----------------- EXPENSES -----------------
  async getExpenses() {
    return this.request("/expenses");
  }

  async createExpense(data: any) {
    return this.request("/expenses", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateExpense(id: string, data: any) {
    return this.request(`/expenses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteExpense(id: string) {
    return this.request(`/expenses/${id}`, { method: "DELETE" });
  }

  // ----------------- REPORTS -----------------
  async getSalesReport(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : "";
    return this.request(`/reports/sales${query}`);
  }

  async getExpensesReport(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : "";
    return this.request(`/reports/expenses${query}`);
  }

  async getProfitLossReport(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : "";
    return this.request(`/reports/profit-loss${query}`);
  }

  // ----------------- SMS -----------------
  async sendSMS(data: { phone: string; message: string }) {
    return this.request("/sms/send", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getSMSLogs() {
    return this.request("/sms/logs");
  }
}

// ✅ Export single consistent instance
export const apiClient = new Api();
