import React, { useEffect, useMemo, useState } from "react";
import LogoIntro from "./LogoIntro";
import "./MobileApp.css";
export default 

function MobileApp({
  menu = [],
  settings = {},
  cart = [],
  orders = [],
  customerUser = null,
  customerProfile = null,
  mobilePage = "home",
  onAddToCart,
  onCart,
  onOrders,
  onProfile,
  onLogin,
  onEditProfile,
  onAddAddress,
  onLocationSelected,
  onLogout,
  onLocation,
  onHome,
}) {
 const [showIntro, setShowIntro] = useState(() => {
  return !sessionStorage.getItem("kk-intro-shown");
});
  const [search, setSearch] = useState("");
const [activeCategory, setActiveCategory] = useState("All");
const [showLocationSheet, setShowLocationSheet] = useState(false);
const [locationSearch, setLocationSearch] = useState("");
const [placeSuggestions, setPlaceSuggestions] = useState([]);

const [theme, setTheme] = useState(() => {
  return localStorage.getItem("kk-mobile-theme") || "light";
});

const toggleTheme = () => {
  setTheme((currentTheme) => {
    const nextTheme =
      currentTheme === "light" ? "dark" : "light";

    localStorage.setItem(
      "kk-mobile-theme",
      nextTheme
    );

    return nextTheme;
  });
};

useEffect(() => {
  if (!showIntro) {
    return;
  }

  sessionStorage.setItem("kk-intro-shown", "true");

  const introTimer = setTimeout(() => {
    setShowIntro(false);
  }, 5000);

  return () => clearTimeout(introTimer);
}, [showIntro]);

const savedLocationsKey = customerUser?.id
  ? `kk-saved-locations-${customerUser.id}`
  : null;

const [savedLocations, setSavedLocations] = useState([]);

useEffect(() => {
  if (!savedLocationsKey) {
    setSavedLocations([]);
    return;
  }

  try {
    const saved =
      localStorage.getItem(savedLocationsKey);

    setSavedLocations(
      saved ? JSON.parse(saved) : []
    );
  } catch {
    setSavedLocations([]);
  }
}, [savedLocationsKey]);
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
    const values = safeMenu.map(getCategory).filter(Boolean);
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
        const description = String(item?.description || "").toLowerCase();

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
        const description = String(item?.description || "").toLowerCase();

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
    customerProfile?.address || "Select your location";

  const handleHome = () => {
    if (onHome) {
      onHome();
    }

    setSearch("");
    setActiveCategory("All");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleLocation = () => {
    setLocationSearch("");
    setShowLocationSheet(true);
  };

  const handleCurrentLocation = async () => {
    setShowLocationSheet(false);

    if (onLocation) {
      await onLocation();
    }
  };

  const handleSuggestion = (item) => { 
  setSearch(getItemName(item)); 
}; 
 
const handleLocationSearch = async (event) => {
  const value = event.target.value;

  setLocationSearch(value);

  if (!value.trim() || value.trim().length < 3) {
    setPlaceSuggestions([]);
    return;
  }

  try {
    const apiKey =
      import.meta.env.VITE_GEOAPIFY_API_KEY;

    if (!apiKey) {
      console.error(
        "Geoapify API key is missing."
      );
      setPlaceSuggestions([]);
      return;
    }

    const url =
      `https://api.geoapify.com/v1/geocode/autocomplete` +
      `?text=${encodeURIComponent(value.trim())}` +
      `&filter=countrycode:in` +
      `&lang=en` +
      `&limit=6` +
      `&format=json` +
      `&apiKey=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Geoapify request failed: ${response.status}`
      );
    }

    const data = await response.json();

    setPlaceSuggestions(
      Array.isArray(data?.results)
        ? data.results
        : []
    );
  } catch (error) {
    console.error(
      "Geoapify autocomplete error:",
      error
    );

    setPlaceSuggestions([]);
  }
}; 
const handleLocationPlaceSelect = async (suggestion) => {
  try {
    if (!suggestion) {
      return;
    }

    const address =
      suggestion.formatted ||
      suggestion.address_line1 ||
      suggestion.name ||
      "";

    const latitude = Number(suggestion.lat);
    const longitude = Number(suggestion.lon);

    if (
      !address ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      console.error(
        "Geoapify did not return a valid location."
      );
      return;
    }

    const newLocation = {
      label:
        suggestion.name ||
        suggestion.address_line1 ||
        suggestion.city ||
        suggestion.suburb ||
        "Saved Address",
      address,
      latitude,
      longitude,
      selected: true,
    };

    const updatedLocations = [
      ...savedLocations.map((location) => ({
        ...location,
        selected: false,
      })),
      newLocation,
    ];

    setSavedLocations(updatedLocations);

    if (savedLocationsKey) {
      localStorage.setItem(
        savedLocationsKey,
        JSON.stringify(updatedLocations)
      );
    }

    if (onLocationSelected) {
      await onLocationSelected({
        address,
        latitude,
        longitude,
      });
    }

    setLocationSearch(address);
    setPlaceSuggestions([]);
    setShowLocationSheet(false);
  } catch (error) {
    console.error(
      "Could not select Geoapify location:",
      error
    );
  }
};  const handleAddAddress = () => {
  setShowLocationSheet(false);

  if (onAddAddress) {
    onAddAddress();
  }
};
const handleDeleteLocation = (index) => {
  const locationToDelete = savedLocations[index];

  const updatedLocations = savedLocations.filter(
    (_, locationIndex) => locationIndex !== index
  );

  setSavedLocations(updatedLocations);

  if (savedLocationsKey) {
  localStorage.setItem(
    savedLocationsKey,
    JSON.stringify(updatedLocations)
  );
}

  /*
   * If the deleted address is the currently selected
   * customer address, select another saved address.
   */
  if (
    locationToDelete?.selected &&
    updatedLocations.length > 0
  ) {
    const nextLocation = {
      ...updatedLocations[0],
      selected: true
    };

    const finalLocations = updatedLocations.map(
      (_, locationIndex) => ({
        ...updatedLocations[locationIndex],
        selected: locationIndex === 0
      })
    );

    setSavedLocations(finalLocations);

    if (savedLocationsKey) {
  localStorage.setItem(
    savedLocationsKey,
    JSON.stringify(finalLocations)
  );
}

    if (onLocationSelected) {
      onLocationSelected({
        address: nextLocation.address,
        latitude: nextLocation.latitude,
        longitude: nextLocation.longitude
      });
    }
  }
};
  const renderMapPin = () => (
    <svg
      viewBox="0 0 24 24"
      width="21"
      height="21"
      aria-hidden="true"
    >
      <path
        d="M12 21s7-6.1 7-12A7 7 0 0 0 5 9c0 5.9 7 12 7 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="9"
        r="2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
      />
    </svg>
  );

  const renderSearchIcon = () => (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
    >
      <circle
        cx="10.8"
        cy="10.8"
        r="6.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m16 16 4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );

  const renderNav = () => (
    <nav className="kk-bottom-nav">
      <button
        type="button"
        className={`kk-nav-item ${
          mobilePage === "home" ? "active" : ""
        }`}
        onClick={handleHome}
      >
        <span className="kk-nav-icon">⌂</span>
        <small>Home</small>
      </button>

      <button
        type="button"
        className={`kk-nav-item ${
          mobilePage === "orders" ? "active" : ""
        }`}
        onClick={onOrders}
      >
        <span className="kk-nav-icon">▣</span>
        <small>Orders</small>
      </button>

      <button
        type="button"
        className="kk-nav-item kk-nav-cart"
        onClick={onCart}
      >
        <span className="kk-nav-icon">🛒</span>

        {cartCount > 0 && <b>{cartCount}</b>}

        <small>Cart</small>
      </button>

      <button
        type="button"
        className={`kk-nav-item ${
          mobilePage === "account" ? "active" : ""
        }`}
        onClick={customerUser ? onProfile : onLogin}
      >
        <span className="kk-nav-icon">♙</span>
        <small>Profile</small>
      </button>
    </nav>
  );

  const renderLocationSheet = () => {
    if (!showLocationSheet) {
      return null;
    }

    return (
      <div
        className="kk-location-overlay"
        onClick={() => setShowLocationSheet(false)}
      >
        <div
          className="kk-location-sheet"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="kk-location-sheet-handle" />

          <div className="kk-location-sheet-header">
            <div>
              <span className="kk-small-label">DELIVERY LOCATION</span>
              <h2>Select a location</h2>
            </div>

            <button
              type="button"
              className="kk-location-close"
              onClick={() => setShowLocationSheet(false)}
              aria-label="Close location selector"
            >
              ×
            </button>
          </div>

       <div className="kk-location-search">
  <span className="kk-location-search-icon">
    🔍
  </span>

  <input
    type="text"
    value={locationSearch}
    onChange={handleLocationSearch}
    placeholder="Search for area, street name"
    autoComplete="off"
  />

  {locationSearch && (
    <button
      type="button"
      className="kk-location-search-clear"
      onClick={() => {
        setLocationSearch("");
        setPlaceSuggestions([]);
      }}
      aria-label="Clear location search"
    >
      ×
    </button>
  )}
</div>

{locationSearch.trim() && placeSuggestions.length > 0 && (
  <div className="kk-place-suggestions">
    {placeSuggestions.map((suggestion, index) => {
      const mainText =
        suggestion.name ||
        suggestion.address_line1 ||
        suggestion.street ||
        suggestion.suburb ||
        suggestion.city ||
        "Location";

      const secondaryText =
        suggestion.address_line2 ||
        [
          suggestion.suburb,
          suggestion.city,
          suggestion.county,
          suggestion.state,
          suggestion.postcode,
        ]
          .filter(Boolean)
          .join(", ");

      return (
        <button
          type="button"
          key={
            suggestion.place_id ||
            `${suggestion.lat}-${suggestion.lon}-${index}`
          }
          className="kk-place-suggestion"
          onClick={() =>
            handleLocationPlaceSelect(suggestion)
          }
        >
          <span className="kk-place-suggestion-icon">
            {renderMapPin()}
          </span>

          <span className="kk-place-suggestion-text">
            <strong>{mainText}</strong>

            <small>
              {secondaryText ||
                suggestion.formatted ||
                ""}
            </small>
          </span>
        </button>
      );
    })}
  </div>
)}          <button
            type="button"
            className="kk-location-action"
            onClick={handleCurrentLocation}
          >
            <span className="kk-location-action-icon current">
              {renderMapPin()}
            </span>

            <span>
              <strong>Use current location</strong>
              <small>Using your phone's GPS</small>
            </span>

            <span className="kk-location-action-arrow">›</span>
          </button>

          <button
            type="button"
            className="kk-location-action"
            onClick={handleAddAddress}
          >
            <span className="kk-location-action-icon">
              +
            </span>

            <span>
              <strong>Add Address</strong>
              <small>Save a delivery address</small>
            </span>

            <span className="kk-location-action-arrow">›</span>
          </button>

         <div className="kk-location-group">
  <div className="kk-location-group-title">
    SAVED ADDRESSES
  </div>

  {savedLocations.length > 0 ? (
    savedLocations.map((location, index) => (
      <div
        className="kk-saved-location"
        key={`${location.address}-${index}`}
      >
        <button
          type="button"
          className="kk-saved-location-main"
          onClick={() => {
  const selectedLocation = {
    ...location,
    selected: true,
  };

  const updatedLocations = savedLocations.map(
    (savedLocation, locationIndex) => ({
      ...savedLocation,
      selected: locationIndex === index,
    })
  );

  setSavedLocations(updatedLocations);

if (savedLocationsKey) {
  localStorage.setItem(
    savedLocationsKey,
    JSON.stringify(updatedLocations)
  );
}

  if (onLocationSelected) {
    onLocationSelected({
      address: selectedLocation.address,
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
    });
  }

  setLocationSearch(selectedLocation.address);
  setShowLocationSheet(false);
}}
        >
          <span className="kk-saved-location-icon">
            {renderMapPin()}
          </span>

          <span>
            <strong>
              {location.label || "Saved Address"}
            </strong>

            <small>{location.address}</small>
          </span>

          {location.selected && (
            <span className="kk-saved-check">✓</span>
          )}
        </button>

        <button
  type="button"
  className="kk-saved-location-delete"
  onClick={() => {
    setSavedLocations([]);

    if (savedLocationsKey) {
      localStorage.removeItem(savedLocationsKey);
    }

    if (onLocationSelected) {
      onLocationSelected({
        address: "",
        latitude: null,
        longitude: null,
      });
    }

    setLocationSearch("");
  }}
  aria-label="Delete saved address"
>
  🗑️
</button>
      </div>
    ))
  ) : customerProfile?.address ? (
    <div className="kk-saved-location">
      <button
        type="button"
        className="kk-saved-location-main"
        onClick={() => {
  if (onLocationSelected && customerProfile?.address) {
    onLocationSelected({
      address: customerProfile.address,
      latitude: customerProfile.latitude,
      longitude: customerProfile.longitude,
    });
  }

  setLocationSearch(customerProfile.address || "");
  setShowLocationSheet(false);
}}
      >
        <span className="kk-saved-location-icon">
          {renderMapPin()}
        </span>

        <span>
          <strong>Current address</strong>
          <small>{customerProfile.address}</small>
        </span>

        <span className="kk-saved-check">✓</span>
      </button>

      <button
  type="button"
  className="kk-saved-location-delete"
  onClick={() => {
    setSavedLocations([]);
    localStorage.removeItem("kk-saved-locations");

    if (onLocationSelected) {
      onLocationSelected({
        address: "",
        latitude: null,
        longitude: null,
      });
    }

    setLocationSearch("");
  }}
  aria-label="Delete saved address"
>
  🗑️
</button> 
</div>
  ) : ( 
    <div className="kk-no-location"> 
      No saved addresses yet 
    </div> 
  )} 
</div>
          <div className="kk-location-group">
            <div className="kk-location-group-title">
              RECENT LOCATIONS
            </div>

            {customerProfile?.address ? (
              <button
                type="button"
                className="kk-saved-location recent"
                onClick={() => {
  if (onLocationSelected && customerProfile?.address) {
    onLocationSelected({
      address: customerProfile.address,
      latitude: customerProfile.latitude,
      longitude: customerProfile.longitude,
    });
  }

  setLocationSearch(customerProfile.address || "");
  setShowLocationSheet(false);
}}
              >
                <span className="kk-saved-location-icon">◷</span>

                <span>
                  <strong>Recent location</strong>
                  <small>{customerProfile.address}</small>
                </span>
              </button>
            ) : (
              <div className="kk-no-location">
                Your recent locations will appear here
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderHome = () => (
    <>
      <header className="kk-mobile-header">
        <button
          type="button"
          className="kk-location"
          onClick={handleLocation}
        >
          <div className="kk-location-icon">
            {renderMapPin()}
          </div>

          <div>
            <span className="kk-small-label">DELIVER TO</span>

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
          <span className="kk-search-icon">
            {renderSearchIcon()}
          </span>

          <input
            type="text"
            placeholder="Search for biryani, pulav..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
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
            &amp; Pulavs
          </h2>

          <p>Freshly prepared. Rich in flavour.</p>

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

            <p>Try another search or category.</p>
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
            <span className="kk-cart-count">{cartCount}</span>

            <span>
              {cartCount === 1 ? "item" : "items"} added
            </span>
          </div>

          <strong>View Cart →</strong>
        </button>
      )}
    </>
  );

  const renderOrders = () => (
  <div className="kk-mobile-page">
    <header className="kk-mobile-inner-header">
      <div>
        <span className="kk-small-label">MY ACCOUNT</span>
        <h2>My Orders</h2>
      </div>

      <button
        type="button"
        className="kk-profile-button"
        onClick={customerUser ? onProfile : onLogin}
      >
        👤
      </button>
    </header>

    <section className="kk-menu-section">
      {!customerUser ? (
        <div className="kk-empty-menu">
          <div>👤</div>
          <h3>Login to view orders</h3>
          <p>
            Sign in to see your KshatriyaS Kitchen
            order history.
          </p>

          <button
            type="button"
            className="kk-primary-button"
            onClick={onLogin}
          >
            Login / Register
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="kk-empty-menu">
          <div>📦</div>
          <h3>No orders yet</h3>
          <p>
            Your KshatriyaS Kitchen orders will
            appear here after you place an order.
          </p>
        </div>
      ) : (
        <div className="kk-mobile-orders-list">
          {orders.map((order) => {
            const orderDate = order.createdAt
              ? new Date(order.createdAt)
              : null;

            return (
              <article
                className="kk-mobile-order-card"
                key={order.id}
              >
                <div className="kk-mobile-order-top">
                  <div>
                    <span className="kk-small-label">
                      ORDER ID
                    </span>

                    <h3>{order.id}</h3>
                  </div>

                  <span
                    className={`kk-mobile-order-status ${
                      order.status === "Delivered"
                        ? "delivered"
                        : order.status === "Cancelled"
                          ? "cancelled"
                          : ""
                    }`}
                  >
                    {order.status || "Received"}
                  </span>
                </div>

                {orderDate &&
                  !Number.isNaN(orderDate.getTime()) && (
                    <p className="kk-mobile-order-date">
                      {orderDate.toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}

                <div className="kk-mobile-order-items">
                  {(order.items || []).map((item) => (
                    <div
                      className="kk-mobile-order-item"
                      key={item.id}
                    >
                      <span>
                        {item.name} × {item.quantity}
                      </span>

                      <strong>
                        ₹
                        {Number(
                          item.price * item.quantity
                        ).toFixed(0)}
                      </strong>
                    </div>
                  ))}
                </div>

                <div className="kk-mobile-order-divider" />

                <div className="kk-mobile-order-info">
                  <span>Payment</span>

                  <strong>
                    {order.payment?.method || "-"}
                  </strong>
                </div>

                {order.payment?.status && (
                  <div className="kk-mobile-order-info">
                    <span>Payment status</span>

                    <strong>
                      {order.payment.status}
                    </strong>
                  </div>
                )}

                <div className="kk-mobile-order-total">
                  <span>Total</span>

                  <strong>
                    ₹{Number(order.total || 0).toFixed(0)}
                  </strong>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  </div>
);

  const renderAccount = () => (
    <div className="kk-mobile-page">
      <header className="kk-mobile-inner-header">
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

      <section className="kk-profile-section">
        <div className="kk-profile-card">
          <div className="kk-profile-avatar">👤</div>

          <div className="kk-profile-main">
            <h3>
              {customerProfile?.name ||
                customerUser?.email ||
                "My Profile"}
            </h3>

            {customerProfile?.phone && (
              <p>{customerProfile.phone}</p>
            )}

            {customerUser?.email && (
              <p>{customerUser.email}</p>
            )}
          </div>
        </div>

        <div className="kk-profile-options">
  <button
    type="button"
    className="kk-profile-option"
    onClick={onEditProfile}
  >
    <span className="kk-profile-option-icon">✏️</span>

    <span>
      <strong>Edit Profile</strong>
      <small>Update your personal details</small>
    </span>

    <b>›</b>
  </button>

  <button
    type="button"
    className="kk-profile-option"
    onClick={handleLocation}
  >
    <span className="kk-profile-option-icon">
      {renderMapPin()}
    </span>

    <span>
      <strong>Delivery Location</strong>
      <small>
        {customerProfile?.address ||
          "Select your delivery location"}
      </small>
    </span>

    <b>›</b>
  </button>

  <button
    type="button"
    className="kk-profile-option"
    onClick={onOrders}
  >
  <span className="kk-profile-option-icon">▣</span>

  <span>
    <strong>My Orders</strong>
    <small>View your previous orders</small>
  </span>

  <b>›</b>
</button>

<button
  type="button"
  className="kk-profile-option kk-theme-option"
  onClick={toggleTheme}
>
  <span className="kk-profile-option-icon">
    {theme === "dark" ? "🌙" : "☀️"}
  </span>

  <span>
    <strong>Appearance</strong>
    <small>
      {theme === "dark"
        ? "Dark theme"
        : "Light theme"}
    </small>
  </span>

  <span
    className={`kk-theme-switch ${
      theme === "dark" ? "active" : ""
    }`}
  >
    <span className="kk-theme-switch-knob" />
  </span>
</button>

<button
  type="button"
  className="kk-profile-option logout"
  onClick={onLogout}
>
            <span className="kk-profile-option-icon">↪</span>

            <span>
              <strong>Logout</strong>
              <small>Sign out of your account</small>
            </span>

            <b>›</b>
          </button>
        </div>
      </section>
    </div>
  );

  let pageContent;

  if (mobilePage === "orders") {
    pageContent = renderOrders();
  } else if (mobilePage === "account") {
    pageContent = renderAccount();
   } else {
    pageContent = renderHome();
  }

  if (showIntro) {
    return <LogoIntro />;
  }

  return (
  <div
    className={`kk-mobile-app ${
      theme === "dark" ? "kk-dark-theme" : "kk-light-theme"
    }`}
  >
      <main
        key={mobilePage}
        className="kk-mobile-page-transition"
      >
        {pageContent}
      </main>

      {renderNav()}

      {renderLocationSheet()}
    </div>
   );
}

