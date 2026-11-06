export type Dish = {
  id: number;
  slug: string;
  name: string;
  description: string;
  category: string;
  price: number;
  spice_level: number;
  is_vegetarian: boolean;
  is_vegan: boolean;
  allergens: string[];
  tags: string[];
  image_path: string | null;
  sold_out: boolean;
};

export type DishWithWhy = Dish & { why: string };
