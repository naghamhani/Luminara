import { router } from "expo-router";

/**
 * Navigate back, falling back to `fallbackHref` when there's nothing left to
 * pop. router.back() with an empty history stack silently no-ops (only
 * logging a dev warning), leaving the user stuck looking at an unresponsive
 * back/close button — this happens whenever a screen is reached without a
 * normal push (deep link, hard refresh on web, or after a stack reset like
 * "Reset App Data").
 */
export function goBack(fallbackHref: string = "/(tabs)"): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackHref as never);
  }
}
