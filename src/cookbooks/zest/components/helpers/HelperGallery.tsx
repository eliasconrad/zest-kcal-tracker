import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StaticHelper } from "./StaticHelper";
import { frameIds } from "./frames";
import { helperList } from "../../data/helpers";
import { theme } from "../../theme";

/** Milliseconds per frame when the gallery plays its frames in turn. */
export const GALLERY_FRAME_MS = 350;
/** Fixed row height while animating, so a recording can be cut per helper. */
export const GALLERY_ROW = 128;

/**
 * Every helper in every frame, for review and for the docs screenshot.
 * Opened with `?gallery=1`; `&animate=1` plays the seven frames in turn, one
 * big drawing per helper in rows of a fixed height, so a screen recording
 * cuts into one animated image per helper. Never linked from the product.
 */
export function HelperGallery({ animate = false }: { animate?: boolean }) {
  const insets = useSafeAreaInsets();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!animate) return;
    const id = setInterval(() => setTick((t) => t + 1), GALLERY_FRAME_MS);
    return () => clearInterval(id);
  }, [animate]);
  if (animate) {
    const frame = frameIds[tick % frameIds.length];
    return (
      <View
        accessibilityLabel={`Frame ${frame}`}
        style={{ flex: 1, backgroundColor: theme.paper, paddingTop: insets.top + 12 }}
      >
        {helperList.map((helper) => (
          <View
            key={helper.id}
            style={{ height: GALLERY_ROW, flexDirection: "row", alignItems: "center", paddingLeft: 16, gap: 18 }}
          >
            <StaticHelper id={helper.id} size={120} frame={frame} />
            <View>
              <Text style={{ fontSize: 22, fontWeight: "600", letterSpacing: -0.5, color: theme.ink }}>
                {helper.name}
              </Text>
              <Text style={{ fontSize: 14, color: theme.muted }}>
                the {helper.species} · {helper.role}
              </Text>
              <Text style={{ fontSize: 13, color: theme.faint, marginTop: 6 }}>{frame}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }
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
