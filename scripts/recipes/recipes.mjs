/** Seed recipes as ingredient grams per serving. Nutrition is computed from USDA data by build.mjs, never typed in. */
const OATS = "Oats (Includes foods for USDA's Food Distribution Program)";
const EGG = "Egg, whole, cooked, scrambled";
const YOGURT = "Yogurt, Greek, plain, nonfat (Includes foods for USDA's Food Distribution Program)";
const RICE = "Rice, white, long-grain, regular, enriched, cooked";
const CHICKEN = "Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, grilled";
const OIL = "Oil, olive, salad or cooking";
const LENTILS = "Lentils, mature seeds, cooked, boiled, without salt";
const BROCCOLI = "Broccoli, raw";
const TOMATO = "Tomatoes, red, ripe, raw, year round average";
const AVOCADO = "Avocados, raw, all commercial varieties";
const BREAD = "Bread, whole-wheat, commercially prepared";
const PASTA = "Pasta, cooked, enriched, without added salt";
const SALMON = "Fish, salmon, Atlantic, farmed, cooked, dry heat";
const TOFU = "Tofu, raw, firm, prepared with calcium sulfate";
const CHICKPEAS = "Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt";
const SPINACH = "Spinach, raw";
const FETA = "Cheese, feta";
const MILK = "Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D";
const PEANUT = "Peanut butter, smooth style, without salt";
const POTATO = "Potatoes, flesh and skin, raw";
const BEEF = "Beef, ground, 85% lean meat / 15% fat, patty, cooked, broiled";
const TUNA = "Fish, tuna, light, canned in water, without salt, drained solids";
const ONION = "Onions, raw";
const PEPPER = "Peppers, sweet, red, raw";
const CUCUMBER = "Cucumber, with peel, raw";
const CARROT = "Carrots, raw";
const QUINOA = "Quinoa, cooked";
const BLACK = "Beans, black, mature seeds, cooked, boiled, without salt";
const SWEET = "Sweet potato, cooked, baked in skin, flesh, without salt";
const APPLE = "Apples, raw, fuji, with skin (Includes foods for USDA's Food Distribution Program)";
const BLUEBERRY = "Blueberries, raw";
const BANANA = "Bananas, raw";
const ALMOND = "Nuts, almonds, dry roasted, with salt added";
const HONEY = "Honey";
const PARMESAN = "Cheese, parmesan, grated";
const COTTAGE = "Cheese, cottage, lowfat, 2% milkfat";
const SOY = "Soy sauce made from soy and wheat (shoyu)";
const TORTILLA = "Tortillas, ready-to-bake or -fry, whole wheat";
const LETTUCE = "Lettuce, cos or romaine, raw";
const MUSHROOM = "Mushrooms, white, raw";
const ZUCCHINI = "Squash, summer, zucchini, includes skin, raw";
const COCONUT = "Nuts, coconut milk, canned (liquid expressed from grated meat and water)";
const CURRY = "Spices, curry powder";
const HUMMUS = "Hummus, commercial";

