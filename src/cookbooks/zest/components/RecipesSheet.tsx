import { useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SheetShell } from "./ui/SheetShell";
import { Gap, Note, PrimaryButton, TextLink } from "./ui/Form";
import { Symbol, Touch } from "./ui/Touch";
import { Selectable, SelectableText } from "./ui/Selectable";
import { FoodSticker } from "./Stickers";
import { ApiError, apiConfigured, suggestRecipes } from "../data/api";
import type { DiaryContext } from "../data/context";
import { mealTypes, type MealType } from "../data/diary";
import { perServings, recipes, visibleRecipes, type Recipe } from "../data/recipes";
import type { RecipeIdea } from "../data/replies";
import { useProfile } from "../state/useProfile";
import { theme } from "../theme";
import type { Scene } from "../hooks/useScene";

const filters: (MealType | "Favourites")[] = [...mealTypes, "Favourites"];
const MAX_STAGGERED = 8;

export function RecipesSheet({
  scene,
  context,
  onClose,
  onLog,
  onLimit,
}: {
  scene: Scene;
  context: () => DiaryContext;
  onClose: () => void;
  onLog: (meal: { name: string; kcal: number; protein: number; carbs: number; fat: number; type: MealType }) => void;
  onLimit: () => void;
}) {
  const profile = useProfile((s) => s);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MealType | "Favourites" | undefined>();
  const [open, setOpen] = useState<Recipe | null>(null);
  const [servings, setServings] = useState(1);
  const [ideas, setIdeas] = useState<RecipeIdea[] | null>(null);
  const [thinking, setThinking] = useState(false);
  const [note, setNote] = useState("");
  const request = useRef<AbortController | null>(null);
  const list = visibleRecipes(recipes, {
    query,
    diet: profile.diet,
    allergies: profile.allergies,
    type: filter,
    favourites: profile.favouriteRecipes,
  });
  const suggest = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setThinking(true);
    setNote("");
    setIdeas([]);
    try {
      const final = await suggestRecipes(context(), setIdeas, controller.signal);
      setIdeas(final);
      if (!final.length) setNote("I couldn’t come up with anything good. Try again?");
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.kind === "limit") onLimit();
      else setNote("I can’t reach the kitchen right now.");
      setIdeas(null);
    } finally {
      setThinking(false);
    }
  };
  const close = () => {
    request.current?.abort();
    onClose();
  };
  if (open) {
    const amount = perServings(open, servings);
    const favourite = profile.favouriteRecipes.includes(open.id);
    return (
      <SheetShell scene={scene} title={open.name} closeLabel="Close recipe" onClose={() => setOpen(null)} zIndex={46}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <FoodSticker kind={open.type} size={84} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 34, fontWeight: "600", letterSpacing: -1, color: theme.ink, fontVariant: ["tabular-nums"] }}>
              {amount.kcal.toLocaleString()}
              <Text style={{ fontSize: 15, fontWeight: "400", color: theme.muted }}> kcal</Text>
            </Text>
            <Text style={{ fontSize: 14, color: theme.muted }}>
              {amount.protein} g protein · {amount.carbs} g carbs · {amount.fat} g fat
            </Text>
            <Text style={{ fontSize: 14, color: theme.muted }}>
              About {amount.grams} g · {open.minutes} min
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20 }}>
          <Text style={{ fontSize: 17, color: theme.ink }}>Servings</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Touch
              label="Fewer servings"
              disabled={servings <= 0.5}
              onPress={() => setServings((n) => Math.max(0.5, n - 0.5))}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", opacity: servings <= 0.5 ? 0.4 : 1 }}
            >
              <Symbol name="minus" size={15} color={theme.ink} />
            </Touch>
            <Text style={{ fontSize: 20, fontWeight: "500", color: theme.ink, minWidth: 34, textAlign: "center", fontVariant: ["tabular-nums"] }}>
              {servings}
            </Text>
            <Touch
              label="More servings"
              disabled={servings >= 6}
              onPress={() => setServings((n) => Math.min(6, n + 0.5))}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", opacity: servings >= 6 ? 0.4 : 1 }}
            >
              <Symbol name="plus" size={15} color={theme.ink} />
            </Touch>
          </View>
        </View>
        <Gap size={20} />
        <PrimaryButton
          label="Log this"
          onPress={() => {
            onLog({ name: open.name, kcal: amount.kcal, protein: amount.protein, carbs: amount.carbs, fat: amount.fat, type: open.type });
            setOpen(null);
            close();
          }}
        />
        <TextLink
          label={favourite ? "Remove from favourites" : "Add to favourites"}
          tone="ink"
          onPress={() =>
            useProfile.getState().save({
              favouriteRecipes: favourite
                ? profile.favouriteRecipes.filter((id) => id !== open.id)
                : [...profile.favouriteRecipes, open.id],
            })
          }
        />
        <Note>
          Nutrition from USDA FoodData Central, for the weights in this recipe. Check labels if you have an allergy.
        </Note>
      </SheetShell>
    );
  }
  return (
    <SheetShell scene={scene} title="Recipes" closeLabel="Close recipes" onClose={close} zIndex={46}>
      <TextInput
        accessibilityLabel="Search recipes"
        placeholder="Search"
        placeholderTextColor={theme.faint}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        style={{ height: 46, borderRadius: 23, backgroundColor: "#FFFFFF", paddingHorizontal: 18, fontSize: 16, color: theme.ink }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
        {filters.map((item) => {
          const on = filter === item;
          return (
            <Touch key={item} label={item} selected={on} expand onPress={() => setFilter(on ? undefined : item)}>
              <Selectable selected={on} style={{ height: 38, borderRadius: 19, paddingHorizontal: 15, justifyContent: "center" }}>
                <SelectableText style={{ fontSize: 14, fontWeight: "500" }}>{item}</SelectableText>
              </Selectable>
            </Touch>
          );
        })}
      </ScrollView>
      {apiConfigured && (
        <View style={{ marginTop: 12 }}>
          <TextLink label={thinking ? "Thinking…" : "Suggest something for the rest of today"} tone="ink" onPress={() => void suggest()} />
          {ideas?.map((idea) => (
            <Touch
              key={idea.name}
              label={`Log ${idea.name}, ${idea.kcal} kilocalories`}
              onPress={() => {
                onLog({ name: idea.name, kcal: idea.kcal, protein: idea.protein, carbs: idea.carbs, fat: idea.fat, type: filter && filter !== "Favourites" ? filter : "Dinner" });
                close();
              }}
            >
              <View style={{ borderRadius: 18, backgroundColor: "#FFFDF4", padding: 14, marginBottom: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: theme.ink }}>{idea.name}</Text>
                <Text style={{ fontSize: 13, color: theme.muted }}>
                  {idea.kcal} kcal · {idea.protein} g protein · {idea.minutes} min · an estimate, tap to log
                </Text>
              </View>
            </Touch>
          ))}
          {!!note && <Note>{note}</Note>}
        </View>
      )}
      <Gap />
      {list.length === 0 && <Note>{filter === "Favourites" ? "Nothing saved yet." : "Nothing fits that. Try fewer filters."}</Note>}
      {list.map((recipe, index) => (
        <Animated.View
          key={recipe.id}
          entering={scene.reduced || index >= MAX_STAGGERED ? undefined : FadeInDown.delay(index * 30).duration(220)}
        >
          <Touch
            label={`${recipe.name}, ${recipe.kcal} kilocalories, ${recipe.minutes} minutes`}
            onPress={() => {
              setServings(1);
              setOpen(recipe);
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, borderCurve: "continuous", backgroundColor: "#FFFFFF", padding: 12, marginBottom: 8 }}>
              <FoodSticker kind={recipe.type} size={46} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "500", color: theme.ink }}>{recipe.name}</Text>
                <Text style={{ fontSize: 13, color: theme.muted }}>
                  {recipe.kcal} kcal · {recipe.protein} g protein · {recipe.minutes} min
                </Text>
              </View>
              <Symbol name="chevron.right" size={12} color={theme.faint} />
            </View>
          </Touch>
        </Animated.View>
      ))}
    </SheetShell>
  );
}
