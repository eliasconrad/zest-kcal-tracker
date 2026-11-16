import { Image } from "expo-image";
import { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const frames = {
  rest: require("../../../../assets/cookbooks/zest/mascot/rest.svg"),
  wink: require("../../../../assets/cookbooks/zest/mascot/wink.svg"),
  grin: require("../../../../assets/cookbooks/zest/mascot/grin.svg"),
  curious: require("../../../../assets/cookbooks/zest/mascot/curious.svg"),
  jump: require("../../../../assets/cookbooks/zest/mascot/jump.svg"),
  sleep: require("../../../../assets/cookbooks/zest/mascot/sleep.svg"),
  peek: require("../../../../assets/cookbooks/zest/mascot/peek.svg"),
  leap: require("../../../../assets/cookbooks/zest/mascot/leap.svg"),
  face: require("../../../../assets/cookbooks/zest/mascot/face.svg"),
  flame: require("../../../../assets/cookbooks/zest/mascot/flame.svg"),
  chest: require("../../../../assets/cookbooks/zest/mascot/chest.svg"),
};

export type MascotPose = keyof typeof frames;

/**
 * One frame of Zest's lemon. The pose is the expression. Jump and leap
 * leave the ground; everything else stays still when Reduce Motion is on.
 */
export function Mascot({
  pose = "rest",
  size = 72,
  reduced = false,
}: {
  pose?: MascotPose;
  size?: number;
  reduced?: boolean;
}) {
  const lift = useSharedValue(0);
  useEffect(() => {
    if (reduced || (pose !== "jump" && pose !== "leap")) {
      lift.set(0);
      return;
    }
    lift.set(
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 280 }),
          withTiming(0, { duration: 280 }),
        ),
        -1,
        false,
      ),
    );
  }, [lift, pose, reduced]);
  const motion = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.get() }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size }, motion]}
    >
      <Image
        source={frames[pose]}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    </Animated.View>
  );
}