export const recipes = [
  { name: "Banana peanut oats", type: "Breakfast", minutes: 8, tags: ["vegetarian", "vegan", "pescatarian"], ingredients: [[OATS, 50], [BANANA, 100], [PEANUT, 15]] },
  { name: "Blueberry yogurt bowl", type: "Breakfast", minutes: 3, tags: ["vegetarian", "pescatarian"], ingredients: [[YOGURT, 200], [BLUEBERRY, 80], [HONEY, 10], [ALMOND, 15]] },
  { name: "Spinach scramble on toast", type: "Breakfast", minutes: 10, tags: ["vegetarian", "pescatarian"], ingredients: [[EGG, 120], [SPINACH, 50], [BREAD, 50], [OIL, 5]] },
  { name: "Avocado toast with egg", type: "Breakfast", minutes: 8, tags: ["vegetarian", "pescatarian"], ingredients: [[BREAD, 60], [AVOCADO, 70], [EGG, 60]] },
  { name: "Apple cinnamon porridge", type: "Breakfast", minutes: 10, tags: ["vegetarian", "pescatarian"], ingredients: [[OATS, 50], [MILK, 200], [APPLE, 100], [HONEY, 8]] },
  { name: "Cottage cheese with berries", type: "Breakfast", minutes: 2, tags: ["vegetarian", "pescatarian"], ingredients: [[COTTAGE, 200], [BLUEBERRY, 100], [ALMOND, 10]] },
  { name: "Tofu scramble wrap", type: "Breakfast", minutes: 12, tags: ["vegetarian", "vegan", "pescatarian"], ingredients: [[TOFU, 120], [PEPPER, 60], [SPINACH, 30], [TORTILLA, 45], [OIL, 5]] },
  { name: "Banana almond smoothie", type: "Breakfast", minutes: 4, tags: ["vegetarian", "pescatarian"], ingredients: [[BANANA, 120], [MILK, 250], [ALMOND, 15], [OATS, 20]] },
  { name: "Egg and mushroom bowl", type: "Breakfast", minutes: 10, tags: ["vegetarian", "pescatarian"], ingredients: [[EGG, 120], [MUSHROOM, 100], [TOMATO, 80], [OIL, 5]] },
  { name: "Peanut butter toast", type: "Breakfast", minutes: 3, tags: ["vegetarian", "vegan", "pescatarian"], ingredients: [[BREAD, 60], [PEANUT, 20], [BANANA, 60]] },
  { name: "Chicken rice bowl", type: "Lunch", minutes: 20, tags: [], ingredients: [[CHICKEN, 130], [RICE, 180], [BROCCOLI, 100], [SOY, 15], [OIL, 5]] },
  { name: "Lentil tomato soup", type: "Lunch", minutes: 25, tags: ["vegetarian", "vegan", "pescatarian"], ingredients: [[LENTILS, 200], [TOMATO, 150], [ONION, 50], [CARROT, 60], [OIL, 8]] },
  { name: "Greek chickpea salad", type: "Lunch", minutes: 10, tags: ["vegetarian", "pescatarian"], ingredients: [[CHICKPEAS, 150], [CUCUMBER, 100], [TOMATO, 100], [FETA, 40], [OIL, 8]] },
  { name: "Tuna black bean salad", type: "Lunch", minutes: 8, tags: ["pescatarian"], ingredients: [[TUNA, 110], [BLACK, 100], [LETTUCE, 80], [TOMATO, 80], [OIL, 8]] },
  { name: "Chicken caesar wrap", type: "Lunch", minutes: 12, tags: [], ingredients: [[CHICKEN, 110], [TORTILLA, 60], [LETTUCE, 60], [PARMESAN, 10], [YOGURT, 40]] },
  { name: "Quinoa veggie bowl", type: "Lunch", minutes: 20, tags: ["vegetarian", "vegan", "pescatarian"], ingredients: [[QUINOA, 185], [PEPPER, 80], [BROCCOLI, 80], [AVOCADO, 50], [OIL, 5]] },
  { name: "Black bean burrito bowl", type: "Lunch", minutes: 15, tags: ["vegetarian", "vegan", "pescatarian"], ingredients: [[BLACK, 150], [RICE, 150], [TOMATO, 80], [AVOCADO, 50], [ONION, 30]] },
  { name: "Hummus veggie wrap", type: "Lunch", minutes: 6, tags: ["vegetarian", "vegan", "pescatarian"], ingredients: [[TORTILLA, 60], [HUMMUS, 60], [CUCUMBER, 60], [CARROT, 50], [SPINACH, 30]] },
  { name: "Salmon and avocado rice", type: "Lunch", minutes: 18, tags: ["pescatarian"], ingredients: [[SALMON, 110], [RICE, 150], [AVOCADO, 50], [CUCUMBER, 60], [SOY, 10]] },
  { name: "Tomato feta pasta", type: "Lunch", minutes: 18, tags: ["vegetarian", "pescatarian"], ingredients: [[PASTA, 200], [TOMATO, 150], [FETA, 40], [OIL, 8], [SPINACH, 30]] },
  { name: "Tofu stir fry with rice", type: "Lunch", minutes: 18, tags: ["vegetarian", "vegan", "pescatarian"], ingredients: [[TOFU, 150], [RICE, 180], [PEPPER, 80], [BROCCOLI, 80], [SOY, 15], [OIL, 8]] },
  { name: "Roast salmon with sweet potato", type: "Dinner", minutes: 30, tags: ["pescatarian"], ingredients: [[SALMON, 140], [SWEET, 200], [BROCCOLI, 120], [OIL, 5]] },
  { name: "Chicken and vegetable pan", type: "Dinner", minutes: 25, tags: [], ingredients: [[CHICKEN, 150], [ZUCCHINI, 120], [PEPPER, 100], [POTATO, 200], [OIL, 10]] },
  { name: "Beef and pepper rice", type: "Dinner", minutes: 20, tags: [], ingredients: [[BEEF, 110], [RICE, 170], [PEPPER, 100], [ONION, 50], [SOY, 10]] },
  { name: "Chickpea coconut curry", type: "Dinner", minutes: 25, tags: ["vegetarian", "vegan", "pescatarian"], ingredients: [[CHICKPEAS, 180], [COCONUT, 80], [SPINACH, 60], [TOMATO, 100], [RICE, 120], [CURRY, 3]] },
  { name: "Lentil bolognese", type: "Dinner", minutes: 30, tags: ["vegetarian", "vegan", "pescatarian"], ingredients: [[LENTILS, 150], [PASTA, 200], [TOMATO, 150], [CARROT, 50], [ONION, 40], [OIL, 8]] },
  { name: "Mushroom spinach pasta", type: "Dinner", minutes: 20, tags: ["vegetarian", "pescatarian"], ingredients: [[PASTA, 200], [MUSHROOM, 120], [SPINACH, 60], [PARMESAN, 15], [OIL, 8]] },
  { name: "Beef burger bowl", type: "Dinner", minutes: 20, tags: [], ingredients: [[BEEF, 120], [POTATO, 200], [LETTUCE, 60], [TOMATO, 80], [OIL, 5]] },
  { name: "Tuna pasta with tomato", type: "Dinner", minutes: 18, tags: ["pescatarian"], ingredients: [[PASTA, 200], [TUNA, 110], [TOMATO, 150], [OIL, 8]] },
  { name: "Sweet potato black bean chili", type: "Dinner", minutes: 30, tags: ["vegetarian", "vegan", "pescatarian"], ingredients: [[SWEET, 180], [BLACK, 150], [TOMATO, 150], [ONION, 50], [OIL, 5]] },
  { name: "Chicken curry with rice", type: "Dinner", minutes: 25, tags: [], ingredients: [[CHICKEN, 130], [COCONUT, 60], [RICE, 170], [SPINACH, 40], [CURRY, 3]] },
  { name: "Baked potato with cottage cheese", type: "Dinner", minutes: 35, tags: ["vegetarian", "pescatarian"], ingredients: [[POTATO, 300], [COTTAGE, 150], [BROCCOLI, 100]] },
  { name: "Apple and peanut butter", type: "Snack", minutes: 2, tags: ["vegetarian", "vegan", "pescatarian"], ingredients: [[APPLE, 150], [PEANUT, 15]] },
  { name: "Greek yogurt with honey", type: "Snack", minutes: 1, tags: ["vegetarian", "pescatarian"], ingredients: [[YOGURT, 170], [HONEY, 10]] },
  { name: "Carrots with hummus", type: "Snack", minutes: 3, tags: ["vegetarian", "vegan", "pescatarian"], ingredients: [[CARROT, 120], [HUMMUS, 50]] },
  { name: "Banana and almonds", type: "Snack", minutes: 1, tags: ["vegetarian", "vegan", "pescatarian"], ingredients: [[BANANA, 120], [ALMOND, 15]] },
  { name: "Cottage cheese with tomato", type: "Snack", minutes: 3, tags: ["vegetarian", "pescatarian"], ingredients: [[COTTAGE, 150], [TOMATO, 100]] },
  { name: "Boiled egg and cucumber", type: "Snack", minutes: 10, tags: ["vegetarian", "pescatarian"], ingredients: [["Egg, whole, cooked, hard-boiled", 100], [CUCUMBER, 100]] },
  { name: "Avocado on toast", type: "Snack", minutes: 4, tags: ["vegetarian", "vegan", "pescatarian"], ingredients: [[BREAD, 35], [AVOCADO, 50]] },
  { name: "Blueberries and almonds", type: "Snack", minutes: 1, tags: ["vegetarian", "vegan", "pescatarian"], ingredients: [[BLUEBERRY, 120], [ALMOND, 15]] },
];

/** Allergens each ingredient carries, for the filter. Conservative: when unsure, the allergen is listed. */
export const allergensOf = (name) => {
  const found = [];
  const has = (...words) => words.some((word) => name.toLowerCase().includes(word));
  if (has("almond")) found.push("Tree nuts");
  if (has("peanut")) found.push("Peanuts");
  if (has("bread", "pasta", "tortilla", "soy sauce", "oats")) found.push("Gluten");
  if (!has("coconut") && has("yogurt", "milk,", "cheese", "feta", "parmesan", "cottage")) found.push("Lactose");
  if (has("egg")) found.push("Egg");
  if (has("tofu", "soy sauce")) found.push("Soy");
  if (has("fish", "salmon", "tuna")) found.push("Fish");
  if (has("hummus")) found.push("Sesame");
  return found;
};
