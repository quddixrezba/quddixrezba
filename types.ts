
export enum Section {
  HERO = 'hero',
  CATALOG = 'catalog',
  PHILOSOPHY = 'philosophy',
}

export interface Product {
  id: string;
  name: string;
  price: number; // Changed to number for calculations
  displayPrice: string; // Formatted string for display
  category: string;
  description?: string;
  image?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface CartItem extends Product {
  // Extended in case we need quantity later
}

export interface DeliveryDetails {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  zip: string;
}

export interface Order {
  id: string;
  date: string;
  items: Product[];
  total: number;
  status: 'processing' | 'shipped' | 'delivered';
  delivery?: DeliveryDetails;
}

export interface User {
  name: string;
  email: string;
  password?: string; // Only used internally for the mock DB check
  cart: Product[];
  orders: Order[];
}
