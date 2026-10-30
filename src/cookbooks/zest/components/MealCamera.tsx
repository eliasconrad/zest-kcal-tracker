import { useEffect, useRef, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  StatusBar,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { File, Paths } from "expo-file-system";
import { GlassSurface } from "./ui/GlassSurface";
import { GlassButton } from "./ui/GlassButton";
import { Touch, Symbol } from "./ui/Touch";
import { Selectable, SelectableText } from "./ui/Selectable";
import { stickerSource } from "./Stickers";
import { MealImage } from "../data/photos";
import { theme } from "../theme";
import { defaultMealType, mealTypes, type MealPhoto, type MealType } from "../data/diary";

/**
 * Zest's own camera, in place of the system picker: the plate is centred in a
 * rounded viewfinder with a ring guide, the meal (breakfast, lunch, dinner,
 * snack) is picked right under the finder, and the shutter, library and flash
 * sit where every food camera puts them (Cal AI, YAZIO, BitePal). The sample
 * source shows the bundled dinner plate instead of a live feed, for the demo
 * and for simulators without a camera.
 */
export function MealCamera({
  source,
  usualMeals,
  onClose,
  onUse,
  onLibrary,
}: {
  source: "live" | "sample";
  usualMeals?: MealType[];
  onClose: () => void;
  onUse: (photo: MealPhoto, type: MealType) => void;
  onLibrary: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const safe = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [type, setType] = useState<MealType>(() =>
    source === "sample" ? "Dinner" : defaultMealType(new Date(), usualMeals),
  );
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [flash, setFlash] = useState(false);
  const [shot, setShot] = useState<MealPhoto | null>(null);
  const [taking, setTaking] = useState(false);
  const flashOverlay = useSharedValue(0);
  const guide = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOverlay.get() }));
  // The ring breathes until the first shot, so the eye lands on the plate.
  const guideStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + guide.get() * 0.45,
    transform: [{ scale: 1 + guide.get() * 0.018 }],
  }));
  useEffect(() => {
    guide.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      ),
    );
  }, [guide]);
  useEffect(() => {
    if (source !== "live" || !permission || permission.granted) return;
    if (permission.canAskAgain) void requestPermission();
  }, [source, permission, requestPermission]);
  // A feed that never reports ready (a simulator, a broken camera) stops
  // pretending after a moment and offers the plate and the library instead.
  useEffect(() => {
    if (source !== "live" || ready || !permission?.granted) return;
    const timer = setTimeout(() => setUnavailable(true), 4000);
    return () => clearTimeout(timer);
  }, [source, ready, permission]);

  const finderWidth = width - 28;
  const finderHeight = Math.min(
    (finderWidth * 4) / 3,
    height - safe.top - safe.bottom - 262,
  );
  const ring = Math.min(finderWidth, finderHeight) * 0.68;
  const granted = source === "sample" || !!permission?.granted;
  const denied = source === "live" && !!permission && !permission.granted;
  const live = source === "live" && granted && !unavailable;

  const capture = async () => {
    if (shot || taking) return;
    if (source === "sample") {
      flashOverlay.set(
        withSequence(
          withTiming(0.8, { duration: 55 }),
          withTiming(0, { duration: 130 }),
        ),
      );
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShot({ sample: true, asset: "dinner" });
      return;
    }
    if (!ready || !camera.current) return;
    setTaking(true);
    flashOverlay.set(
      withSequence(
        withTiming(0.8, { duration: 55 }),
        withTiming(0, { duration: 130 }),
      ),
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.85 });
      const local = new File(Paths.document, `zest-meal-${Date.now()}.jpg`);
      new File(picture.uri).copy(local);
      setShot({ uri: local.uri, sample: false });
    } catch {
      setUnavailable(true);
    } finally {
      setTaking(false);
    }
  };
  const pick = (next: MealType) => {
    if (next === type) return;
    setType(next);
    void Haptics.selectionAsync();
  };
  const label = type.toLowerCase();

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1, backgroundColor: theme.paper }}>
        <View
          style={{
            marginTop: safe.top + 4,
            paddingHorizontal: 18,
            height: 48,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <GlassButton name="xmark" label="Close camera" onPress={onClose} />
          <Text
            accessibilityRole="header"
            style={{ fontSize: 17, fontWeight: "500", color: theme.ink }}
          >
            {shot ? "Your plate" : `Log ${label}`}
          </Text>
          {live && !shot ? (
            <GlassButton
              name={flash ? "bolt.fill" : "bolt.slash"}
              label={flash ? "Flash on" : "Flash off"}
              onPress={() => setFlash((f) => !f)}
            />
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        <View
          accessible={!shot}
          accessibilityLabel={
            shot
              ? `Captured ${label} photo`
              : live
                ? `Camera viewfinder. Centre the plate in the ring`
                : `Sample plate. Centre the plate in the ring`
          }
          style={{
            marginTop: 14,
            marginHorizontal: 14,
            width: finderWidth,
            height: finderHeight,
            borderRadius: 28,
            borderCurve: "continuous",
            overflow: "hidden",
            backgroundColor: "#1B1C18",
          }}
        >
          {shot ? (
            shot.sample ? (
              <MealImage
                photo={shot}
                contentFit="cover"
                transition={0}
                style={{ width: finderWidth, height: finderHeight }}
              />
            ) : (
              <Image
                source={{ uri: shot.uri }}
                contentFit="cover"
                transition={120}
                style={{ width: finderWidth, height: finderHeight }}
              />
            )
          ) : source === "sample" ? (
            <MealImage
              photo={{ sample: true, asset: "dinner" }}
              contentFit="cover"
              transition={0}
              onDisplay={() => setReady(true)}
              style={{ width: finderWidth, height: finderHeight }}
            />
          ) : live ? (
            <CameraView
              ref={camera}
              facing="back"
              flash={flash ? "on" : "off"}
              animateShutter={false}
              onCameraReady={() => setReady(true)}
              onMountError={() => setUnavailable(true)}
              style={{ width: finderWidth, height: finderHeight }}
            />
          ) : null}

          {!shot && (
            <Animated.View
              pointerEvents="none"
              exiting={FadeOut.duration(160)}
              style={{
                position: "absolute",
                inset: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Animated.View
                style={[
                  {
                    width: ring,
                    height: ring,
                    borderRadius: ring / 2,
                    borderWidth: 1.5,
                    borderColor: "#FFFFFF",
                  },
                  guideStyle,
                ]}
              />
              {[0, 90, 180, 270].map((deg) => (
                <View
                  key={deg}
                  style={{
                    position: "absolute",
                    width: 2,
                    height: 12,
                    borderRadius: 1,
                    backgroundColor: theme.soft,
                    transform: [
                      { rotate: `${deg}deg` },
                      { translateY: -(ring / 2 + 10) },
                    ],
                  }}
                />
              ))}
              {(ready || source === "sample") && (
                <Animated.View
                  entering={FadeIn.delay(300).duration(260)}
                  style={{
                    position: "absolute",
                    bottom: 22,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 16,
                    backgroundColor: "rgba(27, 28, 24, 0.62)",
                  }}
                >
                  <Text style={{ fontSize: 13, color: "#FFFFFF" }}>
                    Centre the plate, then tap the shutter.
                  </Text>
                </Animated.View>
              )}
            </Animated.View>
          )}

          {(denied || unavailable) && !shot && (
            <View
              style={{
                position: "absolute",
                inset: 0,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 28,
                backgroundColor: "#1B1C18",
              }}
            >
              <Symbol name="camera.metering.none" size={30} color="#FFFFFF" />
              <Text
                style={{
                  marginTop: 14,
                  fontSize: 17,
                  fontWeight: "500",
                  color: "#FFFFFF",
                  textAlign: "center",
                }}
              >
                {denied ? "Zest can’t see the plate yet." : "No camera here."}
              </Text>
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 14,
                  lineHeight: 19,
                  color: "#C9CAC2",
                  textAlign: "center",
                }}
              >
                {denied
                  ? "Allow the camera in Settings, or pick a photo from your library."
                  : "Pick a photo from your library instead."}
              </Text>
              {denied && (
                <Touch
                  label="Open Settings"
                  onPress={() => void Linking.openSettings()}
                  style={{ marginTop: 16, minHeight: 44, justifyContent: "center" }}
                >
                  <Text
                    style={{ fontSize: 15, fontWeight: "600", color: theme.soft }}
                  >
                    Open Settings
                  </Text>
                </Touch>
              )}
            </View>
          )}
          <Animated.View
            pointerEvents="none"
            style={[
              { position: "absolute", inset: 0, backgroundColor: "white" },
              flashStyle,
            ]}
          />
        </View>

        {/* The meal is chosen here, not in a question afterwards. */}
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            marginTop: 16,
            marginHorizontal: 14,
          }}
        >
          {mealTypes.map((option) => {
            const selected = option === type;
            return (
              <Touch
                key={option}
                label={option}
                selected={selected}
                onPress={() => pick(option)}
                expand
                style={{ flex: 1 }}
              >
                <Selectable
                  selected={selected}
                  style={{
                    height: 46,
                    borderRadius: 23,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  {/* A plain image: a wrapper marked hidden for assistive tech
                      takes the whole chip out of the iOS accessibility tree. */}
                  <Image
                    source={stickerSource(option)}
                    accessible={false}
                    contentFit="contain"
                    transition={0}
                    style={{ width: 20, height: 20 }}
                  />
                  <SelectableText
                    numberOfLines={1}
                    style={{ fontSize: 13, fontWeight: "500" }}
                  >
                    {option}
                  </SelectableText>
                </Selectable>
              </Touch>
            );
          })}
        </View>

        <View
          style={{
            position: "absolute",
            bottom: safe.bottom + 28,
            left: 32,
            right: 32,
            height: 76,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {shot ? (
            <>
              <Touch
                label="Retake meal photo"
                onPress={() => setShot(null)}
                expand
              >
                <GlassSurface
                  interactive
                  style={{
                    height: 50,
                    borderRadius: 25,
                    paddingHorizontal: 19,
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 16, color: theme.ink }}>Retake</Text>
                </GlassSurface>
              </Touch>
              <Touch
                label="Use meal photo"
                onPress={() => onUse(shot, type)}
                expand
              >
                <View
                  style={{
                    height: 50,
                    borderRadius: 25,
                    paddingHorizontal: 22,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 9,
                    backgroundColor: theme.heavy,
                  }}
                >
                  <Symbol name="checkmark" size={16} color={theme.onHeavy} />
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: theme.onHeavy,
                    }}
                  >
                    Log {label}
                  </Text>
                </View>
              </Touch>
            </>
          ) : (
            <>
              <Touch
                label="Open photo library from camera"
                onPress={onLibrary}
                style={{
                  width: 48,
                  height: 48,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 46,
                    padding: 2,
                    borderRadius: 10,
                    backgroundColor: "white",
                    transform: [{ rotate: "-5deg" }],
                  }}
                >
                  <MealImage
                    photo={{ sample: true, asset: "lunch" }}
                    contentFit="cover"
                    style={{ flex: 1, borderRadius: 8 }}
                  />
                </View>
              </Touch>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Take ${label} photo`}
                accessibilityState={{ disabled: !ready && source === "live" }}
                onPress={() => void capture()}
                style={({ pressed }) => ({
                  width: 76,
                  height: 76,
                  borderRadius: 38,
                  borderWidth: 2,
                  borderColor: theme.ink,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: ready || source === "sample" ? 1 : 0.45,
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                })}
              >
                <View
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: 31,
                    backgroundColor: theme.ink,
                  }}
                />
              </Pressable>
              <View style={{ width: 48 }} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
