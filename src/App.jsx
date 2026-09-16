import { useEffect, useMemo, useState } from "react";
import { restaurantDefaults, supabase } from "./config";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  MapPin,
  Minus,
  Package,
  Phone,
  Plus,
  Settings,
  ShoppingBag,
  Trash2,
  Utensils,
  X
} from "lucide-react";
import { initialMenu } from "./data";

import {
  createUpiPayment,
  isValidTransactionId,
  readQrFile
} from "./upi";

const money = (value) =>
  `₹${Number(value || 0).toFixed(0)}`;
  function calculateDeliveryCharge(distanceKm) {
    const distance = Number(distanceKm || 0);
  
    if (distance <= 3) {
      return 0;
    }
  
    const extraKm = Math.ceil(distance - 3);
  
    return 40 + (extraKm - 1) * 10;
  }

function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}
async function loadMenuFromSupabase() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("menu_items")
    .select("id, item")
    .order("id");

  if (error) {
    console.error("Could not load menu from Supabase:", error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data.map((row) => row.item);
}
async function loadSettingsFromSupabase() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("restaurant_settings")
    .select("settings")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error(
      "Could not load restaurant settings from Supabase:",
      error
    );
    return null;
  }

  if (!data || !data.settings) {
    return null;
  }

  return {
    ...restaurantDefaults,
    ...data.settings
  };
}

async function saveSettingsToSupabase(nextSettings) {
  if (!supabase) {
    return false;
  }

  const { error } = await supabase
    .from("restaurant_settings")
    .update({
      settings: nextSettings,
      updated_at: new Date().toISOString()
    })
    .eq("id", 1);

  if (error) {
    console.error(
      "Could not save restaurant settings to Supabase:",
      error
    );
    return false;
  }

  return true;
}

async function loadCustomerProfile(userId) {
  if (!supabase || !userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error(
      "Could not load customer profile:",
      error
    );
    return null;
  }

  return data || null;
}

async function saveCustomerProfile(profile) {
  if (!supabase || !profile?.id) {
    return false;
  }

  const { error } = await supabase
    .from("customers")
    .upsert(
      {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        address: profile.address,
        latitude: profile.latitude,
        longitude: profile.longitude,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "id"
      }
    );

  if (error) {
    console.error(
      "Could not save customer profile:",
      error
    );
    return false;
  }

  return true;
}
async function loadCustomerOrders(userId) {
  if (!supabase || !userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_data, created_at, updated_at"
    )
    .eq(
      "order_data->>user_id",
      userId
    )
    .order("created_at", {
      ascending: false
    });

  if (error) {
    console.error(
      "Could not load customer orders:",
      error
    );
    return [];
  }

  return (data || []).map((row) => ({
    ...(row.order_data || {}),
    id: row.id,
    createdAt:
      row.order_data?.createdAt ||
      row.created_at
  }));
}

async function saveMenuToSupabase(menuItems) {
  if (!supabase) {
    return;
  }

  const rows = menuItems.map((item) => ({
    id: String(item.id),
    item
  }));

  const { error: deleteError } = await supabase
    .from("menu_items")
    .delete()
    .neq("id", "");

  if (deleteError) {
    console.error("Could not clear menu in Supabase:", deleteError);
    return;
  }

  const { error: insertError } = await supabase
    .from("menu_items")
    .insert(rows);

  if (insertError) {
    console.error("Could not save menu to Supabase:", insertError);
    return;
  }

  console.log("Menu saved to Supabase.");
}

