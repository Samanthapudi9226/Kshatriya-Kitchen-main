export const categories = [
  "All",
  "Biryani",
  "Rice Meals"
];

const images = {
  dumBiryani:
    "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=1200&q=85",
  fryBiryani:
    "https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=900&q=85",
  specialBiryani:
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRApuk8l4ayNpsgy04Tq1ez81NBcIrbqvzd1rpzUjDoSA&s=10",
  chickenRice:
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSAugcy0LActBrQ9gX9wkPjY0UdTMYgE7zpZySDLYFqQw&s=10",
  chickenFry:
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQZW2UXK_tOT0KjDTqvbDX5ci0oW8DdukjS_zHgvMJ7jw&s=10",
  muttonCurry:
    "https://images.unsplash.com/photo-1545247181-516773cae754?auto=format&fit=crop&w=900&q=85",
  dalcha:
    "https://www.seema.com/wp-content/uploads/2023/04/06dalchagosht-shutterstock_2146910523-900x1350.jpg"
};

export const initialMenu = [
  {
    id: "dum-biryani",
    name: "Dum Biryani",
    description: "Fragrant basmati rice layered with aromatic spices and slow-cooked goodness.",
    category: "Biryani",
    price: 0,
    image: images.dumBiryani,
    available: true
  },
  {
    id: "fry-piece-biryani",
    name: "Fry Piece Biryani",
    description: "Royal biryani served with flavourful, crisp chicken fry pieces.",
    category: "Biryani",
    price: 0,
    image: images.fryBiryani,
    available: true
  },
  {
    id: "special-chicken-biryani",
    name: "Special Chicken Biryani",
    description: "A generous chicken biryani made for a truly special meal.",
    category: "Biryani",
    price: 0,
    image: images.specialBiryani,
    available: true
  },
  {
    id: "bagara-chicken-curry",
    name: "Bagara Rice with Chicken Curry",
    description: "Mildly spiced bagara rice paired with rich chicken curry.",
    category: "Rice Meals",
    price: 0,
    image: images.chickenRice,
    available: true
  },
  {
    id: "bagara-chicken-fry",
    name: "Bagara Rice with Chicken Fry",
    description: "Aromatic bagara rice with deliciously seasoned chicken fry.",
    category: "Rice Meals",
    price: 0,
    image: images.chickenFry,
    available: true
  },
  {
    id: "bagara-mutton-curry",
    name: "Bagara Rice with Mutton Curry",
    description: "Traditional bagara rice accompanied by slow-cooked mutton curry.",
    category: "Rice Meals",
    price: 0,
    image: images.muttonCurry,
    available: true
  },
  {
    id: "bagara-mutton-dalcha",
    name: "Bagara Rice with Mutton Dalcha",
    description: "Fragrant rice served with homestyle mutton dalcha and lentils.",
    category: "Rice Meals",
    price: 0,
    image: images.dalcha,
    available: true
  }
];
