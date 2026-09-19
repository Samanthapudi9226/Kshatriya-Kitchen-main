import { useEffect, useMemo, useRef, useState } from 'react';
import MobileApp from './MobileApp';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { restaurantDefaults, supabase } from './config';
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
  X,
} from 'lucide-react';
import { initialMenu } from './data';

import { createUpiPayment, isValidTransactionId, readQrFile } from './upi';

const money = (value) => `₹${Number(value || 0).toFixed(0)}`;
const KITCHEN_LOCATION = {
  latitude: 14.923638,
  longitude: 79.988963,
};

function calculateDeliveryCharge(distanceKm) {
  const distance = Number(distanceKm || 0);

  if (distance <= 3) {
    return 0;
  }

  const additionalKm = Math.ceil(distance - 3);

  return 30 + Math.max(0, additionalKm - 1) * 10;
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
    .from('menu_items')
    .select('id, item')
    .order('id');

  if (error) {
    console.error('Could not load menu from Supabase:', error);
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
    .from('restaurant_settings')
    .select('settings')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error('Could not load restaurant settings from Supabase:', error);
    return null;
  }

  if (!data || !data.settings) {
    return null;
  }

  return {
    ...restaurantDefaults,
    ...data.settings,
  };
}

async function saveSettingsToSupabase(nextSettings) {
  if (!supabase) {
    return false;
  }

  const { error } = await supabase
    .from('restaurant_settings')
    .update({
      settings: nextSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  if (error) {
    console.error('Could not save restaurant settings to Supabase:', error);
    return false;
  }

  return true;
}

async function loadCustomerProfile(userId) {
  if (!supabase || !userId) {
    return null;
  }

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Could not load customer profile:', error);
    return null;
  }

  return data || null;
}

async function saveCustomerProfile(profile) {
  if (!supabase || !profile?.id) {
    return false;
  }

  const { error } = await supabase.from('customers').upsert(
    {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      phone: profile.phone,
      address: profile.address,
      latitude: profile.latitude,
      longitude: profile.longitude,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'id',
    }
  );

  if (error) {
    console.error('Could not save customer profile:', error);
    return false;
  }

  return true;
}
async function loadCustomerOrders(userId) {
  if (!supabase || !userId) {
    return [];
  }

  const { data, error } = await supabase
    .from('orders')
    .select('id, order_data, created_at, updated_at')
    .eq('order_data->>user_id', userId)
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    console.error('Could not load customer orders:', error);
    return [];
  }

  return (data || []).map((row) => ({
    ...(row.order_data || {}),
    id: row.id,
    createdAt: row.order_data?.createdAt || row.created_at,
  }));
}

async function loadRawMaterialsFromSupabase() {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('raw_materials')
    .select('*')
    .order('created_at', {
      ascending: true,
    });

  if (error) {
    console.error('Could not load raw materials:', error);

    return [];
  }

  return data || [];
}

async function loadRawMaterialPurchases() {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('raw_material_purchases')
    .select('*')
    .order('purchase_date', {
      ascending: false,
    })
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    console.error('Could not load raw material purchases:', error);

    return [];
  }

  return data || [];
}

async function saveMenuToSupabase(menuItems) {
  if (!supabase) {
    return;
  }

  const rows = menuItems.map((item) => ({
    id: String(item.id),
    item,
  }));

  const { error: deleteError } = await supabase
    .from('menu_items')
    .delete()
    .neq('id', '');

  if (deleteError) {
    console.error('Could not clear menu in Supabase:', deleteError);
    return;
  }

  const { error: insertError } = await supabase.from('menu_items').insert(rows);

  if (insertError) {
    console.error('Could not save menu to Supabase:', insertError);
    return;
  }

  console.log('Menu saved to Supabase.');
}

