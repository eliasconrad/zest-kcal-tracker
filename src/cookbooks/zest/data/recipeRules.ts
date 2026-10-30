import type { MealType } from "./diary";
import type { Diet } from "./nutrition";

export type Recipe = {
  id: string;
  name: string;
  type: MealType;
  minutes: number;
  /** The ways of eating it fits. */
  tags: string[];
  allergens: string[];
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** Halal and kosher depend on sourcing that a nutrient table cannot know, so meat dishes stay visible and the person decides. */
export function fitsDiet(recipe: Recipe, diet: Diet) {
  if (diet === "vegetarian" || diet === "vegan" || diet === "pescatarian") return recipe.tags.includes(diet);
  return true;
}

export function visibleRecipes(
  list: Recipe[],
  {
    query,
    diet,
    allergies,
    type,
    favourites,
  }: {
    query: string;
    diet: Diet;
    allergies: string[];
    type?: MealType | "Favourites";
    favourites: string[];
  },
) {
  const term = query.trim().toLowerCase();
  return list.filter(
    (recipe) =>
      fitsDiet(recipe, diet) &&
      !recipe.allergens.some((item) => allergies.includes(item)) &&
      (!term || recipe.name.toLowerCase().includes(term)) &&
      (!type || (type === "Favourites" ? favourites.includes(recipe.id) : recipe.type === type)),
  );
}

export function perServings(recipe: Recipe, servings: number) {
  return {
    grams: Math.round(recipe.grams * servings),
    kcal: Math.round(recipe.kcal * servings),
    protein: Math.round(recipe.protein * servings),
    carbs: Math.round(recipe.carbs * servings),
    fat: Math.round(recipe.fat * servings),
  };
}
