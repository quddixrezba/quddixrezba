import React, { useState, useEffect } from 'react';
import Hero from './components/Hero';
import IdeaGenerator from './components/IdeaGenerator';
import Footer from './components/Footer';
import Cart from './components/Cart';
import Auth from './components/Auth';
import Profile from './components/Profile';
import Techniques from './components/Techniques';
import Checkout from './components/Checkout';
import { X, ShoppingBag, LayoutGrid, User as UserIcon } from 'lucide-react';
import { Product, User, Order, DeliveryDetails } from './types';

// STORAGE KEYS - STABLE VERSION
const STORAGE_KEYS = {
  USERS_DB: 'quddix_live_store_users',
  SESSION: 'quddix_live_store_session',
  GUEST_CART: 'quddix_live_store_guest_cart',
};

const App: React.FC = () => {
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
  const [cartItems, setCartItems] = useState<Product[]>([]);
  const [user, setUser] = useState<User | null>(null);

  // Helper: Persist User changes to all storage layers
  const persistUser = (updatedUser: User) => {
    // 1. Update State
    setUser(updatedUser);

    // 2. Update Session (for auto-login on refresh)
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(updatedUser));

    // 3. Update Database (Source of Truth)
    const dbStr = localStorage.getItem(STORAGE_KEYS.USERS_DB);
    const db = dbStr ? JSON.parse(dbStr) : {};
    db[updatedUser.email] = updatedUser;
    localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(db));
  };

  // Helper: Save Guest Cart
  const persistGuestCart = (items: Product[]) => {
    localStorage.setItem(STORAGE_KEYS.GUEST_CART, JSON.stringify(items));
  };

  // INITIALIZATION
  useEffect(() => {
    // 1. Check for Active Session
    const sessionStr = localStorage.getItem(STORAGE_KEYS.SESSION);
    
    if (sessionStr) {
      try {
        const sessionUser = JSON.parse(sessionStr);
        
        // 2. Re-validate against Database
        const dbStr = localStorage.getItem(STORAGE_KEYS.USERS_DB);
        const db = dbStr ? JSON.parse(dbStr) : {};
        
        // Try strict match OR case-insensitive match
        let freshUser = db[sessionUser.email] || db[sessionUser.email.toLowerCase()];
        
        // SELF-HEALING: If session exists but DB user is missing (e.g. storage cleared partially),
        // trust the session and repair the DB.
        if (!freshUser) {
           console.warn("Quddix: DB missing user, healing from session.");
           freshUser = sessionUser;
           // Repair DB
           db[freshUser.email] = freshUser;
           localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(db));
        }

        console.log("Quddix: Session Restored for", freshUser.email);
        setUser(freshUser);
        setCartItems(freshUser.cart || []);

      } catch (e) {
        console.error("Quddix: Session Corrupted", e);
        // Only clear if JSON is truly broken
        localStorage.removeItem(STORAGE_KEYS.SESSION);
      }
    } else {
      // 3. If No Session, Load Guest Cart
      const guestCartStr = localStorage.getItem(STORAGE_KEYS.GUEST_CART);
      if (guestCartStr) {
        try {
           setCartItems(JSON.parse(guestCartStr));
        } catch (e) {
           console.error("Guest cart corrupted", e);
        }
      }
    }
  }, []);

  const openCatalog = () => setIsCatalogOpen(true);
  const closeCatalog = () => setIsCatalogOpen(false);
  
  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  // ADD TO CART
  const addToCart = (product: Product) => {
    const newCart = [...cartItems, product];
    setCartItems(newCart);

    if (user) {
        persistUser({ ...user, cart: newCart });
    } else {
        persistGuestCart(newCart);
    }
    
    // Automatically open cart when item is added
    if (isCatalogOpen) {
       // Optional: close catalog if you want to focus on cart
       // setIsCatalogOpen(false); 
    }
    setIsCartOpen(true);
  };

  // REMOVE FROM CART
  const removeFromCart = (id: string) => {
    const newCart = cartItems.filter(item => item.id !== id);
    setCartItems(newCart);

    if (user) {
        persistUser({ ...user, cart: newCart });
    } else {
        persistGuestCart(newCart);
    }
  };

  // OPEN CHECKOUT MODAL
  const initCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  // PROCESS ORDER
  const processOrder = (deliveryDetails: DeliveryDetails) => {
    if (cartItems.length === 0) return;

    const newOrder: Order = {
        id: Math.random().toString(36).substr(2, 9).toUpperCase(),
        date: new Date().toISOString(),
        items: [...cartItems],
        total: cartItems.reduce((acc, item) => acc + item.price, 0),
        status: 'processing',
        delivery: deliveryDetails
    };

    if (user) {
        // Logged in user: Save to history
        const updatedUser: User = {
            ...user,
            orders: [...(user.orders || []), newOrder],
            cart: [] // Clear cart after purchase
        };
        persistUser(updatedUser);
        setIsProfileOpen(true);
    } else {
        // Guest: Just clear guest cart
        setCartItems([]);
        localStorage.removeItem(STORAGE_KEYS.GUEST_CART);
        alert('Спасибо за заказ! Детали отправлены на вашу почту.');
    }

    setIsCheckoutOpen(false);
    setCartItems([]); // Clear local state
  };

  // LOGIN
  const handleLogin = (userFromAuth: User) => {
    // 1. Fetch absolutely latest data from DB
    const dbStr = localStorage.getItem(STORAGE_KEYS.USERS_DB);
    const db = dbStr ? JSON.parse(dbStr) : {};
    
    // Robust lookup
    const freshUser = db[userFromAuth.email] || db[userFromAuth.email.toLowerCase()] || userFromAuth;

    // 2. Merge Guest Cart items INTO User Cart
    const guestCart = cartItems; 
    const userCart = freshUser.cart || [];
    
    // Combine arrays
    const mergedCart = [...userCart, ...guestCart];
    
    // 3. Create updated user object
    const updatedUser = { ...freshUser, cart: mergedCart };
    
    // 4. Persist everywhere
    persistUser(updatedUser);
    setCartItems(mergedCart);
    
    // 5. Clean up guest state
    localStorage.removeItem(STORAGE_KEYS.GUEST_CART);
    
    setIsAuthOpen(false);
  };

  // LOGOUT
  const handleLogout = () => {
    if (window.confirm('Вы действительно хотите выйти из аккаунта?')) {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
      setUser(null);
      setCartItems([]);
      setIsProfileOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-pattern text-quddix-text overflow-x-hidden flex flex-col relative">
      
      {/* Decorative Red Glow */}
      <div className="fixed top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-quddix-red/5 blur-[150px] rounded-full pointer-events-none z-0"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-quddix-red/5 blur-[120px] rounded-full pointer-events-none z-0"></div>

      {/* Auth Modal */}
      <Auth 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        onLogin={handleLogin} 
      />

      {/* Profile Modal */}
      {user && (
        <Profile 
          isOpen={isProfileOpen} 
          onClose={() => setIsProfileOpen(false)} 
          user={user} 
          onLogout={handleLogout} 
        />
      )}

      {/* Checkout Modal */}
      <Checkout 
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cartItems}
        total={cartItems.reduce((acc, item) => acc + item.price, 0)}
        currentUser={user}
        onSubmit={processOrder}
      />

      {/* Full Screen Catalog Modal */}
      {isCatalogOpen && (
        <div className="fixed inset-0 z-[60] bg-quddix-black/98 backdrop-blur-xl flex flex-col animate-fade-in overflow-hidden">
          {/* Catalog Close Button */}
          <button 
            onClick={closeCatalog}
            className="absolute top-6 right-6 z-50 text-quddix-muted hover:text-white transition-colors hover:rotate-90 duration-300 bg-quddix-black/50 p-2 rounded-full border border-quddix-gray/30"
          >
            <X size={24} />
          </button>
          
          {/* Render Styled Techniques Component */}
          <Techniques onAddToCart={addToCart} />
        </div>
      )}

      {/* Cart Component */}
      <Cart 
        isOpen={isCartOpen} 
        onClose={closeCart} 
        items={cartItems} 
        onRemove={removeFromCart} 
        onCheckout={initCheckout}
      />

      {/* Header */}
      <header className="fixed w-full top-0 z-40 bg-quddix-black/80 backdrop-blur-md border-b border-quddix-red/10">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <div 
            className="flex items-center gap-4 select-none cursor-pointer group"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            {/* Logo Mark */}
            <div className="w-8 h-8 border border-quddix-red/60 flex items-center justify-center rotate-45 group-hover:bg-quddix-red group-hover:border-quddix-red transition-all duration-500">
                <div className="w-1.5 h-1.5 bg-white -rotate-45"></div>
            </div>

            <div className="flex flex-col">
                <span className="tracking-[0.25em] font-bold text-xl text-white uppercase leading-none mb-1 group-hover:text-quddix-red transition-colors duration-300">QUDDIX</span>
                <span className="tracking-[0.2em] font-light text-[10px] text-quddix-red uppercase leading-none opacity-80">Резьба по дереву</span>
            </div>
          </div>
          
          <nav className="flex items-center gap-6 md:gap-8">
            <button 
              onClick={openCatalog}
              className="flex items-center gap-2 text-xs md:text-sm font-bold uppercase tracking-[0.15em] text-white hover:text-quddix-red transition-colors border-b border-transparent hover:border-quddix-red py-1 hidden md:flex group"
            >
              <LayoutGrid size={16} className="group-hover:text-quddix-red transition-colors" />
              <span>Каталог</span>
            </button>

            <div className="h-6 w-[1px] bg-quddix-gray/30 mx-2 hidden md:block"></div>

            <button 
              onClick={() => user ? setIsProfileOpen(true) : setIsAuthOpen(true)}
              className="relative text-white hover:text-quddix-red transition-colors p-2 flex items-center gap-2 group"
              title={user ? user.name : "Войти"}
            >
              <UserIcon size={20} />
              {user && <span className="text-[10px] uppercase font-bold tracking-wider hidden lg:block text-quddix-muted group-hover:text-quddix-red">{user.name}</span>}
            </button>

            <button 
              onClick={openCart}
              className="relative text-white hover:text-quddix-red transition-colors p-2"
              aria-label="Корзина"
            >
              <ShoppingBag size={20} />
              {cartItems.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-quddix-red text-[10px] flex items-center justify-center text-white rounded-full font-bold shadow-md">
                    {cartItems.length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-grow pt-20 relative z-10">
        <Hero onCatalogClick={openCatalog} />
      </main>

      {/* Floating AI Widget */}
      <IdeaGenerator />

      <Footer />
    </div>
  );
};

export default App;
