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

/** A dish on a card inside an answer. Numbers of a known recipe are always the recipe's own. */
export type Dish = {
  /** Set when it is one of Zest's recipes; otherwise the numbers are the model's estimate. */
  recipeId?: string;
  name: string;
  type: MealType;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  minutes?: number;
};

/** Turns the model's `#` lines into dishes: an id from the list, or `name | kcal | p | c | f | min`. */
export function resolveDishes(lines: string[], list: Recipe[], fallback: MealType = "Dinner"): Dish[] {
  const dishes = lines.flatMap((line): Dish[] => {
    const id = line.replace(/[`*]/g, "").trim();
    const recipe = list.find((item) => item.id === id);
    if (recipe)
      return [
        {
          recipeId: recipe.id,
          name: recipe.name,
          type: recipe.type,
          kcal: recipe.kcal,
          protein: recipe.protein,
          carbs: recipe.carbs,
          fat: recipe.fat,
          minutes: recipe.minutes,
        },
      ];
    const parts = id.split("|").map((part) => part.trim());
    if (parts.length < 5) return [];
    const [name, ...rest] = parts;
    const [kcal, protein, carbs, fat, minutes] = rest.map(Number);
    if (!name || !(kcal > 0) || ![protein, carbs, fat].every(Number.isFinite)) return [];
    return [{ name, type: fallback, kcal: Math.round(kcal), protein, carbs, fat, minutes: minutes || undefined }];
  });
  return dishes.filter((dish, i) => dishes.findIndex((d) => d.name === dish.name) === i).slice(0, 3);
}
