import { View } from "react-native";
import { isHelperId } from "../cookbooks/zest/data/helpers";
import { StaticHelper } from "../cookbooks/zest/components/helpers/StaticHelper";
import { StreakCelebration } from "../cookbooks/zest/components/Streak";
import { useLocalSearchParams } from "expo-router";
import { ZestScreen } from "../cookbooks/zest/screens/ZestScreen";
import { HelperGallery } from "../cookbooks/zest/components/helpers/HelperGallery";

/** The root is the product, with no collection route or back control. */
export default function Index() {
  const { demo, friend, gallery, icon, streak } = useLocalSearchParams<{
    demo?: string;
    friend?: string;
    gallery?: string;
    icon?: string;
    streak?: string;
  }>();
  // `?icon=fig` draws one mascot as its app icon art, for scripts/render-icons.sh.
  if (isHelperId(icon))
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F3F3F0",
        }}
      >
        <StaticHelper id={icon} size={300} />
      </View>
    );
  // `?streak=1` replays the celebration, for measuring it against the reference.
  if (streak === "1")
    return (
      <StreakCelebration
        from={0}
        to={1}
        loggedWeek={[false, false, false, false, true, false, false]}
        reduced={false}
        onDone={() => {}}
      />
    );
  // `?gallery=1` shows every helper in every frame, for review only.
  if (gallery === "1") return <HelperGallery />;
  return (
    <ZestScreen
      key={demo ?? "diary"}
      demo={demo === "1"}
      inviteCode={friend}
    />
  );
}
