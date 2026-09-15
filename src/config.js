import { createClient } from "@supabase/supabase-js";

export const restaurantDefaults = {
  name: "Kshatriya Kitchen",
  ownerName: "-",
  tagline: "Royal Indian flavours, prepared with pride",
  phone: "-",
  whatsapp: "-",
  address: "-",
  mapsUrl: "-",
  openingHours: "-",
  instagram: "-",
  facebook: "-",
  logo: "",
  favicon: "",
  deliveryCharge: 0,
  serviceCharge: 0,
  tax: 0,
  minimumOrder: 0,
  upiEnabled: true,
  upiId: "-",
  upiQr: ""
};
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
