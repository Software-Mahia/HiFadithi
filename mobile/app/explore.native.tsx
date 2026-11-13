/** Native /explore: the same onboarding shown on the home screen. Visitors land
 * here from "Continue as guest" and from the signed-out gallery redirect.
 * The web version is app/explore.tsx. */
import { Onboarding } from "../src/native/onboarding";

export default function ExploreScreen() {
  return <Onboarding />;
}
