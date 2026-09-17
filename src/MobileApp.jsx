import React, { useMemo, useState } from "react";
import "./MobileApp.css";

export default function MobileApp({
  menu = [],
  settings = {},
  cart = [],
  customerUser = null,
  customerProfile = null,
  mobilePage = "home",
  onAddToCart,
  onCart,
  onOrders,
  onProfile,
  onLogin,
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const safeMenu = Array.isArray(menu) ? menu : [];

  const getItemName = (item) =>
    String(item?.name || item?.item || item?.title || "Food Item");

  const getItemPrice = (item) => {
    const raw =
      item?.price ??
      item?.amount ??
      item?.sellingPrice ??
      item?.selling_price;

    if (raw === undefined || raw === null || raw === "") {
      return null;
    }

    const value = Number(String(raw).replace(/[₹,\s]/g, ""));

    return Number.isFinite(value) ? value : null;
  };

  const getCategory = (item) =>
    String(item?.category || item?.categoryName || "Other");

  const getFoodType = (item) => {
    const value = String(
      item?.foodType ??
      item?.food_type ??
      item?.diet ??
      item?.dietType ??
      item?.isVeg ??
      ""
    )
      .trim()
      .toLowerCase();

    if (
      value === "veg" ||
      value === "vegetarian" ||
      value === "true"
    ) {
      return "veg";
    }

    if (
      value === "nonveg" ||
      value === "non-veg" ||
      value === "non veg" ||
      value === "nonvegetarian" ||
      value === "false"
    ) {
      return "nonveg";
    }

    return "unknown";
  };

  const categories = useMemo(() => {
    const values = safeMenu
      .map(getCategory)
      .filter(Boolean);

    return ["All", ...new Set(values)];
  }, [safeMenu]);

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return safeMenu
      .filter((item) => {
        const name = getItemName(item).toLowerCase();
        const category = getCategory(item).toLowerCase();
        const description = String(
          item?.description || ""
        ).toLowerCase();

        return (
          name.includes(query) ||
          category.includes(query) ||
          description.includes(query)
        );
      })
      .slice(0, 6);
  }, [safeMenu, search]);

  const filteredMenu = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (query) {
      return safeMenu.filter((item) => {
        const name = getItemName(item).toLowerCase();
        const category = getCategory(item).toLowerCase();
        const description = String(
          item?.description || ""
        ).toLowerCase();

        return (
          name.includes(query) ||
          category.includes(query) ||
          description.includes(query)
        );
      });
    }

    if (activeCategory === "All") {
      return safeMenu;
    }

    return safeMenu.filter(
      (item) => getCategory(item) === activeCategory
    );
  }, [safeMenu, search, activeCategory]);

  const cartCount = cart.reduce(
    (total, item) => total + Number(item.quantity || 1),
    0
  );

  const locationText =
    customerProfile?.address || "My Location";

  const handleLocation = () => {
    if (customerUser && onProfile) {
      onProfile();
    } else if (onLogin) {
      onLogin();
    }
  };

  const handleHome = () => {
    setSearch("");
    setActiveCategory("All");
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleSuggestion = (item) => {
    setSearch(getItemName(item));
  };


if (mobilePage === "orders") {
  return (
    <div className="kk-mobile-app">
      <header className="kk-mobile-header">
        <div>
          <span className="kk-small-label">MY ACCOUNT</span>
          <h2>My Orders</h2>
        </div>

        <button
          type="button"
          className="kk-profile-button"
          onClick={onProfile}
        >
          👤
        </button>
      </header>

      <section className="kk-menu-section">
        <div className="kk-empty-menu">
          <div>📦</div>
          <h3>My Orders</h3>
          <p>Your orders will appear here.</p>
        </div>
      </section>

      <nav className="kk-bottom-nav">
        <button
          type="button"
          className="kk-nav-item"
          onClick={() => window.location.reload()}
        >
          <span>⌂</span>
          <small>Home</small>
        </button>

        <button
          type="button"
          className="kk-nav-item active"
        >
          <span>▣</span>
          <small>Orders</small>
        </button>

        <button
          type="button"
          className="kk-nav-item kk-nav-cart"
          onClick={onCart}
        >
          <span>🛒</span>
          <small>Cart</small>
        </button>

        <button
          type="button"
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

if (mobilePage === "account") {
  return (
    <div className="kk-mobile-app">
      <header className="kk-mobile-header">
        <div>
          <span className="kk-small-label">MY ACCOUNT</span>
          <h2>Profile</h2>
        </div>

        <button
          type="button"
          className="kk-profile-button"
          onClick={onProfile}
        >
          👤
        </button>
      </header>

      <section className="kk-menu-section">
        <div className="kk-empty-menu">
          <div>👤</div>
          <h3>
            {customerProfile?.name ||
              customerUser?.email ||
              "My Profile"}
          </h3>
          <p>
            {customerProfile?.phone ||
              "Complete your profile to continue."}
          </p>
        </div>
      </section>

      <nav className="kk-bottom-nav">
        <button
          type="button"
          className="kk-nav-item"
          onClick={() => window.location.reload()}
        >
          <span>⌂</span>
          <small>Home</small>
        </button>

        <button
          type="button"
          className="kk-nav-item"
          onClick={onOrders}
        >
          <span>▣</span>
          <small>Orders</small>
        </button>

        <button
          type="button"
          className="kk-nav-item kk-nav-cart"
          onClick={onCart}
        >
          <span>🛒</span>
          <small>Cart</small>
        </button>

        <button
          type="button"
          className="kk-nav-item active"
        >
          <span>♙</span>
          <small>Profile</small>
        </button>
      </nav>
    </div>
  );
}



  return (
    <div className="kk-mobile-app">

      <header className="kk-mobile-header">
        <button
          type="button"
          className="kk-location"
          onClick={handleLocation}
        >
          <div className="kk-location-icon">⌖</div>

          <div>
            <span className="kk-small-label">
              DELIVER TO
            </span>

            <strong>{locationText}</strong>
          </div>

          <span className="kk-location-arrow">⌄</span>
        </button>

        <button
          type="button"
          className="kk-profile-button"
          onClick={customerUser ? onProfile : onLogin}
          aria-label="Profile"
        >
          👤
        </button>
      </header>

      <section className="kk-search-section">
        <div className="kk-search-box">
          <span className="kk-search-icon">⌕</span>

          <input
            type="text"
            placeholder="Search for biryani, pulav..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          {search && (
            <button
              type="button"
              className="kk-search-clear"
              onClick={() => setSearch("")}
            >
              ×
            </button>
          )}
        </div>

        {search.trim() && searchResults.length > 0 && (
          <div className="kk-search-suggestions">
            {searchResults.map((item, index) => (
              <button
                type="button"
                key={
                  item.id ||
                  item._id ||
                  `${getItemName(item)}-${index}`
                }
                className="kk-search-suggestion"
                onClick={() => handleSuggestion(item)}
              >
                <span className="kk-suggestion-icon">
                  🔎
                </span>

                <span>
                  <strong>{getItemName(item)}</strong>
                  <small>{getCategory(item)}</small>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="kk-offer-banner">
        <div className="kk-offer-content">
          <span className="kk-offer-small">
            KSHATRIYA KITCHEN
          </span>

          <h2>
            Authentic Biryani
            <br />
            & Pulavs
          </h2>

          <p>
            Freshly prepared. Rich in flavour.
          </p>

          <button
            type="button"
            onClick={() => {
              setSearch("");
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

      <section className="kk-category-section">
        <div className="kk-section-heading">
          <h3>What are you craving?</h3>
        </div>

        <div className="kk-category-scroll">
          {categories.map((category) => (
            <button
              type="button"
              key={category}
              className={
                activeCategory === category && !search.trim()
                  ? "kk-category active"
                  : "kk-category"
              }
              onClick={() => {
                setSearch("");
                setActiveCategory(category);
              }}
            >
              <div className="kk-category-icon">
                {category === "All" ? "🍽️" : "🍛"}
              </div>

              <span>{category}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="kk-menu-section">
        <div className="kk-section-heading kk-menu-heading">
          <div>
            <h3>
              {search.trim()
                ? "Search results"
                : "Popular near you"}
            </h3>

            <p>
              {search.trim()
                ? `${filteredMenu.length} item${
                    filteredMenu.length === 1 ? "" : "s"
                  } found`
                : "Made fresh at Kshatriya Kitchen"}
            </p>
          </div>
        </div>

        {filteredMenu.length === 0 ? (
          <div className="kk-empty-menu">
            <div>🍽️</div>

            <h3>No dishes found</h3>

            <p>
              Try another search or category.
            </p>
          </div>
        ) : (
          <div className="kk-food-list">
            {filteredMenu.map((item, index) => {
              const image =
                item?.image ||
                item?.img ||
                item?.photo ||
                "";

              const price = getItemPrice(item);
              const foodType = getFoodType(item);

              return (
                <article
                  className="kk-food-card"
                  key={
                    item?.id ||
                    item?._id ||
                    `${getItemName(item)}-${index}`
                  }
                >
                  <div className="kk-food-image-wrapper">
                    {image ? (
                      <img
                        src={image}
                        alt={getItemName(item)}
                        className="kk-food-image"
                      />
                    ) : (
                      <div className="kk-food-placeholder">
                        🍛
                      </div>
                    )}

                    {foodType !== "unknown" && (
                      <div
                        className={
                          foodType === "veg"
                            ? "kk-food-type-dot veg"
                            : "kk-food-type-dot nonveg"
                        }
                      >
                        <span />
                      </div>
                    )}
                  </div>

                  <div className="kk-food-info">
                    <div className="kk-food-top">
                      <h4>{getItemName(item)}</h4>
                    </div>

                    {item?.description && (
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
                        {price !== null
                          ? `₹${price}`
                          : "Price unavailable"}
                      </div>

                      <button
                        type="button"
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

      {cartCount > 0 && (
        <button
          type="button"
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

          <strong>View Cart →</strong>
        </button>
      )}

      <nav className="kk-bottom-nav">
        <button
          type="button"
          className="kk-nav-item active"
          onClick={handleHome}
        >
          <span>⌂</span>
          <small>Home</small>
        </button>

        <button
          type="button"
          className="kk-nav-item"
          onClick={onOrders}
        >
          <span>▣</span>
          <small>Orders</small>
        </button>

        <button
          type="button"
          className="kk-nav-item kk-nav-cart"
          onClick={onCart}
        >
          <span>🛒</span>

          {cartCount > 0 && <b>{cartCount}</b>}

          <small>Cart</small>
        </button>

        <button
          type="button"
          className="kk-nav-item"
          onClick={customerUser ? onProfile : onLogin}
        >
          <span>♙</span>
          <small>Profile</small>
        </button>
      </nav>

    </div>
  );
}
