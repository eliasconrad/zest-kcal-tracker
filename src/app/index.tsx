import { useLocalSearchParams } from "expo-router";
import { ZestScreen } from "../cookbooks/zest/screens/ZestScreen";
import { HelperGallery } from "../cookbooks/zest/components/helpers/HelperGallery";

/** The root is the product, with no collection route or back control. */
export default function Index() {
  const { demo, gallery, swapbar } = useLocalSearchParams<{
    demo?: string;
    gallery?: string;
    swapbar?: string;
  }>();
  // `?gallery=1` shows every helper in every frame, for review only.
  if (gallery === "1") return <HelperGallery />;
  return (
    <ZestScreen key={demo ?? "diary"} demo={demo === "1"} debugSwapBar={swapbar === "1"} />
  );
}
