/**
 * react-native-web's Alert.alert does nothing, so on the web app (iPhone and
 * desktop browsers) confirmations, error messages and "OK → go to next screen"
 * buttons were silently skipped. This gives Alert a browser version:
 *   - no buttons, or one button: window.alert, then run that button
 *   - a Cancel button plus one action: window.confirm (OK = the action)
 *   - several actions: window.confirm for the first action (Cancel otherwise)
 * Imported once from app/_layout.tsx. Native platforms are untouched.
 */
import { Alert, Platform } from "react-native";
import type { AlertButton } from "react-native";

if (Platform.OS === "web" && typeof window !== "undefined") {
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join("\n\n");
    const list = buttons ?? [];
    const cancel = list.find((b) => b.style === "cancel");
    const actions = list.filter((b) => b.style !== "cancel");

    if (!cancel) {
      window.alert(text);
      actions[0]?.onPress?.();
      return;
    }
    const first = actions[0];
    const prompt = first ? `${text}\n\nOK = ${first.text ?? "Continue"}` : text;
    if (first && window.confirm(prompt)) first.onPress?.();
    else cancel.onPress?.();
  };
}
