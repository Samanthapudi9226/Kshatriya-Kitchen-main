import React, { useMemo, useState } from "react";
import "./MobileApp.css";

export default function MobileApp({
  menu = [],
  settings = {},
  cart = [],
  customerUser = null,
  customerProfile = null,
  onAddToCart,
  onCart,
  onOrders,
  onProfile,
  onLogin,
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const safeMenu = Array.isArray(menu) ? menu : [];

  const categories = useMemo(() => {
    const values = safeMenu
      .map((item) => item.category)
      .filter(Boolean);

    return ["All", ...new Set(values)];
  }, [safeMenu]);

  const filteredMenu = useMemo(() => {
    return safeMenu.filter((item) => {
      const name = String(item.name || "").toLowerCase();
      const category = String(item.category || "");

      const matchesSearch =
        !search.trim() ||
        name.includes(search.toLowerCase().trim());

      const matchesCategory =
        activeCategory === "All" ||
        category === activeCategory;

      return matchesSearch && matchesCategory;
    });
  }, [safeMenu, search, activeCategory]);

  const cartCount = cart.reduce(
    (total, item) => total + Number(item.quantity || 1),
    0
  );

  return (
    <div className="kk-mobile-app">

      {/* TOP HEADER */}
      <header className="kk-mobile-header">
        <div className="kk-location">
          <div className="kk-location-icon">⌖</div>

          <div>
            <span className="kk-small-label">DELIVER TO</span>
            <strong>My Location</strong>
          </div>

          <span className="kk-location-arrow">⌄</span>
        </div>

        <button
          className="kk-profile-button"
          onClick={onProfile}
          aria-label="Profile"
        >
          👤
        </button>
      </header>

      {/* SEARCH */}
      <section className="kk-search-section">
        <div className="kk-search-box">
          <span className="kk-search-icon">⌕</span>

          <input
            type="text"
            placeholder="Search for biryani, pulav..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {search && (
            <button
              className="kk-search-clear"
              onClick={() => setSearch("")}
            >
              ×
            </button>
          )}
        </div>
      </section>

      {/* OFFER BANNER */}
      <section className="kk-offer-banner">
        <div className="kk-offer-content">
          <span className="kk-offer-small">KSHATRIYA KITCHEN</span>

          <h2>Authentic Biryani<br />& Pulavs</h2>

          <p>Freshly prepared. Rich in flavour.</p>

          <button
            onClick={() => {
              setActiveCategory("All");
              window.scrollTo({
                top: 420,
                behavior: "smooth",
              });
            }}
          >
            ORDER NOW
          </button>
        </div>

        <div className="kk-offer-art">🍗</div>
      </section>

      {/* CATEGORIES */}
      <section className="kk-category-section">
        <div className="kk-section-heading">
          <h3>What are you craving?</h3>
        </div>

        <div className="kk-category-scroll">
          {categories.map((category) => (
            <button
              key={category}
              className={
                activeCategory === category
                  ? "kk-category active"
                  : "kk-category"
              }
              onClick={() => setActiveCategory(category)}
            >
              <div className="kk-category-icon">
                {category === "All" ? "🍽️" : "🍛"}
              </div>

              <span>{category}</span>
            </button>
          ))}
        </div>
      </section>

      {/* MENU */}
      <section className="kk-menu-section">
        <div className="kk-section-heading kk-menu-heading">
          <div>
            <h3>Popular near you</h3>
            <p>Made fresh at Kshatriya Kitchen</p>
          </div>
        </div>

        {filteredMenu.length === 0 ? (
          <div className="kk-empty-menu">
            <div>🍽️</div>
            <h3>No dishes found</h3>
            <p>Try another search or category.</p>
          </div>
        ) : (
          <div className="kk-food-list">
            {filteredMenu.map((item, index) => {
              const image =
                item.image ||
                item.img ||
                item.photo ||
                "";

              const price =
                item.price !== undefined &&
                item.price !== null &&
                item.price !== ""
                  ? item.price
                  : "EDIT PRICE";

              return (
                <article
                  className="kk-food-card"
                  key={item.id || item._id || `${item.name}-${index}`}
                >
                  <div className="kk-food-image-wrapper">
                    {image ? (
                      <img
                        src={image}
                        alt={item.name || "Food"}
                        className="kk-food-image"
                      />
                    ) : (
                      <div className="kk-food-placeholder">
                        🍛
                      </div>
                    )}

                    <div className="kk-veg-dot" />
                  </div>

                  <div className="kk-food-info">
                    <div className="kk-food-top">
                      <h4>{item.name || "Food Item"}</h4>
                    </div>

                    {item.description && (
                      <p className="kk-food-description">
                        {item.description}
                      </p>
                    )}

                    <div className="kk-food-rating">
                      <span>★</span>
                      <strong>4.8</strong>
                      <span className="kk-rating-text">
                        • Freshly prepared
                      </span>
                    </div>

                    <div className="kk-food-bottom">
                      <div className="kk-price">
                        ₹{price}
                      </div>

                      <button
                        className="kk-add-button"
                        onClick={() => {
                          if (onAddToCart) {
                            onAddToCart(item);
                          }
                        }}
                      >
                        ADD
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* FLOATING CART */}
      {cartCount > 0 && (
        <button
          className="kk-floating-cart"
          onClick={onCart}
        >
          <div className="kk-cart-left">
            <span className="kk-cart-count">
              {cartCount}
            </span>

            <span>
              {cartCount === 1 ? "item" : "items"} added
            </span>
          </div>

          <strong>
            View Cart →
          </strong>
        </button>
      )}

      {/* BOTTOM NAVIGATION */}
      <nav className="kk-bottom-nav">

        <button className="kk-nav-item active">
          <span>⌂</span>
          <small>Home</small>
        </button>

        <button
          className="kk-nav-item"
          onClick={onOrders}
        >
          <span>▣</span>
          <small>Orders</small>
        </button>

        <button
          className="kk-nav-item kk-nav-cart"
          onClick={onCart}
        >
          <span>🛒</span>

          {cartCount > 0 && (
            <b>{cartCount}</b>
          )}

          <small>Cart</small>
        </button>

        <button
          className="kk-nav-item"
          onClick={onProfile}
        >
          <span>♙</span>
          <small>Profile</small>
        </button>

      </nav>

    </div>
  );
}
