export interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  address?: string
  createdAt: string
  updatedAt: string
}

export interface Product {
  id: string
  name: string
  description?: string
  price: number
  stock: number
  lowStockThreshold: number
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  customerId: string
  customer: Customer
  items: OrderItem[]
  total: number
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED'
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  id: string
  orderId: string
  productId: string
  product: Product
  quantity: number
  price: number
}

export interface Invoice {
  id: string
  orderId: string
  order: Order
  total: number
  status: 'PAID' | 'PARTIAL' | 'UNPAID'
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  invoiceId: string
  invoice: Invoice
  amount: number
  method: 'CASH' | 'CARD' | 'MOBILE' | 'BANK_TRANSFER'
  createdAt: string
}

export interface Expense {
  id: string
  description: string
  amount: number
  type: string
  date: string
  createdAt: string
  updatedAt: string
}
