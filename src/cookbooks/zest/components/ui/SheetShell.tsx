import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, {
  FadeOut,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { GlassSurface } from "./GlassSurface";
import { GlassButton } from "./GlassButton";
import { theme } from "../../theme";
import type { Scene } from "../../hooks/useScene";

const OPEN = { damping: 26, stiffness: 180, mass: 0.9 };

/**
 * The glass sheet every secondary screen uses: the same edge as the profile and
 * the calendar, so the lemon sits on it the same way. It slides on a spring and
 * can be interrupted; Reduce Motion puts it in place at once.
 */
export function SheetShell({
  scene,
  title,
  closeLabel,
  closeAfterMs = 0,
  onClose,
  zIndex = 40,
  children,
}: React.PropsWithChildren<{
  scene: Scene;
  title?: string;
  closeLabel: string;
  /** A soft paywall shows its way out after a moment, never immediately. */
  closeAfterMs?: number;
  onClose: () => void;
  zIndex?: number;
}>) {
  const panelTop = Math.max(180, scene.height - 616);
  const travel = scene.height - panelTop + 20;
  const y = useSharedValue(scene.reduced ? 0 : travel);
  const [closable, setClosable] = useState(closeAfterMs === 0);
  useEffect(() => {
    if (!scene.reduced) y.set(withSpring(0, OPEN));
  }, [scene.reduced, y]);
  useEffect(() => {
    if (closeAfterMs === 0) return;
    const timer = setTimeout(() => setClosable(true), closeAfterMs);
    return () => clearTimeout(timer);
  }, [closeAfterMs]);
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: y.get() }],
  }));
  return (
    <View
      accessibilityViewIsModal
      pointerEvents="box-none"
      style={{ position: "absolute", inset: 0, zIndex }}
    >
      {closable && (
        <Animated.View
          exiting={scene.reduced ? undefined : FadeOut.duration(120)}
          style={{ position: "absolute", top: scene.top, right: 18 }}
        >
          <GlassButton name="xmark" label={closeLabel} onPress={onClose} />
        </Animated.View>
      )}
      <Animated.View
        exiting={scene.reduced ? undefined : SlideOutDown.duration(240)}
        style={[
          {
            position: "absolute",
            top: panelTop,
            left: 16,
            right: 16,
            height: scene.height - panelTop - scene.bottom - 16,
          },
          slide,
        ]}
      >
        <GlassSurface style={{ flex: 1, borderRadius: 36 }}>
          <View style={{ flex: 1, borderRadius: 36, overflow: "hidden" }}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: 22,
                paddingBottom: 30,
              }}
            >
              {!!title && (
                <Text
                  accessibilityRole="header"
                  maxFontSizeMultiplier={1.4}
                  style={{
                    fontSize: 28,
                    lineHeight: 33,
                    fontWeight: "600",
                    letterSpacing: -0.9,
                    color: theme.ink,
                    marginBottom: 14,
                  }}
                >
                  {title}
                </Text>
              )}
              {children}
            </ScrollView>
          </View>
        </GlassSurface>
      </Animated.View>
    </View>
  );
}
