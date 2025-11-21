import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { canUseMobileAds, loadGoogleMobileAds } from "../utils/googleMobileAds";

const IOS_TEST_INTERSTITIAL = "ca-app-pub-3940256099942544/4411468910";

export default function useInterstitialAd({
  iosAdUnitId,
  androidAdUnitId,
  screenName = "default",
  autoShow = false,
  showDelayMs = 400,
  enabled = true,
  requestOptions = null,
} = {}) {
  const adRef = useRef(null);
  const unsubscribersRef = useRef([]);
  const hasShownRef = useRef(false);
  const showTimerRef = useRef(null);

  const [status, setStatus] = useState(enabled ? "idle" : "disabled");
  const [error, setError] = useState(null);

  const mergedRequestOptions = useMemo(
    () => ({
      requestNonPersonalizedAdsOnly: true,
      ...(requestOptions || {}),
    }),
    [requestOptions],
  );

  const cleanup = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    unsubscribersRef.current.forEach((unsub) => {
      try {
        unsub && unsub();
      } catch {
        /* noop */
      }
    });
    unsubscribersRef.current = [];
    adRef.current = null;
  }, []);

  const loadAd = useCallback(async () => {
    if (!enabled) {
      setStatus("disabled");
      return;
    }
    if (!canUseMobileAds) {
      setStatus("unsupported");
      return;
    }

    cleanup();
    setError(null);
    setStatus("loading");

    try {
      const { InterstitialAd, TestIds, AdEventType } =
        await loadGoogleMobileAds();
      const adUnitId = __DEV__
        ? Platform.OS === "ios"
          ? IOS_TEST_INTERSTITIAL
          : TestIds.INTERSTITIAL
        : Platform.OS === "ios"
          ? iosAdUnitId
          : androidAdUnitId;

      if (!adUnitId) {
        setStatus("error");
        setError(new Error("Missing interstitial ad unit ID"));
        return;
      }

      const interstitial = InterstitialAd.createForAdRequest(
        adUnitId,
        mergedRequestOptions,
      );
      adRef.current = interstitial;
      hasShownRef.current = false;

      unsubscribersRef.current = [
        interstitial.addAdEventListener(AdEventType.LOADED, () => {
          setStatus("loaded");
        }),
        interstitial.addAdEventListener(AdEventType.OPENED, () =>
          setStatus("showing"),
        ),
        interstitial.addAdEventListener(AdEventType.CLOSED, () => {
          setStatus("closed");
          cleanup();
        }),
        interstitial.addAdEventListener(AdEventType.ERROR, (err) => {
          console.log(
            `[Interstitial:${screenName}] error`,
            err?.message || String(err),
          );
          setError(err);
          setStatus("error");
        }),
      ];

      interstitial.load();
    } catch (err) {
      console.log(
        `[Interstitial:${screenName}] unavailable`,
        err?.message || String(err),
      );
      setError(err);
      setStatus("error");
    }
  }, [
    androidAdUnitId,
    cleanup,
    enabled,
    iosAdUnitId,
    mergedRequestOptions,
    screenName,
  ]);

  useEffect(() => {
    loadAd();
    return () => cleanup();
  }, [cleanup, loadAd]);

  const showAd = useCallback(() => {
    const interstitial = adRef.current;
    if (!interstitial) {
      return false;
    }
    try {
      setStatus("showing");
      interstitial.show();
      hasShownRef.current = true;
      return true;
    } catch (err) {
      console.log(
        `[Interstitial:${screenName}] show error`,
        err?.message || String(err),
      );
      setError(err);
      setStatus("error");
      return false;
    }
  }, [screenName]);

  useEffect(() => {
    if (!autoShow || hasShownRef.current) {
      return undefined;
    }
    if (status !== "loaded") {
      return undefined;
    }
    const delay =
      Platform.OS === "ios" ? Math.max(showDelayMs, 500) : showDelayMs;
    showTimerRef.current = setTimeout(() => {
      showAd();
      showTimerRef.current = null;
    }, delay);
    return () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
    };
  }, [autoShow, showAd, showDelayMs, status]);

  return {
    status,
    error,
    ready: status === "loaded",
    show: showAd,
    reload: loadAd,
  };
}
