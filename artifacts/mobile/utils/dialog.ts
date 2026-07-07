import { Alert, AlertButton, Platform } from "react-native";

/**
 * Drop-in replacement for Alert.alert that also works on web, where
 * react-native-web's Alert is not implemented (calls are silent no-ops —
 * so confirmations and error messages never appear in the browser).
 *
 * Native: delegates to Alert.alert unchanged.
 * Web:
 *  - 0-1 buttons -> window.alert
 *  - exactly 2 buttons (one of which may be "cancel") -> window.confirm,
 *    where OK triggers the non-cancel button and Cancel the cancel button.
 *  - 3+ buttons -> a sequence of window.confirm prompts, one per non-cancel
 *    action (in order), so every action remains reachable instead of only
 *    the first one. Confirming a prompt runs that action; dismissing it
 *    moves on to ask about the next action. If a cancel button exists,
 *    dismissing every prompt runs the cancel action.
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[]
): void {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const cancelBtn = buttons.find((b) => b.style === "cancel");
  const actionBtns = buttons.filter((b) => b.style !== "cancel");

  if (actionBtns.length <= 1) {
    if (window.confirm(text)) {
      actionBtns[0]?.onPress?.();
    } else {
      cancelBtn?.onPress?.();
    }
    return;
  }

  // 3+ buttons: window.confirm can't present multiple choices at once, so
  // ask about each non-cancel action in turn until one is confirmed.
  for (const btn of actionBtns) {
    const prompt = `${text}\n\n${btn.text ?? "OK"}?`;
    if (window.confirm(prompt)) {
      btn.onPress?.();
      return;
    }
  }
  cancelBtn?.onPress?.();
}
