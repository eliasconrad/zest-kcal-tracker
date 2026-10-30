import { useEffect } from "react";
import { Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { theme } from "../../theme";

/** A real recording of the app: a photo, the calories arriving, a correction. See docs/ASSET_PROVENANCE.md. */
const demo = require("../../../../../assets/onboarding/how-it-works.mp4");

/**
 * The first screen shows the product before it asks anything. As in Cal AI's
 * welcome, the phone slides in tilted from the lower right and straightens.
 * Without motion the phone holds its first frame.
 */
export function Intro({ height }: { height: number }) {
  const reduced = useReducedMotion();
  const player = useVideoPlayer(demo, (video) => {
    video.loop = true;
    video.muted = true;
    if (!reduced) video.play();
  });
  const arrive = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    arrive.set(withDelay(120, withSpring(1, { duration: 800, dampingRatio: 0.82 })));
  }, [arrive, reduced]);
  const phone = useAnimatedStyle(() => ({
    opacity: Math.min(1, arrive.get() * 3),
    transform: [
      { translateX: (1 - arrive.get()) * 120 },
      { translateY: (1 - arrive.get()) * 220 },
      { rotate: `${(1 - arrive.get()) * 14}deg` },
      { scale: 0.86 + arrive.get() * 0.14 },
    ],
  }));
  const phoneHeight = Math.max(240, height);
  const phoneWidth = phoneHeight * (1206 / 2622);
  return (
    <View style={{ alignItems: "center" }}>
      <Animated.View
        accessible
        accessibilityRole="image"
        accessibilityLabel="Zest in use: a photo of a meal, the calories appear, and a spoken correction updates them."
        style={[
          {
            width: phoneWidth + 10,
            height: phoneHeight + 10,
            padding: 5,
            borderRadius: 40,
            borderCurve: "continuous",
            backgroundColor: theme.ink,
            boxShadow: "0 18px 40px rgba(37, 39, 32, 0.22)",
          },
          phone,
        ]}
      >
        <View
          style={{
            flex: 1,
            borderRadius: 35,
            borderCurve: "continuous",
            overflow: "hidden",
            backgroundColor: theme.paper,
          }}
        >
          <VideoView
            player={player}
            nativeControls={false}
            contentFit="cover"
            allowsPictureInPicture={false}
            style={{ flex: 1 }}
          />
        </View>
      </Animated.View>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.4}
        style={{
          marginTop: 22,
          fontSize: 30,
          lineHeight: 35,
          fontWeight: "700",
          letterSpacing: -1,
          textAlign: "center",
          color: theme.ink,
        }}
      >
        Snap it. Zest does the sums.
      </Text>
      <Text
        style={{
          marginTop: 8,
          fontSize: 16,
          lineHeight: 22,
          textAlign: "center",
          color: theme.muted,
        }}
      >
        Take a photo, see the calories, and fix anything just by saying it.
      </Text>
    </View>
  );
}
