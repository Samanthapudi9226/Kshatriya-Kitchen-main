import { createClient } from "@supabase/supabase-js";

export const restaurantDefaults = {
  name: "Kshatriya Kitchen",
  tagline: "Royal Indian flavours, prepared with pride",
  phone: "EDIT_ME",
  whatsapp: "EDIT_ME",
  address: "EDIT_ME",
  mapsUrl: "EDIT_ME",
  openingHours: "EDIT_ME",
  instagram: "EDIT_ME",
  facebook: "EDIT_ME",
  logo: "",
  favicon: "",
  deliveryCharge: 0,
  serviceCharge: 0,
  tax: 0,
  minimumOrder: 0,
   // UPI Payment Settings
   upiEnabled: true,
   upiId: "EDIT_ME",
   upiQr: ""
};

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
