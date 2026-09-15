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
  const [page, setPage] = useState("home");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [deliveryDistance, setDeliveryDistance] = useState(0);
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
    setCartOpen(false);
    setPage("checkout");
  }

  function placeOrder(customer, payment = null) {
    const order = {
      id: `KK-${Date.now().toString().slice(-6)}`,
      customer,
      items: cart,
      total,
      payment,
      status: "Received",
      createdAt: new Date().toISOString()
    };

    setOrders((current) => [order, ...current]);
    setCart([]);
    setPage("confirmation");
    sendWhatsApp(order);
  }

  function sendWhatsApp(order) {
    const configured = String(
      settings.whatsapp || ""
    ).replace(/\D/g, "");

    const phone = configured || "";

    const paymentLines = order.payment
      ? [
          "",
          "*Payment Details*",
          `Payment Method: ${order.payment.method}`,
          `UPI ID: ${order.payment.upiId}`,
          `Transaction ID: ${order.payment.transactionId}`,
          `Payment Status: ${order.payment.status}`
        ]
      : [
          "",
          "Payment Method: Pay on confirmation"
        ];

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
    lines.push(`Total: ${money(order.total)}`);

    paymentLines.forEach((line) => {
      lines.push(line);
    });

    lines.push(`Customer: ${order.customer.name}`);
    lines.push(`Phone: ${order.customer.phone}`);
    lines.push(`Address: ${order.customer.address}`);

    if (order.customer.notes) {
      lines.push(`Notes: ${order.customer.notes}`);
    }

    const message = lines.join("\n");

    if (!phone) {
      alert("WhatsApp number is not configured.");
      return;
    }

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(
      message
    )}`;

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

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => setPage("home")}
        >
          <span className="brand-mark">KK</span>

          <span>
            <strong>{settings.name}</strong>
            <small>{settings.tagline}</small>
          </span>
        </button>

        <nav>
          <button onClick={() => setPage("home")}>
            Home
          </button>

          <button onClick={() => setPage("menu")}>
            Menu
          </button>

          <button onClick={() => setAdmin(true)}>
            Admin
          </button>
        </nav>

        <button
          className="cart-button"
          onClick={() => setCartOpen(true)}
        >
          <ShoppingBag size={20} />
          <span>{cartCount}</span>
        </button>
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

                <img
                  src={menu[0]?.image}
                  alt="Royal biryani"
                />
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
            deliveryDistance={deliveryDistance}
            setDeliveryDistance={setDeliveryDistance}
            placeOrder={placeOrder}
            back={() => setPage("menu")}
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
  deliveryDistance,
  setDeliveryDistance,
  placeOrder,
  back
}) {
  const [customer, setCustomer] =
    useState({
      name: "",
      phone: "",
      address: "",
      notes: ""
    });

  const [transactionId, setTransactionId] =
    useState("");

  const [paymentError, setPaymentError] =
    useState("");

  function update(event) {
    setCustomer({
      ...customer,
      [event.target.name]:
        event.target.value
    });
  }

  function submit(event) {
    event.preventDefault();

    if (
      !customer.name ||
      !customer.phone ||
      !customer.address
    ) {
      alert(
        "Please enter your name, phone number and delivery address."
      );
      return;
    }

    let payment = null;

    if (settings.upiEnabled) {
      if (!settings.upiQr) {
        alert(
          "UPI QR code has not been configured by the restaurant."
        );
        return;
      }

      if (
        !isValidTransactionId(
          transactionId
        )
      ) {
        setPaymentError(
          "Please enter a valid UPI Transaction ID."
        );
        return;
      }

      payment = createUpiPayment({
        transactionId,
        amount: total,
        upiId: settings.upiId
      });
    }

    placeOrder(customer, payment);
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
          <h2>
            Customer details
          </h2>

          <label>
            Name

            <input
              name="name"
              value={customer.name}
              onChange={update}
              placeholder="Your name"
            />
          </label>

          <label>
            Phone number

            <input
              name="phone"
              value={customer.phone}
              onChange={update}
              placeholder="Your phone number"
            />
          </label>

          <label>
            Delivery address

            <textarea
              name="address"
              value={customer.address}
              onChange={update}
              placeholder="Complete delivery address"
            />
          </label>
          <label>
            Delivery distance (km)

            <input
              type="number"
              min="0"
              step="0.1"
              value={deliveryDistance}
              onChange={(event) =>
                setDeliveryDistance(
                  Number(event.target.value || 0)
                )
              }
              placeholder="Example: 4.5"
            />

            <span className="optional">
              Up to 3 km free. After 3 km, delivery starts at ₹40 and increases by ₹10 per additional km.
            </span>
          </label>

          <label>
            Order notes{" "}
            <span className="optional">
              Optional
            </span>

            <textarea
              name="notes"
              value={customer.notes}
              onChange={update}
              placeholder="Any special instructions?"
            />
          </label>

          {settings.upiEnabled && (
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
                settings.upiId !==
                  "EDIT_ME" && (
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
                After payment, enter your
                Transaction ID and click
                <strong>
                  {" "}
                  I've Paid & Place Order
                </strong>
                .
              </div>
            </div>
          )}

          <button
            className="gold-button full"
            type="submit"
          >
            {settings.upiEnabled
              ? "I've Paid & Place Order"
              : "Send order on WhatsApp"}
          </button>
        </form>

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
                {item.name} ×{" "}
                {item.quantity}
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

          {settings.upiEnabled && (
            <p className="summary-note">
              Payment status:{" "}
              <strong>
                Verification Pending
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
export default App;
