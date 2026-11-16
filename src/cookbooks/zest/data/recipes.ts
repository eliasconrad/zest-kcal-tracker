import seeds from "./recipes.json";
import type { Recipe } from "./recipeRules";

export * from "./recipeRules";

/** 40 dishes computed from USDA FoodData Central (scripts/recipes). */
export const recipes = seeds as Recipe[];