function App() {
  const isAdminPath =
    window.location.pathname === "/admin";

  const [menu, setMenu] = useStoredState("kk-menu", initialMenu);
  const [settings, setSettings] = useStoredState(
    "kk-settings",
    restaurantDefaults
  );
  const [cart, setCart] = useStoredState("kk-cart", []);
  const [orders, setOrders] = useStoredState("kk-orders", []);
  const [page, setPage] = useState(() => {
    const path = window.location.pathname;
  
    if (path === "/menu") {
      return "menu";
    }
  
    if (path === "/account") {
      return "account";
    }
  
    return "home";
  });
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [deliveryDistance, setDeliveryDistance] = useState(0);
  const [customerUser, setCustomerUser] = useState(null);
const [customerProfile, setCustomerProfile] = useState(null);
const [showLoginPopup, setShowLoginPopup] = useState(false);
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
const [customerOrders, setCustomerOrders] = useState([]);
const [showProfileSetup, setShowProfileSetup] = useState(false);
  useEffect(() => {
    let cancelled = false;
  
    async function loadMenu() {
      const remoteMenu = await loadMenuFromSupabase();
  
      if (!cancelled && remoteMenu) {
        setMenu(remoteMenu);
      }
    }
  
    loadMenu();
  
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }
  
    let mounted = true;
  
    async function handleSession(session) {
      const user = session?.user || null;
    
      if (!mounted) {
        return;
      }
    
      setCustomerUser(user);
    
      if (!user) {
        setCustomerProfile(null);
        setCustomerOrders([]);
        setShowProfileSetup(false);
        return;
      }
    
      const profile = await loadCustomerProfile(user.id);
    
      if (!mounted) {
        return;
      }
    
      setCustomerProfile(profile);
    
      // Do NOT automatically open profile setup
      // when the website loads or restores a session.
      // Profile setup is triggered after OTP login.
    }
  
    supabase.auth.getSession().then(({ data }) => {
      handleSession(data.session);
    });
  
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        handleSession(session);
      }
    );
  
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
  
    async function loadOrders() {
      if (!customerUser?.id) {
        setCustomerOrders([]);
        return;
      }
  
      const remoteOrders =
        await loadCustomerOrders(
          customerUser.id
        );
  
      if (!cancelled) {
        setCustomerOrders(remoteOrders);
      }
    }
  
    loadOrders();
  
    return () => {
      cancelled = true;
    };
  }, [customerUser]);
  useEffect(() => {
    let cancelled = false;
  
    async function loadSettings() {
      const remoteSettings = await loadSettingsFromSupabase();
  
      if (!cancelled && remoteSettings) {
        setSettings(remoteSettings);
      }
    }
  
    loadSettings();
  
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredMenu = useMemo(
    () =>
      menu.filter(
        (item) =>
          item.available &&
          (category === "All" || item.category === category)
      ),
    [menu, category]
  );

  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const subtotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const delivery =
  subtotal > 0
    ? calculateDeliveryCharge(deliveryDistance)
    : 0;

  const service =
    subtotal > 0 ? Number(settings.serviceCharge || 0) : 0;

  const tax =
    subtotal * (Number(settings.tax || 0) / 100);

  const total = subtotal + delivery + service + tax;

  function addToCart(item) {
    setCart((current) => {
      const found = current.find(
        (cartItem) => cartItem.id === item.id
      );

      if (found) {
        return current.map((cartItem) =>
          cartItem.id === item.id
            ? {
                ...cartItem,
                quantity: cartItem.quantity + 1
              }
            : cartItem
        );
      }

      return [
        ...current,
        {
          ...item,
          quantity: 1
        }
      ];
    });

    setCartOpen(true);
  }

  function changeQuantity(id, amount) {
    setCart((current) =>
      current
        .map((item) =>
          item.id === id
            ? {
                ...item,
                quantity: item.quantity + amount
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

 function startCheckout() {
  if (!cart.length) {
    alert("Your cart is empty.");
    return;
  }

  if (!customerUser) {
    setShowLoginPopup(true);
    return;
  }

  setPage("checkout");
  setCartOpen(false);
}

async function placeOrder(
  customer,
  payment = null
) {
  const order = {
    id: `KK-${Date.now().toString().slice(-6)}`,
    user_id: customerUser?.id || null,
    customer,
    items: cart,
    total,
    payment,
    status: "Received",
    createdAt: new Date().toISOString()
  };

  setOrders((current) => [
    order,
    ...current
  ]);

  if (supabase && customerUser?.id) {
    const { error } = await supabase
      .from("orders")
      .insert({
        id: order.id,
        order_data: order,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error(
        "Could not save order to Supabase:",
        error
      );
    }
  }

  setCart([]);
  setPage("confirmation");
  sendWhatsApp(order);
}

function sendWhatsApp(order) {
  const configured = String(
    settings.whatsapp || ""
  ).replace(/\D/g, "");

  const phone = configured || "";

  const lines = [
    `*${settings.name} Order*`,
    `Order ID: ${order.id}`,
    ""
  ];

  order.items.forEach((item) => {
    lines.push(
      `${item.name} × ${item.quantity} - ${money(
        item.price * item.quantity
      )}`
    );
  });

  lines.push("");
  lines.push(`*Total: ${money(order.total)}*`);
  lines.push("");

  if (order.payment?.method === "UPI") {
    lines.push("*Payment Details*");
    lines.push(`Payment Method: UPI`);
    lines.push(
      `UPI ID: ${order.payment.upiId || "-"}`
    );
    lines.push(
      `Transaction ID: ${
        order.payment.transactionId || "-"
      }`
    );
    lines.push(
      `Payment Status: ${
        order.payment.status || "Submitted"
      }`
    );
  }

  if (
    order.payment?.method ===
    "Cash on Delivery"
  ) {
    lines.push("*Payment Details*");
    lines.push(
      "Payment Method: Cash on Delivery"
    );
    lines.push(
      `Payment Status: ${
        order.payment.status ||
        "Pay on Delivery"
      }`
    );
  }

  lines.push("");
  lines.push(
    `Customer: ${order.customer.name}`
  );
  lines.push(
    `Phone: ${order.customer.phone}`
  );
  lines.push(
    `Address: ${order.customer.address}`
  );

  if (order.customer.notes) {
    lines.push(
      `Notes: ${order.customer.notes}`
    );
  }

  const message = lines.join("\n");

  if (!phone) {
    alert(
      "WhatsApp number is not configured."
    );
    return;
  }

  const url =
    `https://wa.me/${phone}?text=` +
    encodeURIComponent(message);

  window.open(url, "_blank");
}

  if (admin) {
    return (
      <Admin
        menu={menu}
        setMenu={setMenu}
        settings={settings}
        setSettings={setSettings}
        orders={orders}
        setOrders={setOrders}
        exit={() => setAdmin(false)}
      />
    );
  }

  if (isAdminPath) {
    return (
      <Admin
        menu={menu}
        setMenu={setMenu}
        settings={settings}
        setSettings={setSettings}
        orders={orders}
        setOrders={setOrders}
        exit={() => {
          window.location.href = "/";
        }}
      />
    );
  }
  if (showProfileSetup) {
    return (
      <CustomerProfileSetup
        user={customerUser}
        existingProfile={customerProfile}
        onSaved={(profile) => {
          setCustomerProfile(profile);
          setShowProfileSetup(false);

          if (cart.length > 0) {
            setPage("checkout");
          } else {
            setPage("account");
          }
        }}
      />
    );
  }

  return (
    <div className="app">
       {showLoginPopup ? (
    <CustomerLogin
      onClose={() => setShowLoginPopup(false)}
      onSuccess={async (user) => {
        setShowLoginPopup(false);
        setCartOpen(false);

        const profile = await loadCustomerProfile(user.id);

        setCustomerUser(user);
        setCustomerProfile(profile);

        if (
          !profile ||
          !profile.name ||
          !profile.phone ||
          !profile.address
        ) {
          setShowProfileSetup(true);
        } else {
          setPage("account");
        }
      }}
    />
  ) : null}

<header className="topbar">
  <button
    className="brand"
    onClick={() => {
      setPage("home");
      setMobileMenuOpen(false);
    }}
  >
    <span className="brand-mark">KK</span>
    <span>
      <strong>{settings.name}</strong>
      <small>{settings.tagline}</small>
    </span>
  </button>

  {/* Desktop Navigation */}
  <nav className="desktop-nav">
    <button onClick={() => (window.location.href = "/")}>
      Home
    </button>
    <button onClick={() => (window.location.href = "/menu")}>
      Menu
    </button>
    <button onClick={() => (window.location.href = "/admin")}>
      Admin
    </button>
  </nav>

  {/* Mobile Menu Button */}
  <button
    className="mobile-menu-button"
    onClick={() => setMobileMenuOpen((prev) => !prev)}
    aria-label="Open menu"
  >
    ☰
  </button>

  <div className="topbar-actions">
    {customerUser ? (
      <button
        className="account-button"
        onClick={() => (window.location.href = "/account")}
      >
        <span className="account-icon">👤</span>
        <span>Account</span>
      </button>
    ) : (
      <button
        className="login-button"
        onClick={() => setShowLoginPopup(true)}
      >
        <span>Login / Register</span>
      </button>
    )}

    <button
      className="cart-button"
      onClick={() => setCartOpen(true)}
    >
      <ShoppingBag size={20} />
      <span>{cartCount}</span>
    </button>
  </div>

  {/* Mobile Navigation */}
  {mobileMenuOpen && (
    <div className="mobile-nav">
      <button
        onClick={() => {
          setMobileMenuOpen(false);
          window.location.href = "/";
        }}
      >
        Home
      </button>

      <button
        onClick={() => {
          setMobileMenuOpen(false);
          window.location.href = "/menu";
        }}
      >
        Menu
      </button>

      <button
        onClick={() => {
          setMobileMenuOpen(false);
          window.location.href = "/admin";
        }}
      >
        Admin
      </button>

      {customerUser ? (
        <button
          onClick={() => {
            setMobileMenuOpen(false);
            window.location.href = "/account";
          }}
        >
          👤 Account
        </button>
      ) : (
        <button
          onClick={() => {
            setMobileMenuOpen(false);
            setShowLoginPopup(true);
          }}
        >
          Login / Register
        </button>
      )}
    </div>
  )}
</header>

      <main>
        {page === "home" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <p className="eyebrow">
                  THE ROYAL TABLE
                </p>

                <h1>
                  Food with a legacy.
                  <br />
                  <em>Flavour with a soul.</em>
                </h1>

                <p>
                  Experience rich Indian recipes,
                  aromatic rice and hearty curries
                  prepared with the warmth of a royal
                  kitchen.
                </p>

                <button
                  className="gold-button"
                  onClick={() => setPage("menu")}
                >
                  Explore the menu
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="hero-art">
  <div className="hero-ring" />

  <div
    className="hero-image-slider"
    style={{
      "--hero-animation-duration": `${
        Math.max(menu.filter((item) => item.image).length, 1) * 4
      }s`,
    }}
  >
    {menu
      .filter((item) => item.image)
      .map((item, index, images) => (
        <img
          key={item.id || index}
          src={item.image}
          alt={item.item || "Kshatriya Kitchen food"}
          className="hero-slide-image"
          style={{
            animationDelay: `${index * 4}s`,
          }}
        />
      ))}
  </div>
</div>
            </section>

            <section className="intro-section">
              <p className="eyebrow">
                FROM OUR KITCHEN
              </p>

              <h2>
                Made for moments
                <br />
                worth remembering
              </h2>

              <p className="intro-text">
                Every dish is prepared to bring
                people together. Browse our menu and
                order directly through WhatsApp.
              </p>

              <button
                className="outline-button"
                onClick={() => setPage("menu")}
              >
                View all dishes
              </button>
            </section>
          </>
        )}

        {page === "menu" && (
          <section className="menu-page">
            <div className="page-heading">
              <p className="eyebrow">OUR MENU</p>

              <h1>Royal favourites</h1>

              <p>
                Traditional recipes with a Kshatriya
                Kitchen signature.
              </p>
            </div>

            <div className="categories">
              {[
                "All",
                "Biryani",
                "Rice Meals"
              ].map((item) => (
                <button
                  key={item}
                  className={
                    category === item ? "active" : ""
                  }
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="food-grid">
              {filteredMenu.map((item) => (
                <FoodCard
                  key={item.id}
                  item={item}
                  addToCart={addToCart}
                  view={() => setSelected(item)}
                />
              ))}
            </div>
          </section>
        )}

        {page === "checkout" && (
          <Checkout
            cart={cart}
            total={total}
            subtotal={subtotal}
            delivery={delivery}
            service={service}
            tax={tax}
            settings={settings}
            customer={customerProfile}
            deliveryDistance={deliveryDistance}
            setDeliveryDistance={setDeliveryDistance}
            placeOrder={placeOrder}
            back={() => setPage("menu")}
          />
        )}
        {page === "account" && (
  <CustomerAccount
    user={customerUser}
    profile={customerProfile}
    orders={customerOrders}
    onBack={() => setPage("home")}
    onEditProfile={() => {
      setShowProfileSetup(true);
    }}
    onLogout={() => {
      setCustomerUser(null);
      setCustomerProfile(null);
      setCustomerOrders([]);
      setShowProfileSetup(false);
      setPage("home");
    }}
  />
)}

        {page === "confirmation" && (
          <section className="confirmation">
            <div className="confirmation-icon">
              <Check size={34} />
            </div>

            <p className="eyebrow">
              ORDER RECEIVED
            </p>

            <h1>Your order is on its way.</h1>

            <p>
              WhatsApp has opened with your order
              details. Please send the message to
              confirm your order.
            </p>

            <button
              className="gold-button"
              onClick={() => setPage("menu")}
            >
              Order something else
            </button>
          </section>
        )}
        <section className="contact-section">
  <div className="contact-inner">
    <p className="eyebrow">
      KSHATRIYA KITCHEN
    </p>

    <h2>
      Visit or connect with us
    </h2>

    <p className="contact-owner">
      Owner: {settings.ownerName || "-"}
    </p>

    <p className="contact-address">
      {settings.address || "-"}
    </p>

    <div className="contact-details">
      <p>
        <strong>Phone:</strong>{" "}
        {settings.phone || "-"}
      </p>

      <p>
        <strong>Opening Hours:</strong>{" "}
        {settings.openingHours || "-"}
      </p>
    </div>

    <div className="contact-links">
      {settings.mapsUrl &&
        settings.mapsUrl !== "-" && (
          <a
            href={settings.mapsUrl}
            target="_blank"
            rel="noreferrer"
          >
            Google Maps
          </a>
        )}

      {settings.instagram &&
        settings.instagram !== "-" && (
          <a
            href={settings.instagram}
            target="_blank"
            rel="noreferrer"
          >
            Instagram
          </a>
        )}

      {settings.facebook &&
        settings.facebook !== "-" && (
          <a
            href={settings.facebook}
            target="_blank"
            rel="noreferrer"
          >
            Facebook
          </a>
        )}
    </div>
  </div>
</section>
      </main>

      {selected && (
        <div
          className="modal-backdrop"
          onClick={() => setSelected(null)}
        >
          <div
            className="detail-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              className="close-button"
              onClick={() => setSelected(null)}
            >
              <X />
            </button>

            <img
              src={selected.image}
              alt={selected.name}
            />

            <div className="detail-content">
              <p className="eyebrow">
                {selected.category}
              </p>

              <h2>{selected.name}</h2>

              <p>{selected.description}</p>

              <strong className="price">
                {money(selected.price)}
              </strong>

              <button
                className="gold-button full"
                onClick={() =>
                  addToCart(selected)
                }
              >
                Add to cart
              </button>
            </div>
          </div>
        </div>
      )}

      {cartOpen && (
        <CartDrawer
          cart={cart}
          total={total}
          changeQuantity={changeQuantity}
          close={() => setCartOpen(false)}
          checkout={startCheckout}
        />
      )}
    </div>
  );
}

function FoodCard({ item, addToCart, view }) {
  return (
    <article className="food-card">
      <button
        className="image-button"
        onClick={view}
      >
        <img
          src={item.image}
          alt={item.name}
        />
      </button>

      <div className="food-card-body">
        <p className="card-category">
          {item.category}
        </p>

        <h3>{item.name}</h3>

        <p>{item.description}</p>

        <div className="card-footer">
          <strong>
            {money(item.price)}
          </strong>

          <button
            className="add-button"
            onClick={() => addToCart(item)}
          >
            <Plus size={18} />
            Add
          </button>
        </div>
      </div>
    </article>
  );
}

function CartDrawer({
  cart,
  total,
  changeQuantity,
  close,
  checkout
}) {
  return (
    <div
      className="drawer-layer"
      onClick={close}
    >
      <aside
        className="cart-drawer"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="drawer-header">
          <div>
            <p className="eyebrow">
              YOUR ORDER
            </p>

            <h2>Cart</h2>
          </div>

          <button
            className="close-button static"
            onClick={close}
          >
            <X />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="empty-state">
            <ShoppingBag size={42} />
            <p>Your cart is empty.</p>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cart.map((item) => (
                <div
                  className="cart-item"
                  key={item.id}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                  />

                  <div className="cart-item-info">
                    <h3>{item.name}</h3>

                    <strong>
                      {money(
                        item.price *
                          item.quantity
                      )}
                    </strong>

                    <div className="quantity">
                      <button
                        onClick={() =>
                          changeQuantity(
                            item.id,
                            -1
                          )
                        }
                      >
                        <Minus size={14} />
                      </button>

                      <span>
                        {item.quantity}
                      </span>

                      <button
                        onClick={() =>
                          changeQuantity(
                            item.id,
                            1
                          )
                        }
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="drawer-total">
              <span>Total</span>
              <strong>
                {money(total)}
              </strong>
            </div>

            <button
              className="gold-button full"
              onClick={checkout}
            >
              Continue to checkout
            </button>
          </>
        )}
      </aside>
    </div>
  );
}

function Checkout({
  cart,
  total,
  subtotal,
  delivery,
  service,
  tax,
  settings,
  customer,
  deliveryDistance,
  setDeliveryDistance,
  placeOrder,
  back
}) {
  const [notes, setNotes] = useState("");

  const [transactionId, setTransactionId] =
    useState("");

  const [paymentError, setPaymentError] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState(
      settings.upiEnabled
        ? "UPI"
        : total <= 400
          ? "COD"
          : ""
    );

  const codAvailable = total <= 400;

  function submit(event) {
    event.preventDefault();

    if (
      !customer?.name ||
      !customer?.phone ||
      !customer?.address
    ) {
      alert(
        "Please complete your customer profile before placing an order."
      );
      return;
    }

    if (!paymentMethod) {
      alert(
        "Please select a payment method."
      );
      return;
    }

    // ==============================
    // CASH ON DELIVERY
    // ==============================
    if (paymentMethod === "COD") {
      if (!codAvailable) {
        alert(
          "Cash on Delivery is available only for orders up to ₹400."
        );
        return;
      }

      const payment = {
        method: "Cash on Delivery",
        status: "Pay on Delivery",
        upiId: "",
        transactionId: ""
      };

      placeOrder(
        {
          ...customer,
          notes
        },
        payment
      );

      return;
    }

    // ==============================
    // UPI PAYMENT
    // ==============================
    if (paymentMethod === "UPI") {
      if (!settings.upiEnabled) {
        alert(
          "UPI payment is currently unavailable."
        );
        return;
      }

      if (!settings.upiQr) {
        alert(
          "UPI QR code has not been configured by the restaurant."
        );
        return;
      }

      if (
        !isValidTransactionId(transactionId)
      ) {
        setPaymentError(
          "Please enter a valid UPI Transaction ID."
        );
        return;
      }

      const payment =
        createUpiPayment({
          transactionId,
          amount: total,
          upiId: settings.upiId
        });

      placeOrder(
        {
          ...customer,
          notes
        },
        {
          ...payment,
          method: "UPI"
        }
      );
    }
  }

  return (
    <section className="checkout-page">

      <button
        className="back-link"
        onClick={back}
      >
        <ArrowLeft size={16} />
        Back to menu
      </button>

      <div className="page-heading compact">
        <p className="eyebrow">
          CHECKOUT
        </p>

        <h1>
          Complete your order
        </h1>
      </div>

      <div className="checkout-layout">

        <form
          className="customer-form"
          onSubmit={submit}
        >

          <div className="saved-customer-box">
            <p className="eyebrow">
              DELIVERY DETAILS
            </p>

            <h2>
              Delivering to
            </h2>

            <div className="saved-customer-detail">
              <strong>
                {customer?.name}
              </strong>

              <span>
                {customer?.phone}
              </span>

              <span>
                {customer?.address}
              </span>
            </div>

            <p className="saved-profile-note">
              Your saved account details will be
              used for this order.
            </p>
          </div>

          <label>
            Delivery distance (km)

            <input
              type="number"
              min="0"
              step="0.1"
              value={deliveryDistance}
              onChange={(event) =>
                setDeliveryDistance(
                  Number(
                    event.target.value || 0
                  )
                )
              }
              placeholder="Example: 4.5"
            />

            <span className="optional">
              Up to 3 km free. After 3 km, delivery
              starts at ₹40 and increases by ₹10
              per additional km.
            </span>
          </label>

          <label>
            Order notes{" "}
            <span className="optional">
              Optional
            </span>

            <textarea
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Any special instructions?"
            />
          </label>

          {/* =================================
              PAYMENT METHOD
              ================================= */}

          <div className="payment-method-box">

            <p className="eyebrow">
              PAYMENT
            </p>

            <h2>
              Choose payment method
            </h2>

            {settings.upiEnabled && (
              <label className="payment-option">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="UPI"
                  checked={
                    paymentMethod === "UPI"
                  }
                  onChange={() => {
                    setPaymentMethod("UPI");
                    setPaymentError("");
                  }}
                />

                <span>
                  <strong>
                    UPI / Online Payment
                  </strong>

                  <small>
                    Pay now using the UPI QR code.
                  </small>
                </span>
              </label>
            )}

            <label
              className={
                codAvailable
                  ? "payment-option"
                  : "payment-option disabled"
              }
            >
              <input
                type="radio"
                name="paymentMethod"
                value="COD"
                checked={
                  paymentMethod === "COD"
                }
                onChange={() => {
                  if (!codAvailable) {
                    return;
                  }

                  setPaymentMethod("COD");
                  setPaymentError("");
                }}
                disabled={!codAvailable}
              />

              <span>
                <strong>
                  Cash on Delivery
                </strong>

                <small>
                  {codAvailable
                    ? "Available for orders up to ₹400."
                    : "Not available for orders above ₹400."}
                </small>
              </span>
            </label>

            {!codAvailable && (
              <div className="payment-pending-note">
                COD is unavailable because your
                order total is above ₹400. Please
                use online payment.
              </div>
            )}

          </div>

          {/* =================================
              UPI PAYMENT
              ================================= */}

          {paymentMethod === "UPI" &&
            settings.upiEnabled && (
              <div className="upi-payment-box">

                <p className="eyebrow">
                  SECURE PAYMENT
                </p>

                <h2>
                  Pay using UPI
                </h2>

                <p className="upi-instruction">
                  Scan the QR code below and
                  complete the payment before
                  submitting your order.
                </p>

                {settings.upiQr ? (
                  <div className="upi-qr-wrapper">
                    <img
                      src={settings.upiQr}
                      alt="Kshatriya Kitchen UPI QR Code"
                      className="upi-qr"
                    />
                  </div>
                ) : (
                  <div className="upi-no-qr">
                    QR code is not configured
                    yet.
                  </div>
                )}

                {settings.upiId &&
                  settings.upiId !== "EDIT_ME" && (
                    <div className="upi-id-display">
                      <span>
                        UPI ID
                      </span>

                      <strong>
                        {settings.upiId}
                      </strong>
                    </div>
                  )}

                <label>
                  UPI Transaction ID

                  <input
                    value={transactionId}
                    onChange={(event) => {
                      setTransactionId(
                        event.target.value
                      );
                      setPaymentError("");
                    }}
                    placeholder="Enter transaction ID after payment"
                  />
                </label>

                {paymentError && (
                  <p className="upi-error">
                    {paymentError}
                  </p>
                )}

                <div className="payment-pending-note">
                  After completing payment, enter
                  your Transaction ID and continue.
                </div>

              </div>
            )}

          {/* =================================
              FINAL ORDER BUTTON
              ================================= */}

          <button
            className="gold-button full"
            type="submit"
          >
            {paymentMethod === "COD"
              ? "Confirm COD Order"
              : "I've Paid & Place Order"}
          </button>

        </form>

        {/* =================================
            ORDER SUMMARY
            ================================= */}

        <div className="summary-card">

          <h2>
            Order summary
          </h2>

          {cart.map((item) => (
            <div
              className="summary-line"
              key={item.id}
            >
              <span>
                {item.name} × {item.quantity}
              </span>

              <strong>
                {money(
                  item.price *
                    item.quantity
                )}
              </strong>
            </div>
          ))}

          <hr />

          <div className="summary-line">
            <span>
              Subtotal
            </span>

            <strong>
              {money(subtotal)}
            </strong>
          </div>

          <div className="summary-line">
            <span>
              Delivery
            </span>

            <strong>
              {money(delivery)}
            </strong>
          </div>

          <div className="summary-line">
            <span>
              Service charge
            </span>

            <strong>
              {money(service)}
            </strong>
          </div>

          <div className="summary-line">
            <span>
              GST / tax
            </span>

            <strong>
              {money(tax)}
            </strong>
          </div>

          <hr />

          <div className="summary-total">
            <span>
              Total
            </span>

            <strong>
              {money(total)}
            </strong>
          </div>

          <p className="summary-note">
            Payment method:{" "}
            <strong>
              {paymentMethod === "COD"
                ? "Cash on Delivery"
                : "UPI / Online Payment"}
            </strong>
          </p>

          {paymentMethod === "COD" && (
            <p className="summary-note">
              COD limit:{" "}
              <strong>
                ₹400 maximum
              </strong>
            </p>
          )}

        </div>

      </div>
    </section>
  );
}
  
  

function Admin({
  menu,
  setMenu,
  settings,
  setSettings,
  orders,
  setOrders,
  exit
}) {
  const [loggedIn, setLoggedIn] =
    useState(false);

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loginLoading, setLoginLoading] =
    useState(false);

  const [tab, setTab] =
    useState("dashboard");

  if (!loggedIn) {
    return (
      <div className="admin-login">
        <div className="login-card">
          <span className="brand-mark">
            KK
          </span>

          <p className="eyebrow">
            PRIVATE AREA
          </p>

          <h1>
            Admin login
          </h1>

          <p>
  Sign in with your authorized
  administrator account.
</p>

         <input
  type="email"
  value={email}
  onChange={(event) =>
    setEmail(event.target.value)
  }
  placeholder="Admin email"
/>

<input
  type="password"
  value={password}
  onChange={(event) =>
    setPassword(event.target.value)
  }
  placeholder="Password"
/>

          <button
            className="gold-button full"
            onClick={async () => {
              if (!supabase) {
                alert("Supabase is not configured.");
                return;
              }
            
              if (!email.trim() || !password) {
                alert("Enter your admin email and password.");
                return;
              }
            
              setLoginLoading(true);
            
              const { error } =
                await supabase.auth.signInWithPassword({
                  email: email.trim(),
                  password
                });
            
              setLoginLoading(false);
            
              if (error) {
                alert(error.message);
                return;
              }
            
              setLoggedIn(true);
            }}
          >
            {loginLoading
    ? "Signing in..."
    : "Enter dashboard"}
</button>
<button
  className="text-button"
  onClick={exit}
>
  Return to store
</button>
        </div>
      </div>
    );
  }

  function updateItem(
    id,
    field,
    value
  ) {
    setMenu(
      menu.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]:
                field === "price"
                  ? Number(value)
                  : value
            }
          : item
      )
    );
  }

  function updateSetting(
    field,
    value
  ) {
    setSettings({
      ...settings,
      [field]: value
    });
  }

  async function uploadUpiQr(event) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const qrData =
        await readQrFile(file);

      setSettings({
        ...settings,
        upiQr: qrData
      });
    } catch (error) {
      alert(error.message);
    }

    event.target.value = "";
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <span className="brand-mark">
            KK
          </span>

          <strong>
            Admin
          </strong>
        </div>

        <button
          className={
            tab === "dashboard"
              ? "selected"
              : ""
          }
          onClick={() =>
            setTab("dashboard")
          }
        >
          <Package size={17} />
          Dashboard
        </button>

        <button
          className={
            tab === "menu"
              ? "selected"
              : ""
          }
          onClick={() =>
            setTab("menu")
          }
        >
          <Utensils size={17} />
          Menu management
        </button>

        <button
          className={
            tab === "orders"
              ? "selected"
              : ""
          }
          onClick={() =>
            setTab("orders")
          }
        >
          <ShoppingBag size={17} />
          Orders
        </button>

        <button
          className={
            tab === "settings"
              ? "selected"
              : ""
          }
          onClick={() =>
            setTab("settings")
          }
        >
          <Settings size={17} />
          Restaurant settings
        </button>

        <button onClick={exit}>
          <ArrowLeft size={17} />
          Storefront
        </button>
      </aside>

      <main className="admin-main">
        {tab === "dashboard" && (
          <AdminDashboard
            menu={menu}
            orders={orders}
          />
        )}

        {tab === "menu" && (
          <section>
            <div className="admin-heading">
  <div>
    <p className="eyebrow">
      CATALOGUE
    </p>

    <h1>
      Menu management
    </h1>
  </div>

  <div className="admin-heading-actions">
    <button
      className="gold-button"
      onClick={async () => {
        await saveMenuToSupabase(menu);
        alert("Menu saved successfully.");
      }}
    >
      Save menu
    </button>

    <button
      className="gold-button"
      onClick={() =>
        setMenu([
          ...menu,
          {
            id: `item-${Date.now()}`,
            name: "New menu item",
            description: "EDIT_ME",
            category: "Biryani",
            price: 0,
            image:
              "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85",
            available: true
          }
        ])
      }
    >
      Add item
    </button>
  </div>
</div>

            <div className="admin-table">
              {menu.map((item) => (
                <div
                  className="admin-row"
                  key={item.id}
                >
                  <img
                    src={item.image}
                    alt=""
                  />

                  <div className="admin-fields">
                    <input
                      value={item.name}
                      onChange={(event) =>
                        updateItem(
                          item.id,
                          "name",
                          event.target.value
                        )
                      }
                    />

                    <input
                      value={
                        item.description
                      }
                      onChange={(event) =>
                        updateItem(
                          item.id,
                          "description",
                          event.target.value
                        )
                      }
                    />

                    <input
                      value={
                        item.category
                      }
                      onChange={(event) =>
                        updateItem(
                          item.id,
                          "category",
                          event.target.value
                        )
                      }
                    />

                    <input
                      type="number"
                      value={
                        item.price
                      }
                      onChange={(event) =>
                        updateItem(
                          item.id,
                          "price",
                          event.target.value
                        )
                      }
                      placeholder="Price"
                    />

                    <input
                      value={
                        item.image
                      }
                      onChange={(event) =>
                        updateItem(
                          item.id,
                          "image",
                          event.target.value
                        )
                      }
                      placeholder="Image URL"
                    />
                  </div>

                  <div className="row-actions">
                    <button
                      className={
                        item.available
                          ? "availability on"
                          : "availability"
                      }
                      onClick={() =>
                        updateItem(
                          item.id,
                          "available",
                          !item.available
                        )
                      }
                    >
                      {item.available
                        ? "Available"
                        : "Unavailable"}
                    </button>

                    <button
                      className="danger-button"
                      onClick={() =>
                        setMenu(
                          menu.filter(
                            (entry) =>
                              entry.id !==
                              item.id
                          )
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section>
            <div className="admin-heading">
              <div>
                <p className="eyebrow">
                  CONFIGURATION
                </p>

                <h1>
                  Restaurant settings
                </h1>
              </div>
            </div>

            <div className="settings-grid">
              {[
                ["name", "Name"],
                ["ownerName", "Owner name"],
                ["tagline", "Tagline"],
                ["phone", "Phone"],
                ["whatsapp", "WhatsApp"],
                ["address", "Address"],
                [
                  "mapsUrl",
                  "Google Maps URL"
                ],
                [
                  "openingHours",
                  "Opening hours"
                ],
                [
                  "instagram",
                  "Instagram"
                ],
                [
                  "facebook",
                  "Facebook"
                ],
                ["logo", "Logo URL"],
                [
                  "favicon",
                  "Favicon URL"
                ],
                [
                  "deliveryCharge",
                  "Delivery charge"
                ],
                [
                  "serviceCharge",
                  "Service charge"
                ],
                [
                  "tax",
                  "GST / tax percentage"
                ],
                [
                  "minimumOrder",
                  "Minimum order"
                ]
              ].map(
                ([field, label]) => (
                  <label key={field}>
                    {label}

                    <input
                      value={
                        settings[field] ??
                        ""
                      }
                      onChange={(event) =>
                        updateSetting(
                          field,
                          event.target.value
                        )
                      }
                    />
                  </label>
                )
              )}

                <div className="admin-actions">
              <button
                className="gold-button"
                onClick={async () => {
                  const success =
                    await saveSettingsToSupabase(
                      settings
                    );

                  if (success) {
                    alert(
                      "Restaurant settings saved successfully."
                    );
                  } else {
                    alert(
                      "Could not save restaurant settings."
                    );
                  }
                }}
              >
                Save settings
              </button>
            </div>

              <div className="payment-settings-card">
                <p className="eyebrow">
                  PAYMENTS
                </p>

                <h2>
                  UPI Payment Settings
                </h2>

                <label className="checkbox-setting">
                  <input
                    type="checkbox"
                    checked={Boolean(
                      settings.upiEnabled
                    )}
                    onChange={(event) =>
                      updateSetting(
                        "upiEnabled",
                        event.target
                          .checked
                      )
                    }
                  />

                  Enable UPI payments
                </label>

                <label>
                  UPI ID

                  <input
                    value={
                      settings.upiId ||
                      ""
                    }
                    onChange={(event) =>
                      updateSetting(
                        "upiId",
                        event.target.value
                      )
                    }
                    placeholder="example@upi"
                  />
                </label>

                <div className="qr-admin-area">
                  <strong>
                    UPI QR Code
                  </strong>

                  {settings.upiQr ? (
                    <img
                      src={
                        settings.upiQr
                      }
                      alt="Current UPI QR"
                      className="admin-qr-preview"
                    />
                  ) : (
                    <div className="qr-empty">
                      No QR code uploaded
                    </div>
                  )}

                  <label className="upload-qr-button">
                    Upload / Replace QR

                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={
                        uploadUpiQr
                      }
                    />
                  </label>

                  {settings.upiQr && (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() =>
                        updateSetting(
                          "upiQr",
                          ""
                        )
                      }
                    >
                      Remove QR
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === "orders" && (
          <section>
            <div className="admin-heading">
              <div>
                <p className="eyebrow">
                  FULFILMENT
                </p>

                <h1>
                  Orders management
                </h1>
              </div>
            </div>

            <div className="orders-list">
              {orders.length === 0 ? (
                <div className="empty-state">
                  <ShoppingBag size={42} />
                  <p>
                    No orders yet.
                  </p>
                </div>
              ) : (
                orders.map((order) => (
                  <div
                    className="order-card"
                    key={order.id}
                  >
                    <div>
                      <strong>
                        {order.id}
                      </strong>

                      <p>
                        {
                          order.customer
                            .name
                        }{" "}
                        ·{" "}
                        {
                          order.customer
                            .phone
                        }
                      </p>

                      <p>
                        {
                          order.customer
                            .address
                        }
                      </p>
                    </div>

                    <select
                      value={
                        order.status
                      }
                      onChange={(event) =>
                        setOrders(
                          orders.map(
                            (entry) =>
                              entry.id ===
                              order.id
                                ? {
                                    ...entry,
                                    status:
                                      event
                                        .target
                                        .value
                                  }
                                : entry
                          )
                        )
                      }
                    >
                      <option>
                        Received
                      </option>

                      <option>
                        Preparing
                      </option>

                      <option>
                        Out for delivery
                      </option>

                      <option>
                        Completed
                      </option>

                      <option>
                        Cancelled
                      </option>
                    </select>

                    <strong>
                      {money(order.total)}
                    </strong>

                    {order.payment && (
                      <div>
                        <strong>
                          UPI
                        </strong>

                        <p>
                          Txn:{" "}
                          {
                            order
                              .payment
                              .transactionId
                          }
                        </p>

                        <p>
                          {
                            order
                              .payment
                              .status
                          }
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function AdminDashboard({
  menu,
  orders
}) {
  return (
    <section>
      <div className="admin-heading">
        <div>
          <p className="eyebrow">
            OVERVIEW
          </p>

          <h1>
            Dashboard
          </h1>
        </div>
      </div>

      <div className="stats-grid">
        <div>
          <Utensils />

          <strong>
            {menu.length}
          </strong>

          <span>
            Menu items
          </span>
        </div>

        <div>
          <ShoppingBag />

          <strong>
            {orders.length}
          </strong>

          <span>
            Total orders
          </span>
        </div>

        <div>
          <Clock3 />

          <strong>
            {
              orders.filter(
                (order) =>
                  order.status ===
                  "Received"
              ).length
            }
          </strong>

          <span>
            New orders
          </span>
        </div>
      </div>
    </section>
  );
}
function CustomerLogin({ onClose, onSuccess }) {
  const [loginValue, setLoginValue] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const isPhone = /^\s*[0-9]/.test(loginValue);

  const cleanPhone = loginValue
    .replace(/\D/g, "")
    .slice(0, 10);

  const cleanEmail = loginValue.trim().toLowerCase();

  async function sendOtp() {
    if (isPhone) {
      if (cleanPhone.length !== 10) {
        alert(
          "Please enter a valid 10-digit WhatsApp number."
        );
        return;
      }

      alert(
        "WhatsApp OTP verification is coming soon. For now, please use your email address to login."
      );

      return;
    }

    if (!cleanEmail) {
      alert(
        "Please enter your email address or WhatsApp number."
      );
      return;
    }

    if (!cleanEmail.includes("@")) {
      alert(
        "Please enter a valid email address."
      );
      return;
    }

    if (!supabase) {
      alert("Supabase is not configured.");
      return;
    }

    setLoading(true);

    const { error } =
      await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true
        }
      });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setOtpSent(true);

    alert("OTP sent to your email.");
  }

  async function verifyOtp() {
    const cleanOtp = otp.trim();

    if (!cleanOtp) {
      alert("Please enter the OTP.");
      return;
    }

    if (!supabase) {
      alert("Supabase is not configured.");
      return;
    }

    if (isPhone) {
      alert(
        "WhatsApp OTP verification is coming soon. Please use email login for now."
      );
      return;
    }

    setLoading(true);

    const { data, error } =
      await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanOtp,
        type: "email"
      });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    if (!data.session) {
      alert(
        "Login was not completed. Please try again."
      );
      return;
    }

    onSuccess(data.session.user);
  }

  function handleLoginValueChange(event) {
    const value = event.target.value;

    if (/^\s*[0-9]/.test(value)) {
      setLoginValue(
        value
          .replace(/\D/g, "")
          .slice(0, 10)
      );
      return;
    }

    setLoginValue(value);
  }

  return (
    <div className="login-overlay">
      <div className="login-popup">

        <button
          className="login-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className="login-icon">
          KK
        </div>

        <h2>
          {otpSent
            ? "Enter OTP"
            : "Login to continue"}
        </h2>

        <p className="login-subtitle">
          {otpSent
            ? `We sent a verification code to ${cleanEmail}`
            : "Login with your email / WhatsApp number to continue your order."}
        </p>

        {!otpSent ? (
          <>
            <label className="login-label">
              {isPhone
                ? "WhatsApp number"
                : "Email address / WhatsApp number"}
            </label>

            <div className="login-input-wrapper">

              {isPhone && (
                <span className="phone-prefix">
                  +91
                </span>
              )}

              <input
                className={
                  isPhone
                    ? "login-input phone-input"
                    : "login-input"
                }
                type="text"
                value={loginValue}
                onChange={handleLoginValueChange}
                placeholder={
                  isPhone
                    ? "Enter 10-digit WhatsApp number"
                    : "Enter email or WhatsApp number"
                }
                inputMode={
                  isPhone
                    ? "numeric"
                    : "email"
                }
                autoComplete={
                  isPhone
                    ? "tel"
                    : "email"
                }
              />
            </div>

            {isPhone && (
              <p className="login-whatsapp-note">
                WhatsApp OTP verification is coming soon.
                <br />
                For now, please use email login.
              </p>
            )}

            <button
              className="gold-button full"
              onClick={sendOtp}
              disabled={loading}
            >
              {loading
                ? "Sending OTP..."
                : isPhone
                  ? "WhatsApp OTP Coming Soon"
                  : "Send OTP to Email"}
            </button>
          </>
        ) : (
          <>
            <label className="login-label">
              Enter OTP
            </label>

            <input
              className="login-input otp-input"
              type="text"
              inputMode="numeric"
              maxLength="6"
              value={otp}
              onChange={(event) =>
                setOtp(
                  event.target.value.replace(
                    /\D/g,
                    ""
                  )
                )
              }
              placeholder="Enter 6-digit OTP"
              autoComplete="one-time-code"
            />

            <button
              className="gold-button full"
              onClick={verifyOtp}
              disabled={loading}
            >
              {loading
                ? "Verifying..."
                : "Verify & Continue"}
            </button>

            <button
              className="login-secondary"
              onClick={() => {
                setOtpSent(false);
                setOtp("");
              }}
              disabled={loading}
            >
              Change email / WhatsApp number
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CustomerProfileSetup({
  user,
  existingProfile,
  onSaved
}) {
  const [name, setName] = useState(
    existingProfile?.name || ""
  );

  const [phone, setPhone] = useState(
    existingProfile?.phone || ""
  );

  const [address, setAddress] = useState(
    existingProfile?.address || ""
  );

  const [latitude, setLatitude] = useState(
    existingProfile?.latitude || null
  );

  const [longitude, setLongitude] = useState(
    existingProfile?.longitude || null
  );

  const [locationLoading, setLocationLoading] =
    useState(false);

  const [saving, setSaving] = useState(false);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      alert(
        "Location is not supported by this browser."
      );
      return;
    }

    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setLatitude(lat);
        setLongitude(lng);
        setLocationLoading(false);

        alert(
          "Your current location has been saved."
        );
      },
      (error) => {
        setLocationLoading(false);

        if (error.code === 1) {
          alert(
            "Location permission was denied. Please allow location access in your browser settings."
          );
        } else if (error.code === 2) {
          alert(
            "Your location could not be determined. Please try again."
          );
        } else {
          alert(
            "Could not get your location. Please try again."
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }

  async function saveProfile(event) {
    event.preventDefault();

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanAddress = address.trim();

    if (!cleanName) {
      alert("Please enter your name.");
      return;
    }

    if (!cleanPhone) {
      alert("Please enter your phone number.");
      return;
    }

    if (!cleanAddress) {
      alert("Please enter your delivery address.");
      return;
    }

    if (!user?.id) {
      alert(
        "Your login session could not be found. Please login again."
      );
      return;
    }

    setSaving(true);

    const profile = {
      id: user.id,
      email: user.email || "",
      name: cleanName,
      phone: cleanPhone,
      address: cleanAddress,
      latitude,
      longitude
    };

    const success =
      await saveCustomerProfile(profile);

    setSaving(false);

    if (!success) {
      alert(
        "Could not save your profile. Please try again."
      );
      return;
    }

    onSaved(profile);
  }

  return (
    <div className="profile-setup-page">
      <div className="profile-setup-card">
        <div className="profile-setup-icon">
          KK
        </div>

        <p className="eyebrow">
          WELCOME TO KSHATRIYA KITCHEN
        </p>

        <h1>
          Complete your profile
        </h1>

        <p className="profile-setup-subtitle">
          We need these details once. Your saved
          details will be used automatically for
          future orders.
        </p>

        <form onSubmit={saveProfile}>
          <label>
            Name

            <input
              type="text"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="Enter your name"
              autoComplete="name"
            />
          </label>

          <label>
            Phone number

            <input
              type="tel"
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value)
              }
              placeholder="Enter your phone number"
              autoComplete="tel"
            />
          </label>

          <label>
            Delivery address

            <textarea
              value={address}
              onChange={(event) =>
                setAddress(event.target.value)
              }
              placeholder="Enter your complete delivery address"
              autoComplete="street-address"
            />
          </label>

          <div className="location-box">
            <div>
              <strong>
                Delivery location
              </strong>

              <p>
                Allow location access so we can
                save your delivery location.
              </p>
            </div>

            <button
              type="button"
              className="location-button"
              onClick={useCurrentLocation}
              disabled={locationLoading}
            >
              <MapPin size={18} />

              {locationLoading
                ? "Getting location..."
                : latitude && longitude
                ? "Location Saved"
                : "Use Current Location"}
            </button>
          </div>

          {latitude && longitude && (
            <p className="location-success">
              ✓ Your current location has been saved.
            </p>
          )}

          <button
            type="submit"
            className="gold-button full"
            disabled={saving}
          >
            {saving
              ? "Saving profile..."
              : "Save & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

function CustomerAccount({
  user,
  profile,
  orders,
  onBack,
  onEditProfile,
  onLogout
}) {
  async function logout() {
    if (!supabase) {
      return;
    }

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      alert(error.message);
      return;
    }

    onLogout();
  }

  return (
    <section className="account-page">
      <button
        className="back-link"
        onClick={onBack}
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="page-heading compact">
        <p className="eyebrow">
          MY ACCOUNT
        </p>

        <h1>
          Welcome, {profile?.name || "Customer"}
        </h1>

        <p>
          Manage your details and view your
          previous orders.
        </p>
      </div>

      <div className="account-layout">
        <div className="account-card">
          <div className="account-card-header">
            <div>
              <p className="eyebrow">
                PROFILE
              </p>

              <h2>
                Personal details
              </h2>
            </div>

            <button
              className="account-edit-button"
              onClick={onEditProfile}
            >
              Edit
            </button>
          </div>

          <div className="account-detail">
            <span>
              Name
            </span>

            <strong>
              {profile?.name || "-"}
            </strong>
          </div>

          <div className="account-detail">
            <span>
              Email
            </span>

            <strong>
              {user?.email || "-"}
            </strong>
          </div>

          <div className="account-detail">
            <span>
              Phone
            </span>

            <strong>
              {profile?.phone || "-"}
            </strong>
          </div>

          <div className="account-detail">
            <span>
              Delivery address
            </span>

            <strong>
              {profile?.address || "-"}
            </strong>
          </div>

          <div className="account-detail">
            <span>
              Delivery location
            </span>

            <strong>
              {profile?.latitude &&
              profile?.longitude
                ? "Location saved"
                : "Location not saved"}
            </strong>
          </div>

          {profile?.latitude &&
            profile?.longitude && (
              <a
                className="account-location-link"
                href={`https://www.google.com/maps?q=${profile.latitude},${profile.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={16} />
                View saved location
              </a>
            )}

          <button
            className="logout-button"
            onClick={logout}
          >
            Logout
          </button>
        </div>

        <div className="account-card orders-card">
          <div className="account-card-header">
            <div>
              <p className="eyebrow">
                ORDER HISTORY
              </p>

              <h2>
                Previous orders
              </h2>
            </div>

            <span className="order-count">
              {orders.length}
            </span>
          </div>

          {!orders.length ? (
            <div className="empty-orders">
              <Package size={36} />

              <h3>
                No orders yet
              </h3>

              <p>
                Your previous orders will
                appear here.
              </p>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map((order) => (
                <div
                  className="account-order"
                  key={order.id}
                >
                  <div className="account-order-top">
                    <div>
                      <strong>
                        {order.id}
                      </strong>

                      <span>
                        {order.createdAt
                          ? new Date(
                              order.createdAt
                            ).toLocaleString(
                              "en-IN",
                              {
                                dateStyle:
                                  "medium",
                                timeStyle:
                                  "short"
                              }
                            )
                          : "-"}
                      </span>
                    </div>

                    <strong>
                      {money(order.total)}
                    </strong>
                  </div>

                  <div className="account-order-items">
                    {(order.items || []).map(
                      (item) => (
                        <span
                          key={item.id}
                        >
                          {item.name} ×{" "}
                          {item.quantity}
                        </span>
                      )
                    )}
                  </div>

                  <div className="account-order-bottom">
                    <span>
                      Status
                    </span>

                    <strong>
                      {order.status ||
                        "Received"}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default App;
