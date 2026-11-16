import { useEffect } from "react";
import { Text, View } from "react-native";
import { Canvas, LinearGradient, RoundedRect, vec } from "@shopify/react-native-skia";
import { useVideoPlayer, VideoView } from "expo-video";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { theme } from "../../theme";

/** One take of the real app: a photo, the calories arriving, a correction. See docs/ASSET_PROVENANCE.md. */
const demo = require("../../../../../assets/onboarding/how-it-works.mp4");

/**
 * An iPhone 17 Pro in points of its own screen: 402 wide, 874 tall, screen corners
 * of 62, about 10 from the glass to the outer edge, of which 3 are the metal band.
 */
const DEVICE = { screenWidth: 402, screenRadius: 62, edge: 10, band: 3, nub: 2 };

/** The body, drawn: brushed metal band, black border round the glass, and the buttons. */
function IPhoneBody({
  unit,
  screenWidth,
  screenHeight,
}: {
  unit: number;
  screenWidth: number;
  screenHeight: number;
}) {
  const nub = DEVICE.nub * unit;
  const edge = DEVICE.edge * unit;
  const width = screenWidth + edge * 2;
  const height = screenHeight + edge * 2;
  const outer = (DEVICE.screenRadius + DEVICE.edge) * unit;
  const band = DEVICE.band * unit;
  const metal = ["#5E5F62", "#C8C9CB", "#8B8C8F", "#8B8C8F", "#D5D6D8", "#5E5F62"];
  const stops = [0, 0.012, 0.03, 0.97, 0.988, 1];
  const button = (side: "left" | "right", y: number, length: number) => (
    <RoundedRect
      x={side === "left" ? 0 : nub + width - unit}
      y={y * unit}
      width={nub + unit}
      height={length * unit}
      r={1.2 * unit}
      color="#77787B"
    />
  );
  return (
    <Canvas
      pointerEvents="none"
      style={{ position: "absolute", left: 0, top: 0, width: width + nub * 2, height }}
    >
      {button("left", 178, 34)}
      {button("left", 240, 62)}
      {button("left", 316, 62)}
      {button("right", 270, 98)}
      {button("right", 560, 60)}
      <RoundedRect x={nub} y={0} width={width} height={height} r={outer}>
        <LinearGradient
          start={vec(nub, 0)}
          end={vec(nub + width, 0)}
          colors={metal}
          positions={stops}
        />
      </RoundedRect>
      <RoundedRect
        x={nub + band}
        y={band}
        width={width - band * 2}
        height={height - band * 2}
        r={outer - band}
        color="#050506"
      />
      <RoundedRect
        x={nub + band * 0.5}
        y={band * 0.5}
        width={width - band}
        height={height - band}
        r={outer - band * 0.5}
        color="#FFFFFF33"
        style="stroke"
        strokeWidth={Math.max(0.5, unit * 0.6)}
      />
    </Canvas>
  );
}

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
  const screenHeight = Math.max(240, height);
  const screenWidth = screenHeight * (1206 / 2622);
  const unit = screenWidth / DEVICE.screenWidth;
  return (
    <View style={{ alignItems: "center" }}>
      <Animated.View
        accessible
        accessibilityRole="image"
        accessibilityLabel="Zest in use: a photo of a meal, the calories appear, and a typed correction updates them."
        style={[
          {
            width: screenWidth + (DEVICE.edge + DEVICE.nub) * 2 * unit,
            height: screenHeight + DEVICE.edge * 2 * unit,
          },
          phone,
        ]}
      >
        <IPhoneBody unit={unit} screenWidth={screenWidth} screenHeight={screenHeight} />
        <View
          style={{
            position: "absolute",
            left: (DEVICE.edge + DEVICE.nub) * unit,
            top: DEVICE.edge * unit,
            width: screenWidth,
            height: screenHeight,
            borderRadius: DEVICE.screenRadius * unit,
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