function App() {
  const isAdminPath = window.location.pathname === '/admin';

  const [menu, setMenu] = useStoredState('kk-menu', initialMenu);
  const [settings, setSettings] = useStoredState(
    'kk-settings',
    restaurantDefaults
  );
  const [cart, setCart] = useStoredState('kk-cart', []);
  const [orders, setOrders] = useStoredState('kk-orders', []);
  const [page, setPage] = useState(() => {
    const path = window.location.pathname;

    if (path === '/menu') {
      return 'menu';
    }

    if (path === '/account') {
      return 'account';
    }

    return 'home';
  });
  const [mobilePage, setMobilePage] = useState('home');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [deliveryDistance, setDeliveryDistance] = useState(0);
  const [deliveryDistanceLoading, setDeliveryDistanceLoading] = useState(false);
  const [customerUser, setCustomerUser] = useState(null);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [profileSetupMode, setProfileSetupMode] = useState('edit');

  useEffect(() => {
    let cancelled = false;

    async function loadMenu() {
      const remoteMenu = await loadMenuFromSupabase();

      if (!cancelled && remoteMenu) {
        setMenu(remoteMenu);
      }
    }

    loadMenu();

    if (!supabase) {
      return () => {
        cancelled = true;
      };
    }

    const menuChannel = supabase
      .channel('menu-items-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_items',
        },
        async () => {
          const remoteMenu = await loadMenuFromSupabase();

          if (!cancelled && remoteMenu) {
            setMenu(remoteMenu);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;

      supabase.removeChannel(menuChannel);
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
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

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

      const remoteOrders = await loadCustomerOrders(customerUser.id);

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
    let settingsChannel = null;

    async function loadSettings() {
      const remoteSettings = await loadSettingsFromSupabase();

      if (!cancelled && remoteSettings) {
        setSettings(remoteSettings);
      }
    }

    loadSettings();

    if (supabase) {
      settingsChannel = supabase
        .channel('restaurant-settings-realtime')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'restaurant_settings',
            filter: 'id=eq.1',
          },
          async () => {
            const remoteSettings = await loadSettingsFromSupabase();

            if (!cancelled && remoteSettings) {
              setSettings(remoteSettings);
            }
          }
        )
        .subscribe();
    }

    return () => {
      cancelled = true;

      if (supabase && settingsChannel) {
        supabase.removeChannel(settingsChannel);
      }
    };
  }, []);

  const filteredMenu = useMemo(
    () =>
      menu.filter((item) => category === 'All' || item.category === category),
    [menu, category]
  );

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  /*
   * Returns the current selling price.
   *
   * Late Night Offers OFF:
   * normal price.
   *
   * Late Night Offers ON + valid offer:
   * late night price.
   */
  function getEffectivePrice(item) {
    const normalPrice = Number(item?.price || 0);

    const lateNightPrice = Number(item?.lateNightPrice || 0);

    if (
      settings.lateNightOffersEnabled &&
      lateNightPrice > 0 &&
      lateNightPrice < normalPrice
    ) {
      return lateNightPrice;
    }

    return normalPrice;
  }

  const subtotal = cart.reduce((total, item) => {
    const normalPrice = Number(item.normalPrice ?? item.price ?? 0);

    const lateNightPrice = Number(item.lateNightPrice || 0);

    const effectivePrice =
      settings.lateNightOffersEnabled === true &&
      lateNightPrice > 0 &&
      lateNightPrice < normalPrice
        ? lateNightPrice
        : normalPrice;

    return total + effectivePrice * Number(item.quantity || 0);
  }, 0);

  const delivery = subtotal > 0 ? calculateDeliveryCharge(deliveryDistance) : 0;

  const service = subtotal > 0 ? Number(settings.serviceCharge || 0) : 0;

  const tax = subtotal * (Number(settings.tax || 0) / 100);

  const total = subtotal + delivery + service + tax;
  useEffect(() => {
    let cancelled = false;

    async function calculateRoadDistance() {
      const latitude = Number(customerProfile?.latitude);
      const longitude = Number(customerProfile?.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setDeliveryDistance(0);
        return;
      }

      setDeliveryDistanceLoading(true);

      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${KITCHEN_LOCATION.longitude},${KITCHEN_LOCATION.latitude};` +
          `${longitude},${latitude}` +
          `?overview=false`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Could not calculate delivery distance.');
        }

        const data = await response.json();

        const meters = data?.routes?.[0]?.distance;

        if (!Number.isFinite(meters)) {
          throw new Error('Delivery route was not found.');
        }

        const distanceKm = meters / 1000;

        if (!cancelled) {
          setDeliveryDistance(Number(distanceKm.toFixed(2)));
        }
      } catch (error) {
        console.error('Could not calculate delivery distance:', error);

        if (!cancelled) {
          setDeliveryDistance(0);
        }
      } finally {
        if (!cancelled) {
          setDeliveryDistanceLoading(false);
        }
      }
    }

    calculateRoadDistance();

    return () => {
      cancelled = true;
    };
  }, [customerProfile?.latitude, customerProfile?.longitude]);

  function addToCart(item) {
    setCart((current) => {
      const found = current.find((cartItem) => cartItem.id === item.id);

      if (found) {
        return current.map((cartItem) =>
          cartItem.id === item.id
            ? {
                ...cartItem,
                quantity: cartItem.quantity + 1,
              }
            : cartItem
        );
      }

      const normalPrice = Number(item.price || 0);

      const lateNightPrice = Number(item.lateNightPrice || 0);

      const offerApplied =
        settings.lateNightOffersEnabled === true &&
        lateNightPrice > 0 &&
        lateNightPrice < normalPrice;

      return [
        ...current,
        {
          ...item,

          normalPrice,

          price: offerApplied ? lateNightPrice : normalPrice,

          lateNightOfferApplied: offerApplied,

          quantity: 1,
        },
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
                quantity: item.quantity + amount,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  async function handleNativeLocation() {
    if (!customerUser?.id) {
      alert('Please login first to save your delivery location.');
      return;
    }

    try {
      const permissions = await Geolocation.checkPermissions();

      if (permissions.location !== 'granted') {
        const requested = await Geolocation.requestPermissions();

        if (requested.location !== 'granted') {
          alert('Please allow location access for Kshatriya Kitchen.');
          return;
        }
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      const currentProfile = customerProfile || {
        id: customerUser.id,
        email: customerUser.email || '',
        name: '',
        phone: '',
        address: '',
      };

      const updatedProfile = {
        ...currentProfile,
        id: customerUser.id,
        email: currentProfile.email || customerUser.email || '',
        latitude,
        longitude,
      };

      const success = await saveCustomerProfile(updatedProfile);

      if (!success) {
        alert('Location was detected, but could not be saved.');
        return;
      }

      setCustomerProfile(updatedProfile);

      alert('Your current location has been saved.');
    } catch (error) {
      console.error('Could not get current location:', error);

      alert(
        `Location error: ${error?.message || error?.code || 'Unknown error'}`
      );
    }
  }

  function startCheckout() {
    if (!cart.length) {
      alert('Your cart is empty.');
      return;
    }

    if (!customerUser) {
      setShowLoginPopup(true);
      return;
    }

    if (
      !customerProfile ||
      !customerProfile.name ||
      !customerProfile.phone ||
      !customerProfile.address ||
      !Number.isFinite(Number(customerProfile.latitude)) ||
      !Number.isFinite(Number(customerProfile.longitude))
    ) {
      setShowProfileSetup(true);
      return;
    }

    if (Capacitor.isNativePlatform()) {
      setMobilePage('checkout');
    } else {
      setPage('checkout');
    }

    setCartOpen(false);
  }

  async function placeOrder(customer, payment = null) {
    const finalOrderItems = cart.map((item) => {
      const normalPrice = Number(item.normalPrice ?? item.price ?? 0);

      const lateNightPrice = Number(item.lateNightPrice || 0);

      const offerApplied =
        settings.lateNightOffersEnabled === true &&
        lateNightPrice > 0 &&
        lateNightPrice < normalPrice;

      return {
        ...item,

        normalPrice,

        price: offerApplied ? lateNightPrice : normalPrice,

        lateNightOfferApplied: offerApplied,
      };
    });

    const order = {
      id: `KK-${Date.now().toString().slice(-6)}`,
      user_id: customerUser?.id || null,
      customer,
      items: finalOrderItems,
      subtotal,
      deliveryDistance,
      deliveryCharge: delivery,
      serviceCharge: service,
      tax,
      total,
      payment,
      status: 'Received',
      createdAt: new Date().toISOString(),
    };

    setOrders((current) => [order, ...current]);

    setCustomerOrders((current) => [order, ...current]);

    if (supabase && customerUser?.id) {
      const { error } = await supabase.from('orders').insert({
        id: order.id,
        order_data: order,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Could not save order to Supabase:', error);
      }
    }

    setCart([]);

    if (Capacitor.isNativePlatform()) {
      setMobilePage('orders');
    } else {
      setPage('confirmation');
    }

    sendWhatsApp(order);
  }

  function sendWhatsApp(order) {
    const configured = String(settings.whatsapp || '').replace(/\D/g, '');

    const phone = configured || '';

    const lines = [`*${settings.name} Order*`, `Order ID: ${order.id}`, ''];

    order.items.forEach((item) => {
      lines.push(
        `${item.name} × ${item.quantity} - ${money(item.price * item.quantity)}`
      );
    });

    lines.push('');
    lines.push(`Subtotal: ${money(order.subtotal)}`);
    lines.push(
      `Delivery Distance: ${Number(order.deliveryDistance || 0).toFixed(1)} km`
    );
    lines.push(`Delivery Charge: ${money(order.deliveryCharge)}`);
    lines.push(`*Total: ${money(order.total)}*`);
    lines.push('');

    if (order.payment?.method === 'UPI') {
      lines.push('*Payment Details*');
      lines.push(`Payment Method: UPI`);
      lines.push(`UPI ID: ${order.payment.upiId || '-'}`);
      lines.push(`Transaction ID: ${order.payment.transactionId || '-'}`);
      lines.push(`Payment Status: ${order.payment.status || 'Submitted'}`);
    }

    if (order.payment?.method === 'Cash on Delivery') {
      lines.push('*Payment Details*');
      lines.push('Payment Method: Cash on Delivery');
      lines.push(
        `Payment Status: ${order.payment.status || 'Pay on Delivery'}`
      );
    }

    lines.push('');
    lines.push(`Customer: ${order.customer.name}`);
    lines.push(`Phone: ${order.customer.phone}`);
    lines.push(`Address: ${order.customer.address}`);

    if (order.customer.notes) {
      lines.push(`Notes: ${order.customer.notes}`);
    }

    const message = lines.join('\n');

    if (!phone) {
      alert('WhatsApp number is not configured.');
      return;
    }

    const url = `https://wa.me/${phone}?text=` + encodeURIComponent(message);

    window.open(url, '_blank');
  }
  function sendCustomerStatusWhatsApp(order, newStatus) {
    const customerPhone = String(order?.customer?.phone || '').replace(
      /\D/g,
      ''
    );

    if (!customerPhone) {
      alert('Customer WhatsApp number is not available.');
      return;
    }

    let statusMessage = '';

    switch (newStatus) {
      case 'Received':
        statusMessage =
          `Hello ${order.customer.name},\n\n` +
          `Your Kshatriya Kitchen order *${order.id}* has been received successfully. ✅\n\n` +
          `Total: *${money(order.total)}*\n\n` +
          `We will start preparing your order shortly.\n\n` +
          `Thank you for ordering from Kshatriya Kitchen!`;
        break;

      case 'Order is being prepared':
        statusMessage =
          `Hello ${order.customer.name},\n\n` +
          `Your Kshatriya Kitchen order *${order.id}* is now being prepared. 👨‍🍳\n\n` +
          `Total: *${money(order.total)}*\n\n` +
          `We will update you once your order is ready.`;
        break;

      case 'Order is packing':
        statusMessage =
          `Hello ${order.customer.name},\n\n` +
          `Your Kshatriya Kitchen order *${order.id}* is now being packed. 📦\n\n` +
          `Your order will be dispatched shortly.`;
        break;

      case 'Order is in transit':
        statusMessage =
          `Hello ${order.customer.name},\n\n` +
          `Your Kshatriya Kitchen order *${order.id}* is now in transit. 🛵\n\n` +
          `Your order is on the way to you.\n\n` +
          `Please keep your phone available for delivery.`;
        break;

      case 'Delivered':
        statusMessage =
          `Hello ${order.customer.name},\n\n` +
          `Your Kshatriya Kitchen order *${order.id}* has been delivered successfully. ❤️\n\n` +
          `Thank you for ordering with Kshatriya Kitchen!\n\n` +
          `We hope you enjoyed your meal.`;
        break;

      case 'Cancelled':
        statusMessage =
          `Hello ${order.customer.name},\n\n` +
          `Your Kshatriya Kitchen order *${order.id}* has been cancelled.\n\n` +
          `If you have any questions, please contact us.`;
        break;

      default:
        statusMessage =
          `Hello ${order.customer.name},\n\n` +
          `Your Kshatriya Kitchen order *${order.id}* status has been updated to:\n\n` +
          `*${newStatus}*`;
    }

    const url =
      `https://wa.me/${customerPhone}?text=` +
      encodeURIComponent(statusMessage);

    window.open(url, '_blank');
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
        sendCustomerStatusWhatsApp={sendCustomerStatusWhatsApp}
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
        sendCustomerStatusWhatsApp={sendCustomerStatusWhatsApp}
        exit={() => {
          window.location.href = '/';
        }}
      />
    );
  }
  if (showProfileSetup) {
    return (
      <CustomerProfileSetup
        user={customerUser}
        existingProfile={
          profileSetupMode === 'add-address' ? null : customerProfile
        }
        mode={profileSetupMode}
        onCancel={() => {
          setShowProfileSetup(false);
          setProfileSetupMode('edit');

          if (Capacitor.isNativePlatform()) {
            setMobilePage('home');
          } else {
            setPage('home');
          }
        }}
        onSaved={(profile) => {
          if (profileSetupMode === 'add-address') {
            const updatedProfile = {
              ...(customerProfile || {}),
              ...profile,
              id: customerUser?.id,
              email: customerProfile?.email || customerUser?.email || '',
            };

            setCustomerProfile(updatedProfile);
          } else {
            setCustomerProfile(profile);
          }

          setShowProfileSetup(false);
          setProfileSetupMode('edit');

          if (cart.length > 0) {
            setPage('checkout');
          } else {
            setPage('account');
          }
        }}
      />
    );
  }
  const isNativeApp = Capacitor.isNativePlatform();

  if (isNativeApp) {
    return (
      <>
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
                !profile.address ||
                !Number.isFinite(Number(profile.latitude)) ||
                !Number.isFinite(Number(profile.longitude))
              ) {
                setShowProfileSetup(true);
              } else {
                setMobilePage('account');
              }
            }}
          />
        ) : null}

        {mobilePage === 'checkout' ? (
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
            deliveryDistanceLoading={deliveryDistanceLoading}
            placeOrder={placeOrder}
            back={() => setMobilePage('home')}
          />
        ) : (
          <MobileApp
            menu={menu}
            settings={settings}
            cart={cart}
            orders={customerOrders}
            customerUser={customerUser}
            customerProfile={customerProfile}
            mobilePage={mobilePage}
            onAddToCart={addToCart}
            onCart={() => {
              setCartOpen(true);
            }}
            onOrders={() => {
              setCartOpen(false);
              setMobilePage('orders');
            }}
            onProfile={() => {
              setCartOpen(false);
              setMobilePage('account');
            }}
            onLogin={() => {
              setCartOpen(false);
              setShowLoginPopup(true);
            }}
            onHome={() => {
              setCartOpen(false);
              setMobilePage('home');
            }}
            onEditProfile={() => {
              setProfileSetupMode('edit');
              setShowProfileSetup(true);
            }}
            onAddAddress={() => {
              setProfileSetupMode('add-address');
              setShowProfileSetup(true);
            }}
            onLocationSelected={async (location) => {
              if (!customerUser?.id) {
                alert('Please login first to save your delivery location.');
                return;
              }

              const currentProfile = customerProfile || {
                id: customerUser.id,
                email: customerUser.email || '',
                name: '',
                phone: '',
                address: '',
              };

              const updatedProfile = {
                ...currentProfile,
                id: customerUser.id,
                email: currentProfile.email || customerUser.email || '',
                address: location.address,
                latitude: location.latitude,
                longitude: location.longitude,
              };

              const success = await saveCustomerProfile(updatedProfile);

              if (!success) {
                alert('Location could not be saved.');
                return;
              }

              setCustomerProfile(updatedProfile);
            }}
            onLocation={handleNativeLocation}
            onLogout={async () => {
              await supabase.auth.signOut();

              setCustomerUser(null);
              setCustomerProfile(null);
              setCustomerOrders([]);
              setShowProfileSetup(false);

              setCart([]);
              localStorage.removeItem('kk-cart');
              setCartOpen(false);

              setMobilePage('home');
            }}
          />
        )}

        {cartOpen && (
          <CartDrawer
            cart={cart}
            total={total}
            settings={settings}
            changeQuantity={changeQuantity}
            close={() => setCartOpen(false)}
            checkout={startCheckout}
          />
        )}
      </>
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
              !profile.address ||
              !Number.isFinite(Number(profile.latitude)) ||
              !Number.isFinite(Number(profile.longitude))
            ) {
              setShowProfileSetup(true);
            } else {
              setPage('account');
            }
          }}
        />
      ) : null}

      <header className="topbar">
        <button
          className="brand"
          onClick={() => {
            setPage('home');
            setMobileMenuOpen(false);
          }}
        >
          <span className="brand-mark brand-signature-mark">S</span>

          <span className="brand-text">
            <strong>
              Kshatriya<span className="brand-signature-s">S</span> Kitchen
            </strong>

            <small>Signature of Samanthapudi</small>
          </span>
        </button>

        {/* Desktop Navigation */}
        <nav className="desktop-nav">
          <button onClick={() => (window.location.href = '/')}>Home</button>
          <button onClick={() => (window.location.href = '/menu')}>Menu</button>
          <button onClick={() => (window.location.href = '/admin')}>
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
              onClick={() => (window.location.href = '/account')}
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
            className={`cart-button ${
              cartCount > 0 ? 'has-items' : 'is-empty'
            }`}
            onClick={() => setCartOpen(true)}
            aria-label={
              cartCount > 0
                ? `Cart with ${cartCount} item${cartCount === 1 ? '' : 's'}`
                : 'Cart is empty'
            }
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
                window.location.href = '/';
              }}
            >
              Home
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                window.location.href = '/menu';
              }}
            >
              Menu
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                window.location.href = '/admin';
              }}
            >
              Admin
            </button>

            {customerUser ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  window.location.href = '/account';
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
        {page === 'home' && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <p className="eyebrow">THE ROYAL TABLE</p>

                <h1>
                  Food with a legacy.
                  <br />
                  <em>Flavour with a soul.</em>
                </h1>

                <p>
                  Experience rich Indian recipes, aromatic rice and hearty
                  curries prepared with the warmth of a royal kitchen.
                </p>

                <button className="gold-button" onClick={() => setPage('menu')}>
                  Explore the menu
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="hero-art">
                <div className="hero-ring" />

                <div
                  className="hero-image-slider"
                  style={{
                    '--hero-animation-duration': `${
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
                        alt={item.item || 'Kshatriya Kitchen food'}
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
              <p className="eyebrow">FROM OUR KITCHEN</p>

              <h2>
                Made for moments
                <br />
                worth remembering
              </h2>

              <p className="intro-text">
                Every dish is prepared to bring people together. Browse our menu
                and order directly through WhatsApp.
              </p>

              <button
                className="outline-button"
                onClick={() => setPage('menu')}
              >
                View all dishes
              </button>
            </section>
          </>
        )}

        {page === 'menu' && (
          <section className="menu-page">
            <div className="page-heading">
              <p className="eyebrow">OUR MENU</p>

              <h1>Royal favourites</h1>

              <p>Traditional recipes with a Kshatriya Kitchen signature.</p>
            </div>

            <div className="categories">
              {['All', 'Biryani', 'Rice Meals'].map((item) => (
                <button
                  key={item}
                  className={category === item ? 'active' : ''}
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
                  settings={settings}
                  addToCart={addToCart}
                  view={() => setSelected(item)}
                />
              ))}
            </div>
          </section>
        )}

        {page === 'checkout' && (
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
            deliveryDistanceLoading={deliveryDistanceLoading}
            placeOrder={placeOrder}
            back={() => setPage('menu')}
          />
        )}
        {page === 'account' && (
          <CustomerAccount
            user={customerUser}
            profile={customerProfile}
            orders={customerOrders}
            onBack={() => setPage('home')}
            onEditProfile={() => {
              setProfileSetupMode('edit');
              setShowProfileSetup(true);
            }}
            onLogout={() => {
              setCustomerUser(null);
              setCustomerProfile(null);
              setCustomerOrders([]);
              setShowProfileSetup(false);

              setCart([]);
              setCartOpen(false);

              setPage('home');
              setMobilePage('home');
            }}
          />
        )}

        {page === 'confirmation' && (
          <section className="confirmation">
            <div className="confirmation-icon">
              <Check size={34} />
            </div>

            <p className="eyebrow">ORDER RECEIVED</p>

            <h1>Your order is on its way.</h1>

            <p>
              WhatsApp has opened with your order details. Please send the
              message to confirm your order.
            </p>

            <button className="gold-button" onClick={() => setPage('menu')}>
              Order something else
            </button>
          </section>
        )}
        <section className="contact-section">
          <div className="contact-inner">
            <p className="eyebrow">KSHATRIYAS KITCHEN</p>

            <h2>Visit or connect with us</h2>

            <p className="contact-owner">Owner: {settings.ownerName || '-'}</p>

            <p className="contact-address">{settings.address || '-'}</p>

            <div className="contact-details">
              <p>
                <strong>Phone:</strong> {settings.phone || '-'}
              </p>

              <p>
                <strong>Opening Hours:</strong> {settings.openingHours || '-'}
              </p>
            </div>

            <div className="contact-links">
              {settings.mapsUrl && settings.mapsUrl !== '-' && (
                <a href={settings.mapsUrl} target="_blank" rel="noreferrer">
                  Google Maps
                </a>
              )}

              {settings.instagram && settings.instagram !== '-' && (
                <a href={settings.instagram} target="_blank" rel="noreferrer">
                  Instagram
                </a>
              )}

              {settings.facebook && settings.facebook !== '-' && (
                <a href={settings.facebook} target="_blank" rel="noreferrer">
                  Facebook
                </a>
              )}
            </div>
          </div>
        </section>
      </main>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="detail-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="close-button" onClick={() => setSelected(null)}>
              <X />
            </button>

            <img src={selected.image} alt={selected.name} />

            <div className="detail-content">
              <p className="eyebrow">{selected.category}</p>

              <h2>{selected.name}</h2>

              <p>{selected.description}</p>

              <strong className="price">{money(selected.price)}</strong>

              <button
                className="gold-button full"
                onClick={() => addToCart(selected)}
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

function FoodCard({ item, settings, addToCart, view }) {
  return (
    <article className={`food-card ${item.available ? '' : 'unavailable'}`}>
      <button
        className="image-button"
        onClick={item.available ? view : undefined}
        disabled={!item.available}
      >
        <img src={item.image} alt={item.name} />

        {!item.available && (
          <span className="unavailable-overlay">Unavailable</span>
        )}
      </button>

      <div className="food-card-body">
        <p className="card-category">{item.category}</p>

        <h3>{item.name}</h3>

        <p>{item.description}</p>

        <div className="card-footer">
          <div>
            {settings.lateNightOffersEnabled &&
            Number(item.lateNightPrice || 0) > 0 &&
            Number(item.lateNightPrice || 0) < Number(item.price || 0) ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span
                    style={{
                      textDecoration: 'line-through',
                      opacity: 0.55,
                    }}
                  >
                    {money(item.price)}
                  </span>

                  <strong>{money(item.lateNightPrice)}</strong>
                </div>

                <small
                  style={{
                    display: 'block',
                    marginTop: '4px',
                    fontWeight: 700,
                  }}
                >
                  LATE NIGHT OFFER
                </small>
              </>
            ) : (
              <strong>{money(item.price)}</strong>
            )}
          </div>

          <button
            className="add-button"
            onClick={() => addToCart(item)}
            disabled={!item.available}
          >
            <Plus size={18} />
            {item.available ? 'Add' : 'Unavailable'}
          </button>
        </div>
      </div>
    </article>
  );
}

function CartDrawer({
  cart,
  total,
  settings,
  changeQuantity,
  close,
  checkout,
}) {
  return (
    <div className="drawer-layer" onClick={close}>
      <aside
        className="cart-drawer"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <p className="eyebrow">YOUR ORDER</p>

            <h2>Cart</h2>
          </div>

          <button className="close-button static" onClick={close}>
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
                <div className="cart-item" key={item.id}>
                  <img src={item.image} alt={item.name} />

                  <div className="cart-item-info">
                    <h3>{item.name}</h3>

                    <strong>
                      {money(
                        (settings.lateNightOffersEnabled === true &&
                        Number(item.lateNightPrice || 0) > 0 &&
                        Number(item.lateNightPrice || 0) <
                          Number(item.normalPrice ?? item.price ?? 0)
                          ? Number(item.lateNightPrice)
                          : Number(item.normalPrice ?? item.price ?? 0)) *
                          item.quantity
                      )}
                    </strong>

                    <div className="quantity">
                      <button onClick={() => changeQuantity(item.id, -1)}>
                        <Minus size={14} />
                      </button>

                      <span>{item.quantity}</span>

                      <button onClick={() => changeQuantity(item.id, 1)}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="drawer-total">
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>

            <button className="gold-button full" onClick={checkout}>
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
  deliveryDistanceLoading,
  placeOrder,
  back,
}) {
  const [notes, setNotes] = useState('');

  const [transactionId, setTransactionId] = useState('');

  const [paymentError, setPaymentError] = useState('');

  const [paymentMethod, setPaymentMethod] = useState(
    settings.upiEnabled ? 'UPI' : total <= 400 ? 'COD' : ''
  );

  const codAvailable = total <= 400;

  function submit(event) {
    event.preventDefault();

    if (
      !customer?.name ||
      !customer?.phone ||
      !customer?.address ||
      !Number.isFinite(Number(customer?.latitude)) ||
      !Number.isFinite(Number(customer?.longitude))
    ) {
      if (deliveryDistanceLoading) {
        alert('Please wait while your delivery distance is being calculated.');
        return;
      }

      if (!deliveryDistance || deliveryDistance <= 0) {
        alert(
          'Your delivery distance could not be calculated. Please check your saved location and try again.'
        );
        return;
      }
      alert('Please complete your customer profile before placing an order.');
      return;
    }

    if (!paymentMethod) {
      alert('Please select a payment method.');
      return;
    }

    // ==============================
    // CASH ON DELIVERY
    // ==============================
    if (paymentMethod === 'COD') {
      if (!codAvailable) {
        alert('Cash on Delivery is available only for orders up to ₹400.');
        return;
      }

      const payment = {
        method: 'Cash on Delivery',
        status: 'Pay on Delivery',
        upiId: '',
        transactionId: '',
      };

      placeOrder(
        {
          ...customer,
          notes,
        },
        payment
      );

      return;
    }

    // ==============================
    // UPI PAYMENT
    // ==============================
    if (paymentMethod === 'UPI') {
      if (!settings.upiEnabled) {
        alert('UPI payment is currently unavailable.');
        return;
      }

      if (!settings.upiQr) {
        alert('UPI QR code has not been configured by the restaurant.');
        return;
      }

      if (!isValidTransactionId(transactionId)) {
        setPaymentError('Please enter a valid UPI Transaction ID.');
        return;
      }

      const payment = createUpiPayment({
        transactionId,
        amount: total,
        upiId: settings.upiId,
      });

      placeOrder(
        {
          ...customer,
          notes,
        },
        {
          ...payment,
          method: 'UPI',
        }
      );
    }
  }

  return (
    <section className="checkout-page">
      <button className="back-link" onClick={back}>
        <ArrowLeft size={16} />
        Back to menu
      </button>

      <div className="page-heading compact">
        <p className="eyebrow">CHECKOUT</p>

        <h1>Complete your order</h1>
      </div>

      <div className="checkout-layout">
        <form className="customer-form" onSubmit={submit}>
          <div className="saved-customer-box">
            <p className="eyebrow">DELIVERY DETAILS</p>

            <h2>Delivering to</h2>

            <div className="saved-customer-detail">
              <strong>{customer?.name}</strong>

              <span>{customer?.phone}</span>

              <span>{customer?.address}</span>
            </div>

            <p className="saved-profile-note">
              Your saved account details will be used for this order.
            </p>
          </div>

          <div className="delivery-distance-box">
            <div className="delivery-distance-row">
              <span>Delivery distance</span>

              <strong>
                {deliveryDistanceLoading
                  ? 'Calculating...'
                  : deliveryDistance > 0
                  ? `${deliveryDistance.toFixed(1)} km`
                  : 'Location required'}
              </strong>
            </div>

            <div className="delivery-distance-row">
              <span>Delivery charge</span>

              <strong>
                {deliveryDistanceLoading ? 'Calculating...' : money(delivery)}
              </strong>
            </div>

            <p className="delivery-distance-note">
              Up to 3 km — FREE
              <br />
              After 3 km — ₹30 + ₹10 per additional km
            </p>
          </div>

          <label>
            Order notes <span className="optional">Optional</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Any special instructions?"
            />
          </label>

          {/* =================================
              PAYMENT METHOD
              ================================= */}

          <div className="payment-method-box">
            <p className="eyebrow">PAYMENT</p>

            <h2>Choose payment method</h2>

            {settings.upiEnabled && (
              <label className="payment-option">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="UPI"
                  checked={paymentMethod === 'UPI'}
                  onChange={() => {
                    setPaymentMethod('UPI');
                    setPaymentError('');
                  }}
                />

                <span>
                  <strong>UPI / Online Payment</strong>

                  <small>Pay now using the UPI QR code.</small>
                </span>
              </label>
            )}

            <label
              className={
                codAvailable ? 'payment-option' : 'payment-option disabled'
              }
            >
              <input
                type="radio"
                name="paymentMethod"
                value="COD"
                checked={paymentMethod === 'COD'}
                onChange={() => {
                  if (!codAvailable) {
                    return;
                  }

                  setPaymentMethod('COD');
                  setPaymentError('');
                }}
                disabled={!codAvailable}
              />

              <span>
                <strong>Cash on Delivery</strong>

                <small>
                  {codAvailable
                    ? 'Available for orders up to ₹400.'
                    : 'Not available for orders above ₹400.'}
                </small>
              </span>
            </label>

            {!codAvailable && (
              <div className="payment-pending-note">
                COD is unavailable because your order total is above ₹400.
                Please use online payment.
              </div>
            )}
          </div>

          {/* =================================
              UPI PAYMENT
              ================================= */}

          {paymentMethod === 'UPI' && settings.upiEnabled && (
            <div className="upi-payment-box">
              <p className="eyebrow">SECURE PAYMENT</p>

              <h2>Pay using UPI</h2>

              <p className="upi-instruction">
                Scan the QR code below and complete the payment before
                submitting your order.
              </p>

              {settings.upiQr ? (
                <div className="upi-qr-wrapper">
                  <img
                    src={settings.upiQr}
                    alt="KshatriyaS Kitchen UPI QR Code"
                    className="upi-qr"
                  />
                </div>
              ) : (
                <div className="upi-no-qr">QR code is not configured yet.</div>
              )}

              {settings.upiId && settings.upiId !== 'EDIT_ME' && (
                <div className="upi-id-display">
                  <span>UPI ID</span>

                  <strong>{settings.upiId}</strong>
                </div>
              )}

              <label>
                UPI Transaction ID
                <input
                  value={transactionId}
                  onChange={(event) => {
                    setTransactionId(event.target.value);
                    setPaymentError('');
                  }}
                  placeholder="Enter transaction ID after payment"
                />
              </label>

              {paymentError && <p className="upi-error">{paymentError}</p>}

              <div className="payment-pending-note">
                After completing payment, enter your Transaction ID and
                continue.
              </div>
            </div>
          )}

          {/* =================================
              FINAL ORDER BUTTON
              ================================= */}

          <button className="gold-button full" type="submit">
            {paymentMethod === 'COD'
              ? 'Confirm COD Order'
              : "I've Paid & Place Order"}
          </button>
        </form>

        {/* =================================
            ORDER SUMMARY
            ================================= */}

        <div className="summary-card">
          <h2>Order summary</h2>

          {cart.map((item) => (
            <div className="summary-line" key={item.id}>
              <span>
                {item.name} × {item.quantity}
              </span>

              <strong>
                {money(
                  (settings.lateNightOffersEnabled === true &&
                  Number(item.lateNightPrice || 0) > 0 &&
                  Number(item.lateNightPrice || 0) <
                    Number(item.normalPrice ?? item.price ?? 0)
                    ? Number(item.lateNightPrice)
                    : Number(item.normalPrice ?? item.price ?? 0)) *
                    item.quantity
                )}
              </strong>
            </div>
          ))}

          <hr />

          <div className="summary-line">
            <span>Subtotal</span>

            <strong>{money(subtotal)}</strong>
          </div>

          <div className="summary-line">
            <span>Delivery</span>

            <strong>{money(delivery)}</strong>
          </div>

          <div className="summary-line">
            <span>Service charge</span>

            <strong>{money(service)}</strong>
          </div>

          <div className="summary-line">
            <span>GST / tax</span>

            <strong>{money(tax)}</strong>
          </div>

          <hr />

          <div className="summary-total">
            <span>Total</span>

            <strong>{money(total)}</strong>
          </div>

          <p className="summary-note">
            Payment method:{' '}
            <strong>
              {paymentMethod === 'COD'
                ? 'Cash on Delivery'
                : 'UPI / Online Payment'}
            </strong>
          </p>

          {paymentMethod === 'COD' && (
            <p className="summary-note">
              COD limit: <strong>₹400 maximum</strong>
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
  exit,
  sendCustomerStatusWhatsApp,
}) {
  const adminToday = new Date();

  const todayAdminOrders = orders.filter((order) => {
    if (!order.createdAt) {
      return false;
    }

    const orderDate = new Date(order.createdAt);

    return (
      orderDate.getFullYear() === adminToday.getFullYear() &&
      orderDate.getMonth() === adminToday.getMonth() &&
      orderDate.getDate() === adminToday.getDate()
    );
  });

  const previousAdminOrders = orders.filter((order) => {
    if (!order.createdAt) {
      return true;
    }

    const orderDate = new Date(order.createdAt);

    return !(
      orderDate.getFullYear() === adminToday.getFullYear() &&
      orderDate.getMonth() === adminToday.getMonth() &&
      orderDate.getDate() === adminToday.getDate()
    );
  });

  const groupedAdminOrders = [
    ...todayAdminOrders.map((order) => ({
      ...order,
      adminOrderGroup: 'today',
    })),

    ...previousAdminOrders.map((order) => ({
      ...order,
      adminOrderGroup: 'previous',
    })),
  ];

  const [loggedIn, setLoggedIn] = useState(() => {
    return sessionStorage.getItem('kk-admin-auth') === 'true';
  });

  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [loginLoading, setLoginLoading] = useState(false);

  const [tab, setTab] = useState('dashboard');

  const [soundEnabled, setSoundEnabled] = useState(false);

  /*
   * RAW MATERIAL MANAGEMENT
   */

  const [rawMaterials, setRawMaterials] = useState([]);

  const [rawMaterialPurchases, setRawMaterialPurchases] = useState([]);

  const [rawMaterialName, setRawMaterialName] = useState('');

  const [rawMaterialUnit, setRawMaterialUnit] = useState('kg');

  const [purchaseMaterialId, setPurchaseMaterialId] = useState('');

  const [purchaseQuantity, setPurchaseQuantity] = useState('');

  const [purchasePrice, setPurchasePrice] = useState('');

  const [purchaseDate, setPurchaseDate] = useState(() => {
    const today = new Date();

    const year = today.getFullYear();

    const month = String(today.getMonth() + 1).padStart(2, '0');

    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  });

  const [purchaseSupplier, setPurchaseSupplier] = useState('');

  const knownOrderIdsRef = useRef(new Set());

  const soundEnabledRef = useRef(false);

  /*
   * LOAD RAW MATERIAL INVENTORY
   * AND PURCHASE HISTORY
   */
  useEffect(() => {
    if (!loggedIn || !supabase) {
      return;
    }

    let cancelled = false;

    async function loadRawInventory() {
      const materials = await loadRawMaterialsFromSupabase();

      const purchases = await loadRawMaterialPurchases();

      if (cancelled) {
        return;
      }

      setRawMaterials(materials);

      setRawMaterialPurchases(purchases);
    }

    loadRawInventory();

    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  function playNewOrderSound() {
    try {
      if (!('speechSynthesis' in window)) {
        console.error('Speech synthesis is not supported.');
        return;
      }

      window.speechSynthesis.cancel();

      const message = new SpeechSynthesisUtterance('Fresh order received');

      message.lang = 'en-IN';
      message.rate = 0.9;
      message.pitch = 1;
      message.volume = 1;

      window.speechSynthesis.speak(message);
    } catch (error) {
      console.error('Could not play order notification:', error);
    }
  }

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    if (!supabase || !loggedIn) {
      return;
    }

    let cancelled = false;
    let firstLoad = true;

    async function loadAdminOrders() {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_data, created_at, updated_at')
        .order('created_at', {
          ascending: false,
        });

      if (error) {
        console.error('Could not load admin orders:', error);
        return;
      }

      if (cancelled) {
        return;
      }

      const latestOrders = (data || []).map((row) => ({
        ...(row.order_data || {}),
        id: row.id,
        createdAt: row.order_data?.createdAt || row.created_at,
      }));

      const latestIds = new Set(latestOrders.map((order) => order.id));

      if (firstLoad) {
        knownOrderIdsRef.current = latestIds;

        setOrders(latestOrders);

        firstLoad = false;

        return;
      }

      const newOrders = latestOrders.filter(
        (order) => !knownOrderIdsRef.current.has(order.id)
      );

      setOrders(latestOrders);

      if (newOrders.length > 0 && soundEnabledRef.current) {
        playNewOrderSound();
      }

      knownOrderIdsRef.current = latestIds;
    }

    loadAdminOrders();

    const interval = setInterval(loadAdminOrders, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loggedIn, setOrders]);

  if (!loggedIn) {
    return (
      <div className="admin-login">
        <div className="login-card">
          <span className="brand-mark">KK</span>

          <p className="eyebrow">PRIVATE AREA</p>

          <h1>Admin login</h1>

          <p>Sign in with your authorized administrator account.</p>

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Admin email"
          />

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
          />

          <button
            className="gold-button full"
            onClick={async () => {
              if (!supabase) {
                alert('Supabase is not configured.');
                return;
              }

              if (!email.trim() || !password) {
                alert('Enter your admin email and password.');
                return;
              }

              setLoginLoading(true);

              const { error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
              });

              setLoginLoading(false);

              if (error) {
                alert(error.message);
                return;
              }

              sessionStorage.setItem('kk-admin-auth', 'true');

              setLoggedIn(true);
            }}
          >
            {loginLoading ? 'Signing in...' : 'Enter dashboard'}
          </button>
          <button className="text-button" onClick={exit}>
            Return to store
          </button>
        </div>
      </div>
    );
  }

  /*
   * RAW MATERIALS
   */

  async function refreshRawMaterials() {
    const materials = await loadRawMaterialsFromSupabase();

    const purchases = await loadRawMaterialPurchases();

    setRawMaterials(materials);

    setRawMaterialPurchases(purchases);
  }

  async function addRawMaterial() {
    const name = rawMaterialName.trim();

    if (!name) {
      alert('Please enter raw material name.');

      return;
    }

    if (!supabase) {
      alert('Supabase is not configured.');

      return;
    }

    const material = {
      id: `raw-${Date.now()}`,

      name,

      unit: rawMaterialUnit,

      current_stock: 0,

      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('raw_materials').insert(material);

    if (error) {
      console.error('Could not add raw material:', error);

      alert('Could not add raw material.');

      return;
    }

    setRawMaterialName('');

    setRawMaterialUnit('kg');

    await refreshRawMaterials();
  }

  async function deleteRawMaterial(material) {
    const confirmed = window.confirm(`Delete ${material.name}?`);

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from('raw_materials')
      .delete()
      .eq('id', material.id);

    if (error) {
      console.error('Could not delete raw material:', error);

      alert('Could not delete raw material.');

      return;
    }

    if (purchaseMaterialId === material.id) {
      setPurchaseMaterialId('');
    }

    await refreshRawMaterials();
  }

  async function updateRawMaterialStock(material, value) {
    const safeStock = Math.max(0, Number(value) || 0);

    setRawMaterials((current) =>
      current.map((entry) =>
        entry.id === material.id
          ? {
              ...entry,
              current_stock: safeStock,
            }
          : entry
      )
    );
  }

  async function saveRawMaterialStock(material) {
    const currentMaterial = rawMaterials.find(
      (entry) => entry.id === material.id
    );

    if (!currentMaterial) {
      return;
    }

    const safeStock = Math.max(0, Number(currentMaterial.current_stock) || 0);

    const { error } = await supabase
      .from('raw_materials')
      .update({
        current_stock: safeStock,

        updated_at: new Date().toISOString(),
      })
      .eq('id', material.id);

    if (error) {
      console.error('Could not update raw material stock:', error);

      alert('Could not update stock.');

      return;
    }

    await refreshRawMaterials();
  }

  async function addRawMaterialPurchase() {
    if (!purchaseMaterialId) {
      alert('Please select a raw material.');

      return;
    }

    const material = rawMaterials.find(
      (entry) => entry.id === purchaseMaterialId
    );

    if (!material) {
      alert('Raw material not found.');

      return;
    }

    const quantity = Math.max(0, Number(purchaseQuantity) || 0);

    const pricePerUnit = Math.max(0, Number(purchasePrice) || 0);

    if (quantity <= 0) {
      alert('Please enter purchase quantity.');

      return;
    }

    if (pricePerUnit <= 0) {
      alert('Please enter price per unit.');

      return;
    }

    const totalAmount = quantity * pricePerUnit;

    const purchase = {
      id: `purchase-${Date.now()}`,

      material_id: material.id,

      material_name: material.name,

      quantity,

      unit: material.unit,

      price_per_unit: pricePerUnit,

      total_amount: totalAmount,

      purchase_date: purchaseDate,

      supplier: purchaseSupplier.trim() || null,
    };

    const { error } = await supabase
      .from('raw_material_purchases')
      .insert(purchase);

    if (error) {
      console.error('Could not save purchase:', error);

      alert('Could not save purchase.');

      return;
    }

    /*
     * Purchase is recorded as an expense.
     *
     * Current physical stock is NOT
     * automatically changed.
     *
     * Admin updates actual remaining
     * stock manually.
     */

    setPurchaseQuantity('');

    setPurchasePrice('');

    setPurchaseSupplier('');

    await refreshRawMaterials();
  }

  /*
   * RAW MATERIAL MANAGEMENT
   */

  async function refreshRawMaterials() {
    const materials = await loadRawMaterialsFromSupabase();

    const purchases = await loadRawMaterialPurchases();

    setRawMaterials(materials);

    setRawMaterialPurchases(purchases);
  }

  async function addRawMaterial() {
    const name = rawMaterialName.trim();

    if (!name) {
      alert('Please enter raw material name.');

      return;
    }

    if (!supabase) {
      alert('Supabase is not configured.');

      return;
    }

    const material = {
      id: `raw-${Date.now()}`,

      name,

      unit: rawMaterialUnit,

      current_stock: 0,

      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('raw_materials').insert(material);

    if (error) {
      console.error('Could not add raw material:', error);

      alert('Could not add raw material.');

      return;
    }

    setRawMaterialName('');

    setRawMaterialUnit('kg');

    await refreshRawMaterials();
  }

  async function deleteRawMaterial(material) {
    if (!supabase) {
      return;
    }

    const confirmed = window.confirm(`Delete ${material.name}?`);

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from('raw_materials')
      .delete()
      .eq('id', material.id);

    if (error) {
      console.error('Could not delete raw material:', error);

      alert('Could not delete raw material.');

      return;
    }

    if (purchaseMaterialId === material.id) {
      setPurchaseMaterialId('');
    }

    await refreshRawMaterials();
  }

  function updateRawMaterialStock(material, value) {
    const safeStock = Math.max(0, Number(value) || 0);

    setRawMaterials((current) =>
      current.map((entry) =>
        entry.id === material.id
          ? {
              ...entry,

              current_stock: safeStock,
            }
          : entry
      )
    );
  }

  async function saveRawMaterialStock(material) {
    if (!supabase) {
      return;
    }

    const currentMaterial = rawMaterials.find(
      (entry) => entry.id === material.id
    );

    if (!currentMaterial) {
      return;
    }

    const safeStock = Math.max(0, Number(currentMaterial.current_stock) || 0);

    const { error } = await supabase
      .from('raw_materials')
      .update({
        current_stock: safeStock,

        updated_at: new Date().toISOString(),
      })
      .eq('id', material.id);

    if (error) {
      console.error('Could not update raw material stock:', error);

      alert('Could not update stock.');

      return;
    }

    await refreshRawMaterials();
  }

  async function addRawMaterialPurchase() {
    if (!supabase) {
      alert('Supabase is not configured.');

      return;
    }

    if (!purchaseMaterialId) {
      alert('Please select a raw material.');

      return;
    }

    const material = rawMaterials.find(
      (entry) => entry.id === purchaseMaterialId
    );

    if (!material) {
      alert('Raw material not found.');

      return;
    }

    const quantity = Math.max(0, Number(purchaseQuantity) || 0);

    const pricePerUnit = Math.max(0, Number(purchasePrice) || 0);

    if (quantity <= 0) {
      alert('Please enter purchase quantity.');

      return;
    }

    if (pricePerUnit <= 0) {
      alert('Please enter price per unit.');

      return;
    }

    const totalAmount = quantity * pricePerUnit;

    const purchase = {
      id: `purchase-${Date.now()}`,

      material_id: material.id,

      material_name: material.name,

      quantity,

      unit: material.unit,

      price_per_unit: pricePerUnit,

      total_amount: totalAmount,

      purchase_date: purchaseDate,

      supplier: purchaseSupplier.trim() || null,
    };

    const { error } = await supabase
      .from('raw_material_purchases')
      .insert(purchase);

    if (error) {
      console.error('Could not save purchase:', error);

      alert('Could not save purchase.');

      return;
    }

    /*
     * Purchase is saved as an expense.
     * Physical stock stays manual.
     */

    setPurchaseQuantity('');

    setPurchasePrice('');

    setPurchaseSupplier('');

    await refreshRawMaterials();
  }

  /*
   * EXISTING FINISHED FOOD STOCK
   */

  async function updateStock(id, totalStock) {
    const safeTotal = Math.max(0, Number(totalStock) || 0);

    const updatedMenu = menu.map((item) => {
      if (item.id !== id) {
        return item;
      }

      const soldStock = Math.max(0, Number(item.soldStock) || 0);

      const liveStock = Math.max(0, safeTotal - soldStock);

      return {
        ...item,
        totalStock: safeTotal,
        soldStock,
        available: liveStock > 0,
      };
    });

    setMenu(updatedMenu);

    await saveMenuToSupabase(updatedMenu);
  }

  async function deductDeliveredOrderStock(order) {
    /*
     * If stock was already deducted for this
     * order, never deduct it again.
     */
    if (order.stockDeducted) {
      return order;
    }

    const orderItems = Array.isArray(order.items) ? order.items : [];

    const updatedMenu = menu.map((menuItem) => {
      const orderedItem = orderItems.find(
        (item) => String(item.id) === String(menuItem.id)
      );

      if (!orderedItem) {
        return menuItem;
      }

      const orderedQuantity = Math.max(0, Number(orderedItem.quantity) || 0);

      const totalStock = Math.max(0, Number(menuItem.totalStock) || 0);

      const currentSoldStock = Math.max(0, Number(menuItem.soldStock) || 0);

      const newSoldStock = Math.min(
        totalStock,
        currentSoldStock + orderedQuantity
      );

      const newLiveStock = Math.max(0, totalStock - newSoldStock);

      return {
        ...menuItem,

        soldStock: newSoldStock,

        available: newLiveStock > 0,
      };
    });

    /*
     * Update Stock Management UI.
     */
    setMenu(updatedMenu);

    /*
     * Save updated stock to Supabase.
     */
    await saveMenuToSupabase(updatedMenu);

    /*
     * Mark this order permanently so
     * Delivered cannot deduct stock twice.
     */
    return {
      ...order,

      stockDeducted: true,

      stockDeductedAt: new Date().toISOString(),
    };
  }

  function updateSetting(field, value) {
    setSettings({
      ...settings,
      [field]: value,
    });
  }

  async function uploadUpiQr(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const qrData = await readQrFile(file);

      setSettings({
        ...settings,
        upiQr: qrData,
      });
    } catch (error) {
      alert(error.message);
    }

    event.target.value = '';
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <span className="brand-mark">KK</span>

          <strong>Admin</strong>
        </div>

        <button
          className={tab === 'dashboard' ? 'selected' : ''}
          onClick={() => setTab('dashboard')}
        >
          <Package size={17} />
          Dashboard
        </button>

        <button
          className={tab === 'menu' ? 'selected' : ''}
          onClick={() => setTab('menu')}
        >
          <Utensils size={17} />
          Menu management
        </button>

        <button
          className={tab === 'stock' ? 'selected' : ''}
          onClick={() => setTab('stock')}
        >
          <Package size={17} />
          Stock Management
        </button>

        <button
          className={tab === 'late-night' ? 'selected' : ''}
          onClick={() => setTab('late-night')}
        >
          <Clock3 size={17} />
          Late Night Offers
        </button>

        <button
          className={tab === 'orders' ? 'selected' : ''}
          onClick={() => setTab('orders')}
        >
          <ShoppingBag size={17} />
          Orders
        </button>

        <button
          className={tab === 'settings' ? 'selected' : ''}
          onClick={() => setTab('settings')}
        >
          <Settings size={17} />
          Restaurant settings
        </button>

        <button onClick={exit}>
          <ArrowLeft size={17} />
          Storefront
        </button>

        <button
          onClick={async () => {
            sessionStorage.removeItem('kk-admin-auth');

            if (supabase) {
              await supabase.auth.signOut();
            }

            setLoggedIn(false);
          }}
        >
          Logout
        </button>
      </aside>

      <main className="admin-main">
        {tab === 'dashboard' && (
          <AdminDashboard
            menu={menu}
            orders={orders}
            soundEnabled={soundEnabled}
            setSoundEnabled={setSoundEnabled}
            playNewOrderSound={playNewOrderSound}
          />
        )}

        {tab === 'menu' && (
          <section>
            <div className="admin-heading">
              <div>
                <p className="eyebrow">CATALOGUE</p>

                <h1>Menu management</h1>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                }}
              >
                <button
                  type="button"
                  className="gold-button"
                  onClick={async () => {
                    await saveMenuToSupabase(menu);

                    alert('Menu saved successfully.');
                  }}
                >
                  Save menu
                </button>

                <button
                  type="button"
                  className="gold-button"
                  onClick={() => {
                    const newItem = {
                      id: `item-${Date.now()}`,
                      name: 'New item',
                      description: '',
                      category: 'Biryani',
                      price: 0,
                      image: '',
                      available: true,
                      totalStock: 0,
                      soldStock: 0,
                    };

                    setMenu((currentMenu) => [...currentMenu, newItem]);
                  }}
                >
                  Add item
                </button>
              </div>
            </div>

            <div className="admin-menu-list">
              {menu.map((item) => (
                <div className="admin-menu-item" key={item.id}>
                  <img src={item.image} alt={item.name} />

                  <div className="admin-menu-fields">
                    <label>
                      Item name
                      <input
                        value={item.name}
                        onChange={(event) => {
                          setMenu((currentMenu) =>
                            currentMenu.map((menuItem) =>
                              menuItem.id === item.id
                                ? {
                                    ...menuItem,
                                    name: event.target.value,
                                  }
                                : menuItem
                            )
                          );
                        }}
                      />
                    </label>

                    <label>
                      Category
                      <input
                        value={item.category}
                        onChange={(event) => {
                          setMenu((currentMenu) =>
                            currentMenu.map((menuItem) =>
                              menuItem.id === item.id
                                ? {
                                    ...menuItem,
                                    category: event.target.value,
                                  }
                                : menuItem
                            )
                          );
                        }}
                      />
                    </label>

                    <label>
                      Price
                      <input
                        type="number"
                        min="0"
                        value={item.price}
                        onChange={(event) => {
                          setMenu((currentMenu) =>
                            currentMenu.map((menuItem) =>
                              menuItem.id === item.id
                                ? {
                                    ...menuItem,
                                    price: Number(event.target.value) || 0,
                                  }
                                : menuItem
                            )
                          );
                        }}
                      />
                    </label>

                    <label>
                      Image URL
                      <input
                        value={item.image || ''}
                        onChange={(event) => {
                          setMenu((currentMenu) =>
                            currentMenu.map((menuItem) =>
                              menuItem.id === item.id
                                ? {
                                    ...menuItem,
                                    image: event.target.value,
                                  }
                                : menuItem
                            )
                          );
                        }}
                      />
                    </label>

                    <label>
                      Description
                      <textarea
                        value={item.description || ''}
                        onChange={(event) => {
                          setMenu((currentMenu) =>
                            currentMenu.map((menuItem) =>
                              menuItem.id === item.id
                                ? {
                                    ...menuItem,
                                    description: event.target.value,
                                  }
                                : menuItem
                            )
                          );
                        }}
                      />
                    </label>
                  </div>

                  <div className="admin-menu-actions">
                    <button
                      className={
                        item.available ? 'availability on' : 'availability'
                      }
                      onClick={async () => {
                        const updatedItem = {
                          ...item,
                          available: !item.available,
                        };

                        setMenu((currentMenu) =>
                          currentMenu.map((menuItem) =>
                            menuItem.id === item.id ? updatedItem : menuItem
                          )
                        );

                        if (supabase) {
                          const { error } = await supabase
                            .from('menu_items')
                            .update({
                              item: updatedItem,
                            })
                            .eq('id', String(item.id));

                          if (error) {
                            console.error(
                              'Could not update availability:',
                              error
                            );

                            alert('Availability could not be saved.');
                          }
                        }
                      }}
                    >
                      {item.available ? 'Available' : 'Unavailable'}
                    </button>

                    <button
                      className="danger-button"
                      onClick={async () => {
                        const updatedMenu = menu.filter(
                          (entry) => entry.id !== item.id
                        );

                        setMenu(updatedMenu);

                        await saveMenuToSupabase(updatedMenu);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        {tab === 'late-night' && (
          <section>
            <div className="admin-heading">
              <div>
                <p className="eyebrow">SPECIAL PRICING</p>

                <h1>Late Night Offers</h1>

                <p>
                  Turn late night pricing on or off and set a special price for
                  each menu item.
                </p>
              </div>

              <button
                type="button"
                className="gold-button"
                onClick={async () => {
                  const nextSettings = {
                    ...settings,
                    lateNightOffersEnabled: !settings.lateNightOffersEnabled,
                  };

                  setSettings(nextSettings);

                  const saved = await saveSettingsToSupabase(nextSettings);

                  if (!saved) {
                    alert('Late Night Offer setting could not be saved.');
                  }
                }}
              >
                {settings.lateNightOffersEnabled
                  ? 'Late Night Offers ON'
                  : 'Late Night Offers OFF'}
              </button>
            </div>

            <div className="admin-menu-list">
              {menu.map((item) => (
                <div className="admin-menu-item" key={item.id}>
                  <img src={item.image} alt={item.name} />

                  <div
                    style={{
                      flex: 1,
                    }}
                  >
                    <strong>{item.name}</strong>

                    <p>Normal Price: {money(item.price)}</p>
                  </div>

                  <div
                    style={{
                      minWidth: '180px',
                    }}
                  >
                    <label>
                      Late Night Price
                      <input
                        type="number"
                        min="0"
                        value={item.lateNightPrice ?? ''}
                        placeholder="Offer price"
                        onChange={(event) => {
                          const value = event.target.value;

                          setMenu((currentMenu) =>
                            currentMenu.map((menuItem) =>
                              menuItem.id === item.id
                                ? {
                                    ...menuItem,

                                    lateNightPrice:
                                      value === '' ? '' : Number(value),
                                  }
                                : menuItem
                            )
                          );
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: '24px',
              }}
            >
              <button
                type="button"
                className="gold-button"
                onClick={async () => {
                  await saveMenuToSupabase(menu);

                  alert('Late Night Offer prices saved successfully.');
                }}
              >
                Save Offer Prices
              </button>
            </div>
          </section>
        )}

        {tab === 'stock' && (
          <section>
            <div className="admin-heading">
              <div>
                <p className="eyebrow">INVENTORY</p>

                <h1>Stock Management</h1>

                <p>Track total, sold and live stock for every menu item.</p>
              </div>
            </div>

            <div className="stock-summary-grid">
              <div className="stock-summary-card">
                <span>Total Stock</span>

                <strong>
                  {menu.reduce(
                    (total, item) => total + Number(item.totalStock || 0),
                    0
                  )}
                </strong>
              </div>

              <div className="stock-summary-card">
                <span>Sold Stock</span>

                <strong>
                  {menu.reduce(
                    (total, item) => total + Number(item.soldStock || 0),
                    0
                  )}
                </strong>
              </div>

              <div className="stock-summary-card">
                <span>Live Stock</span>

                <strong>
                  {menu.reduce(
                    (total, item) =>
                      total +
                      Math.max(
                        0,
                        Number(item.totalStock || 0) -
                          Number(item.soldStock || 0)
                      ),
                    0
                  )}
                </strong>
              </div>
            </div>

            <div className="stock-list">
              {menu.map((item) => {
                const totalStock = Number(item.totalStock || 0);

                const soldStock = Number(item.soldStock || 0);

                const liveStock = Math.max(0, totalStock - soldStock);

                return (
                  <div className="stock-item-card" key={item.id}>
                    <div className="stock-item-main">
                      <img src={item.image} alt={item.name} />

                      <div>
                        <h3>{item.name}</h3>

                        <span>{item.category}</span>
                      </div>
                    </div>

                    <label className="stock-field">
                      <span>Total Stock</span>

                      <input
                        type="number"
                        min="0"
                        value={totalStock}
                        onChange={(event) => {
                          const value = event.target.value;

                          setMenu((currentMenu) =>
                            currentMenu.map((menuItem) =>
                              menuItem.id === item.id
                                ? {
                                    ...menuItem,
                                    totalStock: Math.max(0, Number(value) || 0),
                                  }
                                : menuItem
                            )
                          );
                        }}
                      />
                    </label>

                    <div className="stock-number">
                      <span>Sold</span>

                      <strong>{soldStock}</strong>
                    </div>

                    <div className="stock-number live">
                      <span>Live</span>

                      <strong>{liveStock}</strong>
                    </div>

                    <button
                      type="button"
                      className="gold-button"
                      onClick={() => updateStock(item.id, totalStock)}
                    >
                      Update Stock
                    </button>

                    <span
                      className={
                        liveStock > 0
                          ? 'stock-status live'
                          : 'stock-status sold-out'
                      }
                    >
                      {liveStock > 0 ? 'LIVE' : 'SOLD OUT'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {tab === 'orders' && (
          <section>
            <div className="admin-heading">
              <div>
                <p className="eyebrow">FULFILMENT</p>

                <h1>Orders management</h1>
              </div>
            </div>

            <div className="orders-list">
              {orders.length === 0 ? (
                <div className="empty-state">
                  <ShoppingBag size={42} />

                  <p>No orders yet.</p>
                </div>
              ) : (
                groupedAdminOrders.map((order, index) => (
                  <div key={order.id}>
                    {(index === 0 ||
                      groupedAdminOrders[index - 1]?.adminOrderGroup !==
                        order.adminOrderGroup) && (
                      <div
                        style={{
                          marginTop: index === 0 ? '0' : '32px',
                          marginBottom: '14px',
                        }}
                      >
                        <p className="eyebrow">
                          {order.adminOrderGroup === 'today'
                            ? 'TODAY'
                            : 'ORDER HISTORY'}
                        </p>

                        <h2
                          style={{
                            margin: '4px 0 0',
                          }}
                        >
                          {order.adminOrderGroup === 'today'
                            ? `Today's Orders (${todayAdminOrders.length})`
                            : `Previous Orders (${previousAdminOrders.length})`}
                        </h2>
                      </div>
                    )}

                    <div className="order-card">
                      <div>
                        <strong>{order.id}</strong>

                        <p
                          style={{
                            margin: '6px 0',
                            fontSize: '13px',
                            opacity: 0.72,
                          }}
                        >
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleString(
                                'en-IN',
                                {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                }
                              )
                            : 'Date unavailable'}
                        </p>

                        <p>
                          {order.customer.name} · {order.customer.phone}
                        </p>

                        <p>{order.customer.address}</p>

                        {order.customer.notes && (
                          <p>
                            <strong>Notes:</strong> {order.customer.notes}
                          </p>
                        )}

                        {order.items && order.items.length > 0 && (
                          <div className="order-items">
                            <strong>Order Items</strong>

                            {order.items.map((item) => (
                              <p key={item.id}>
                                {item.name} × {item.quantity} —{' '}
                                {money(item.price * item.quantity)}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>

                      <select
                        value={order.status || 'Received'}
                        onChange={async (event) => {
                          const newStatus = event.target.value;

                          let updatedOrder = {
                            ...order,

                            status: newStatus,

                            updatedAt: new Date().toISOString(),
                          };

                          /*
                           * STOCK MANAGEMENT
                           *
                           * Only the FIRST time
                           * an order becomes
                           * Delivered, deduct stock.
                           */
                          if (
                            newStatus === 'Delivered' &&
                            !order.stockDeducted
                          ) {
                            updatedOrder = await deductDeliveredOrderStock(
                              updatedOrder
                            );
                          }

                          /*
                           * Update Orders UI
                           * immediately.
                           */
                          setOrders((current) =>
                            current.map((entry) =>
                              entry.id === order.id ? updatedOrder : entry
                            )
                          );

                          /*
                           * Save updated order
                           * into Supabase.
                           */
                          if (supabase) {
                            const { error } = await supabase
                              .from('orders')
                              .update({
                                order_data: updatedOrder,

                                updated_at: new Date().toISOString(),
                              })
                              .eq('id', order.id);

                            if (error) {
                              console.error(
                                'Could not update order status:',
                                error
                              );

                              alert(
                                'Status changed locally, but could not save to Supabase.'
                              );

                              return;
                            }
                          }

                          /*
                           * Existing WhatsApp
                           * status flow.
                           */
                          sendCustomerStatusWhatsApp(updatedOrder, newStatus);
                        }}
                      >
                        <option value="Received">Received</option>

                        <option value="Order is being prepared">
                          Order is being prepared
                        </option>

                        <option value="Order is packing">
                          Order is packing
                        </option>

                        <option value="Order is in transit">
                          Order is in transit
                        </option>

                        <option value="Delivered">Delivered</option>

                        <option value="Cancelled">Cancelled</option>
                      </select>

                      <strong>{money(order.total)}</strong>

                      {order.payment && (
                        <div>
                          <strong>{order.payment.method || 'Payment'}</strong>

                          {order.payment.transactionId && (
                            <p>Txn: {order.payment.transactionId}</p>
                          )}

                          <p>{order.payment.status || '-'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {tab === 'settings' && (
          <section>
            <div className="admin-heading">
              <div>
                <p className="eyebrow">CONFIGURATION</p>

                <h1>Restaurant settings</h1>

                <p>
                  Manage restaurant details, payments and contact information.
                </p>
              </div>
            </div>

            <div className="settings-grid">
              {[
                ['name', 'Name'],
                ['ownerName', 'Owner name'],
                ['tagline', 'Tagline'],
                ['phone', 'Phone'],
                ['whatsapp', 'WhatsApp'],
                ['address', 'Address'],
                ['openingHours', 'Opening hours'],
                ['instagram', 'Instagram'],
                ['facebook', 'Facebook'],
                ['mapsUrl', 'Google Maps URL'],
                ['upiId', 'UPI ID'],
              ].map(([field, label]) => (
                <label key={field}>
                  {label}

                  <input
                    value={settings[field] || ''}
                    onChange={(event) =>
                      updateSetting(field, event.target.value)
                    }
                  />
                </label>
              ))}

              <label>
                Service charge
                <input
                  type="number"
                  min="0"
                  value={settings.serviceCharge || 0}
                  onChange={(event) =>
                    updateSetting(
                      'serviceCharge',
                      Number(event.target.value) || 0
                    )
                  }
                />
              </label>

              <label>
                Tax %
                <input
                  type="number"
                  min="0"
                  value={settings.tax || 0}
                  onChange={(event) =>
                    updateSetting('tax', Number(event.target.value) || 0)
                  }
                />
              </label>

              <label>
                UPI payments
                <select
                  value={settings.upiEnabled ? 'enabled' : 'disabled'}
                  onChange={(event) =>
                    updateSetting(
                      'upiEnabled',
                      event.target.value === 'enabled'
                    )
                  }
                >
                  <option value="enabled">Enabled</option>

                  <option value="disabled">Disabled</option>
                </select>
              </label>
            </div>

            <div className="settings-card">
              <p className="eyebrow">UPI QR</p>

              <h2>Payment QR Code</h2>

              {settings.upiQr && (
                <img src={settings.upiQr} alt="UPI QR" className="upi-qr" />
              )}

              <label className="upload-qr-button">
                Upload / Replace QR
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={uploadUpiQr}
                />
              </label>
            </div>

            <button
              className="gold-button"
              onClick={async () => {
                const success = await saveSettingsToSupabase(settings);

                if (!success) {
                  alert('Restaurant settings could not be saved.');
                  return;
                }

                alert('Restaurant settings saved successfully.');
              }}
            >
              Save Restaurant Settings
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

function AdminDashboard({
  menu,
  orders,
  soundEnabled,
  setSoundEnabled,
  playNewOrderSound,
}) {
  const today = new Date();

  const todayOrders = orders.filter((order) => {
    if (!order.createdAt) {
      return false;
    }

    const orderDate = new Date(order.createdAt);

    return (
      orderDate.getFullYear() === today.getFullYear() &&
      orderDate.getMonth() === today.getMonth() &&
      orderDate.getDate() === today.getDate()
    );
  });

  const todayNewOrders = todayOrders.filter(
    (order) => order.status === 'Received'
  );

  return (
    <section>
      <div className="admin-heading">
        <div>
          <p className="eyebrow">OVERVIEW</p>

          <h1>Dashboard</h1>
        </div>

        <button
          className="gold-button"
          onClick={() => {
            if (soundEnabled) {
              setSoundEnabled(false);
              return;
            }

            setSoundEnabled(true);

            // Test the voice immediately
            playNewOrderSound();
          }}
        >
          {soundEnabled ? '🔔 New Order Sound ON' : '🔕 New Order Sound OFF'}
        </button>
      </div>

      <div className="stats-grid">
        <div>
          <Utensils />

          <strong>{menu.length}</strong>

          <span>Menu items</span>
        </div>

        <div>
          <ShoppingBag />

          <strong>{todayOrders.length}</strong>

          <span>Today's orders</span>
        </div>

        <div>
          <Clock3 />

          <strong>{todayNewOrders.length}</strong>

          <span>New orders today</span>
        </div>
      </div>
    </section>
  );
}
function CustomerLogin({ onClose, onSuccess }) {
  const [loginValue, setLoginValue] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const isPhone = /^\s*[0-9]/.test(loginValue);

  const cleanPhone = loginValue.replace(/\D/g, '').slice(0, 10);

  const cleanEmail = loginValue.trim().toLowerCase();

  async function sendOtp() {
    if (isPhone) {
      if (cleanPhone.length !== 10) {
        alert('Please enter a valid 10-digit WhatsApp number.');
        return;
      }

      alert(
        'WhatsApp OTP verification is coming soon. For now, please use your email address to login.'
      );

      return;
    }

    if (!cleanEmail) {
      alert('Please enter your email address or WhatsApp number.');
      return;
    }

    if (!cleanEmail.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }

    if (!supabase) {
      alert('Supabase is not configured.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setOtpSent(true);

    alert('OTP sent to your email.');
  }

  async function verifyOtp() {
    const cleanOtp = otp.trim();

    if (!cleanOtp) {
      alert('Please enter the OTP.');
      return;
    }

    if (!supabase) {
      alert('Supabase is not configured.');
      return;
    }

    if (isPhone) {
      alert(
        'WhatsApp OTP verification is coming soon. Please use email login for now.'
      );
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanOtp,
      type: 'email',
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    if (!data.session) {
      alert('Login was not completed. Please try again.');
      return;
    }

    onSuccess(data.session.user);
  }

  function handleLoginValueChange(event) {
    const value = event.target.value;

    if (/^\s*[0-9]/.test(value)) {
      setLoginValue(value.replace(/\D/g, '').slice(0, 10));
      return;
    }

    setLoginValue(value);
  }

  return (
    <div className="login-overlay">
      <div className="login-popup">
        <button className="login-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="login-icon">KK</div>

        <h2>{otpSent ? 'Enter OTP' : 'Login to continue'}</h2>

        <p className="login-subtitle">
          {otpSent
            ? `We sent a verification code to ${cleanEmail}`
            : 'Login with your email / WhatsApp number to continue your order.'}
        </p>

        {!otpSent ? (
          <>
            <label className="login-label">
              {isPhone ? 'WhatsApp number' : 'Email address / WhatsApp number'}
            </label>

            <div className="login-input-wrapper">
              {isPhone && <span className="phone-prefix">+91</span>}

              <input
                className={isPhone ? 'login-input phone-input' : 'login-input'}
                type="text"
                value={loginValue}
                onChange={handleLoginValueChange}
                placeholder={
                  isPhone
                    ? 'Enter 10-digit WhatsApp number'
                    : 'Enter email or WhatsApp number'
                }
                inputMode={isPhone ? 'numeric' : 'email'}
                autoComplete={isPhone ? 'tel' : 'email'}
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
                ? 'Sending OTP...'
                : isPhone
                ? 'WhatsApp OTP Coming Soon'
                : 'Send OTP to Email'}
            </button>
          </>
        ) : (
          <>
            <label className="login-label">Enter OTP</label>

            <input
              className="login-input otp-input"
              type="text"
              inputMode="numeric"
              maxLength="6"
              value={otp}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, ''))
              }
              placeholder="Enter 6-digit OTP"
              autoComplete="one-time-code"
            />

            <button
              className="gold-button full"
              onClick={verifyOtp}
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>

            <button
              className="login-secondary"
              onClick={() => {
                setOtpSent(false);
                setOtp('');
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
  mode = 'edit',
  onSaved,
  onCancel,
}) {
  const [name, setName] = useState(existingProfile?.name || '');

  const [phone, setPhone] = useState(existingProfile?.phone || '');

  const [address, setAddress] = useState(existingProfile?.address || '');

  const [latitude, setLatitude] = useState(existingProfile?.latitude || null);

  const [longitude, setLongitude] = useState(
    existingProfile?.longitude || null
  );

  const [locationLoading, setLocationLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      alert('Location is not supported by this browser.');
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

        alert('Your current location has been saved.');
      },
      (error) => {
        setLocationLoading(false);

        if (error.code === 1) {
          alert(
            'Location permission was denied. Please allow location access in your browser settings.'
          );
        } else if (error.code === 2) {
          alert('Your location could not be determined. Please try again.');
        } else {
          alert('Could not get your location. Please try again.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  async function saveProfile(event) {
    event.preventDefault();

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanAddress = address.trim();

    if (!cleanAddress) {
      alert('Please enter your delivery address.');
      return;
    }

    if (
      !Number.isFinite(Number(latitude)) ||
      !Number.isFinite(Number(longitude))
    ) {
      alert('Please select your delivery location on the map before saving.');
      return;
    }

    if (!user?.id) {
      alert('Your login session could not be found. Please login again.');
      return;
    }

    /*
     * ADD ADDRESS MODE
     * Save only the new delivery address.
     * Do not overwrite the customer's main profile.
     */
    if (mode === 'add-address') {
      setSaving(true);

      try {
        const savedLocationsKey = `kk-saved-locations-${user.id}`;

        const savedLocations = JSON.parse(
          localStorage.getItem(savedLocationsKey) || '[]'
        );

        const newLocation = {
          label: 'Saved Address',
          address: cleanAddress,
          latitude: Number(latitude),
          longitude: Number(longitude),
          selected: true,
        };

        const updatedLocations = [
          ...savedLocations.map((location) => ({
            ...location,
            selected: false,
          })),
          newLocation,
        ];

        localStorage.setItem(
          savedLocationsKey,
          JSON.stringify(updatedLocations)
        );

        setSaving(false);

        onSaved({
          ...existingProfile,
          address: cleanAddress,
          latitude: Number(latitude),
          longitude: Number(longitude),
        });

        return;
      } catch (error) {
        console.error('Could not save delivery address:', error);

        setSaving(false);

        alert('Could not save the delivery address. Please try again.');

        return;
      }
    }

    /*
     * EDIT / PROFILE SETUP MODE
     * Save the complete customer profile.
     */
    if (!cleanName) {
      alert('Please enter your name.');
      return;
    }

    if (!cleanPhone) {
      alert('Please enter your phone number.');
      return;
    }

    setSaving(true);

    const profile = {
      id: user.id,
      email: user.email || '',
      name: cleanName,
      phone: cleanPhone,
      address: cleanAddress,
      latitude: Number(latitude),
      longitude: Number(longitude),
    };

    const success = await saveCustomerProfile(profile);

    setSaving(false);

    if (!success) {
      alert('Could not save your profile. Please try again.');
      return;
    }

    onSaved(profile);
  }

  return (
    <div className="profile-setup-page">
      <div className="profile-setup-card">
        <div className="profile-setup-icon">KK</div>

        <p className="eyebrow">WELCOME TO KSHATRIYAS KITCHEN</p>

        <h1>
          {mode === 'add-address'
            ? 'Add a new address'
            : 'Complete your profile'}
        </h1>

        <p className="profile-setup-subtitle">
          {mode === 'add-address'
            ? 'Save another delivery address for faster checkout.'
            : 'We need these details once. Your saved details will be used automatically for future orders.'}
        </p>

        <form onSubmit={saveProfile}>
          {mode !== 'add-address' && (
            <>
              <label>
                Name
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your name"
                  autoComplete="name"
                />
              </label>

              <label>
                Phone number
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Enter your phone number"
                  autoComplete="tel"
                />
              </label>
            </>
          )}
          <label>
            Delivery address
            <textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Enter your complete delivery address"
              autoComplete="street-address"
            />
          </label>
          <div className="location-box">
            <div>
              <strong>Delivery location</strong>

              <p>
                Allow location access so we can save your delivery location.
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
                ? 'Getting location...'
                : latitude && longitude
                ? 'Location Saved'
                : 'Use Current Location'}
            </button>
          </div>
          {latitude && longitude && (
            <p className="location-success">
              ✓ Your current location has been saved.
            </p>
          )}
          <button type="submit" className="gold-button full" disabled={saving}>
            {saving
              ? 'Saving...'
              : mode === 'add-address'
              ? 'Save Address'
              : 'Save & Continue'}
          </button>
          <button
            type="button"
            className="back-link"
            onClick={onCancel}
            disabled={saving}
            style={{
              width: '100%',
              justifyContent: 'center',
              marginTop: '16px',
            }}
          >
            <ArrowLeft size={16} />
            Back to Home
          </button>{' '}
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
  onLogout,
}) {
  async function logout() {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message);
      return;
    }

    onLogout();
  }

  return (
    <section className="account-page">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="page-heading compact">
        <p className="eyebrow">MY ACCOUNT</p>

        <h1>Welcome, {profile?.name || 'Customer'}</h1>

        <p>Manage your details and view your previous orders.</p>
      </div>

      <div className="account-layout">
        <div className="account-card">
          <div className="account-card-header">
            <div>
              <p className="eyebrow">PROFILE</p>

              <h2>Personal details</h2>
            </div>

            <button className="account-edit-button" onClick={onEditProfile}>
              Edit
            </button>
          </div>

          <div className="account-detail">
            <span>Name</span>

            <strong>{profile?.name || '-'}</strong>
          </div>

          <div className="account-detail">
            <span>Email</span>

            <strong>{user?.email || '-'}</strong>
          </div>

          <div className="account-detail">
            <span>Phone</span>

            <strong>{profile?.phone || '-'}</strong>
          </div>

          <div className="account-detail">
            <span>Delivery address</span>

            <strong>{profile?.address || '-'}</strong>
          </div>

          <div className="account-detail">
            <span>Delivery location</span>

            <strong>
              {profile?.latitude && profile?.longitude
                ? 'Location saved'
                : 'Location not saved'}
            </strong>
          </div>

          {profile?.latitude && profile?.longitude && (
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

          <button className="logout-button" onClick={logout}>
            Logout
          </button>
        </div>

        <div className="account-card orders-card">
          <div className="account-card-header">
            <div>
              <p className="eyebrow">ORDER HISTORY</p>

              <h2>Previous orders</h2>
            </div>

            <span className="order-count">{orders.length}</span>
          </div>

          {!orders.length ? (
            <div className="empty-orders">
              <Package size={36} />

              <h3>No orders yet</h3>

              <p>Your previous orders will appear here.</p>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map((order) => (
                <div className="account-order" key={order.id}>
                  <div className="account-order-top">
                    <div>
                      <strong>{order.id}</strong>

                      <span>
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : '-'}
                      </span>
                    </div>

                    <strong>{money(order.total)}</strong>
                  </div>

                  <div className="account-order-items">
                    {(order.items || []).map((item) => (
                      <span key={item.id}>
                        {item.name} × {item.quantity}
                      </span>
                    ))}
                  </div>

                  <div className="account-order-bottom">
                    <span>Status</span>

                    <strong>{order.status || 'Received'}</strong>
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
