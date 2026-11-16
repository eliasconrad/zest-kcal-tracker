import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StaticHelper } from "./StaticHelper";
import { frameIds } from "./frames";
import { helperList } from "../../data/helpers";
import { theme } from "../../theme";

/**
 * Every helper in every frame, for review and for the docs screenshot.
 * Opened with `?gallery=1`; never linked from the product.
 */
export function HelperGallery() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
    >
      <Text style={{ fontSize: 28, fontWeight: "600", letterSpacing: -0.9, color: theme.ink }}>
        Six helpers, seven frames
      </Text>
      <Text style={{ fontSize: 14, color: theme.muted, marginTop: 4, marginBottom: 14 }}>
        {frameIds.join(" · ")}
      </Text>
      {helperList.map((helper) => (
        <View key={helper.id} style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text style={{ fontSize: 17, fontWeight: "600", color: theme.ink }}>{helper.name}</Text>
            <Text style={{ fontSize: 13, color: theme.muted }}>
              the {helper.species} · {helper.role}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
            {frameIds.map((frame) => (
              <StaticHelper key={frame} id={helper.id} size={50} frame={frame} />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
