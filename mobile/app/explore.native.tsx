/** Native /explore: the same one-scroll story as the home screen, opened at the
 * story section (skipping the hero). Visitors land here from "Continue as guest"
 * and from the signed-out gallery redirect. The web version is app/explore.tsx. */
import { StoryHome } from "../src/native/StoryHome";

export default function ExploreScreen() {
  return <StoryHome startAt="story" />;
}
