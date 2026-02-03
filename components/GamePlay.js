import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import {
  ref,
  onValue,
  update,
  set,
  get,
  remove,
  runTransaction,
  serverTimestamp,
} from "firebase/database";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { database } from "../firebaseConfig";
import { useLanguage } from "../contexts/LanguageContext";
import { usePlus } from "../contexts/PlusContext";
import { useFavorites } from "../contexts/FavoritesContext";
import { toUserKey } from "../utils/userKey";
import theme from "../utils/theme";
import SettingsModal from "./SettingsModal";
import PlusModal from "./PlusModal";
import GameRulesModal from "./GameRulesModal";
import { saveSession, clearSession } from "../utils/session";
import MotionPressable from "./MotionPressable";
import MotionFloat from "./MotionFloat";
import { isGameInactive } from "../utils/gameActivity";

const screenW = Dimensions.get("window").width || 360;
const DECISION_ANIM_DURATION = 2000;
const NEXT_ANIM_DURATION = 2000;
const MAX_ROUNDS = 6;
const androidBlurProps =
  Platform.OS === "android"
    ? {
        experimentalBlurMethod: "dimezisBlurView",
      }
    : {};

const FAVORITE_TOAST_TONES = {
  success: {
    colors: ["rgba(255, 102, 196, 0.98)", "rgba(255, 222, 89, 0.95)"],
    icon: "checkmark-circle",
  },
  info: {
    colors: ["rgba(96, 165, 250, 0.96)", "rgba(168, 85, 247, 0.92)"],
    icon: "star",
  },
  warn: {
    colors: ["rgba(251, 146, 60, 0.96)", "rgba(245, 158, 11, 0.92)"],
    icon: "alert-circle",
  },
  error: {
    colors: ["rgba(239, 68, 68, 0.96)", "rgba(248, 113, 113, 0.92)"],
    icon: "close-circle",
  },
};

const RULE_TONES = {
  reverse_answer: {
    chip: {
      borderColor: "rgba(59, 130, 246, 0.45)",
    },
    pillGradient: ["rgba(96, 165, 250, 0.95)", "rgba(59, 130, 246, 0.85)"],
    text: { color: "#ffffff" },
    dot: { backgroundColor: "#ffffff" },
    dotRing: { borderColor: "rgba(255,255,255,0.65)" },
  },
  blind_choose: {
    chip: {
      borderColor: "rgba(20, 184, 166, 0.45)",
    },
    pillGradient: ["rgba(45, 212, 191, 0.95)", "rgba(20, 184, 166, 0.85)"],
    text: { color: "#ffffff" },
    dot: { backgroundColor: "#ffffff" },
    dotRing: { borderColor: "rgba(255,255,255,0.65)" },
  },
  majority_decides: {
    chip: {
      borderColor: "rgba(34, 197, 94, 0.45)",
    },
    pillGradient: ["rgba(74, 222, 128, 0.95)", "rgba(34, 197, 94, 0.85)"],
    text: { color: "#ffffff" },
    dot: { backgroundColor: "#ffffff" },
    dotRing: { borderColor: "rgba(255,255,255,0.65)" },
  },
  loudest_decides: {
    chip: {
      borderColor: "rgba(244, 63, 94, 0.45)",
    },
    pillGradient: ["rgba(251, 113, 133, 0.95)", "rgba(244, 63, 94, 0.85)"],
    text: { color: "#ffffff" },
    dot: { backgroundColor: "#ffffff" },
    dotRing: { borderColor: "rgba(255,255,255,0.65)" },
  },
  skip_rule: {
    chip: {
      borderColor: "rgba(245, 158, 11, 0.45)",
    },
    pillGradient: ["rgba(251, 191, 36, 0.95)", "rgba(245, 158, 11, 0.85)"],
    text: { color: "#ffffff" },
    dot: { backgroundColor: "#ffffff" },
    dotRing: { borderColor: "rgba(255,255,255,0.65)" },
  },
  custom_rule: {
    chip: {
      borderColor: "rgba(168, 85, 247, 0.45)",
    },
    pillGradient: ["rgba(192, 132, 252, 0.95)", "rgba(168, 85, 247, 0.85)"],
    text: { color: "#ffffff" },
    dot: { backgroundColor: "#ffffff" },
    dotRing: { borderColor: "rgba(255,255,255,0.65)" },
  },
  default: {
    chip: {
      borderColor: "rgba(255, 255, 255, 0.45)",
    },
    pillGradient: ["rgba(255, 143, 199, 0.95)", "rgba(255, 102, 196, 0.85)"],
    text: { color: "#ffffff" },
    dot: { backgroundColor: "#ffffff" },
    dotRing: { borderColor: "rgba(255,255,255,0.65)" },
  },
};

export default function GamePlay({ route, navigation }) {
  const { gamepin, username } = route.params;
  const { t } = useLanguage();
  const { restorePurchases, isPlus } = usePlus();
  const { addFavorite, isFavorite } = useFavorites();
  const usernameKey = useMemo(() => toUserKey(username), [username]);

  if (!username) {
    console.error("Username is undefined. Please check navigation params.");
    return (
      <View>
        <Text>{t("Error: Username is undefined.")}</Text>
      </View>
    );
  }

  if (!gamepin) {
    console.error("Gamepin is undefined. Please check navigation params.");
    return (
      <View>
        <Text>{t("Error: Gamepin is undefined.")}</Text>
      </View>
    );
  }

  const [gameState, setGameState] = useState({
    players: [],
    traits: [],
    usedTraits: [],
    currentTrait: null,
    currentRound: 1,
    currentPlayerIndex: 0,
    playerAcceptedTraits: [],
    traitReveal: null,
    mode: "default",
    roundsTotal: MAX_ROUNDS,
    rules: [],
    turnVotes: {},
  });

  const [overlay, setOverlay] = useState({
    visible: false,
    bgColor: "rgba(0,0,0,0.8)",
    title: "",
    subtitle: "",
    reason: null,
  });

  const [showOverlay, setShowOverlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlus, setShowPlus] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showFavoritesInfo, setShowFavoritesInfo] = useState(false);
  const [favoriteToast, setFavoriteToast] = useState({
    visible: false,
    message: "",
    variant: "success",
  });
  const [rulesToastVisible, setRulesToastVisible] = useState(false);
  const [decisionInProgress, setDecisionInProgress] = useState(false);
  const [decisionCountdown, setDecisionCountdown] = useState(null);
  const [decisionReady, setDecisionReady] = useState(false);
  const [leaveInProgress, setLeaveInProgress] = useState(false);
  const planName = "Plus";
  const planPrice = "2,99 EUR";
  const handleRestorePurchases = useCallback(async () => {
    try {
      await restorePurchases();
    } catch (error) {
      console.warn("Restore purchases failed", error?.message || error);
    }
  }, [restorePurchases]);

  useEffect(() => {
    if (username && gamepin) {
      saveSession(username, gamepin);
    }
  }, [username, gamepin]);

  const isCustomMode = gameState.mode === "custom";

  const cardX = useRef(new Animated.Value(screenW)).current;
  const overlayX = useRef(new Animated.Value(screenW)).current;
  const rulesToastAnim = useRef(new Animated.Value(0)).current;
  const favoriteToastAnim = useRef(new Animated.Value(0)).current;
  const decisionTimerRef = useRef(null);
  const lastAnimTsRef = useRef(0);
  const drinkSoundRef = useRef(null);
  const animationClearTimerRef = useRef(null);
  const nextPhaseTimeoutRef = useRef(null);
  const revealInitSignatureRef = useRef("");
  const revealSeenSignatureRef = useRef("");
  const overlaySeenTsRef = useRef(0);
  const pendingRulesKeyRef = useRef(null);
  const lastRulesKeyRef = useRef("");
  const rulesToastTimerRef = useRef(null);
  const rulesToastDelayRef = useRef(null);
  const favoriteToastTimerRef = useRef(null);
  const prevTraitRevealRef = useRef(null);
  const activeRuleChipsRef = useRef([]);
  const navigatedAwayRef = useRef(false);

  const animateIn = (value) =>
    Animated.timing(value, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

  const animateOutLeft = (value, callback) =>
    Animated.timing(value, {
      toValue: -screenW,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(callback);

  const queueAnimationClear = useCallback(
    (startedAt, timeoutMs = NEXT_ANIM_DURATION) => {
      if (!startedAt) {
        return;
      }
      if (animationClearTimerRef.current) {
        clearTimeout(animationClearTimerRef.current);
      }
      animationClearTimerRef.current = setTimeout(() => {
        if (lastAnimTsRef.current !== startedAt) {
          return;
        }
        set(ref(database, `games/${gamepin}/animation`), null).catch(
          (error) => {
            console.warn("Failed to clear animation state:", error?.message);
          },
        );
        animationClearTimerRef.current = null;
      }, timeoutMs);
    },
    [gamepin],
  );

  const showRulesToast = useCallback(
    (key) => {
      if (!key) {
        return;
      }
      if (!isCustomMode || !activeRuleChipsRef.current.length) {
        return;
      }
      if (lastRulesKeyRef.current === key) {
        return;
      }
      lastRulesKeyRef.current = key;
      if (rulesToastTimerRef.current) {
        clearTimeout(rulesToastTimerRef.current);
        rulesToastTimerRef.current = null;
      }
      setRulesToastVisible(true);
      rulesToastAnim.setValue(0);
      Animated.timing(rulesToastAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        rulesToastTimerRef.current = setTimeout(() => {
          Animated.timing(rulesToastAnim, {
            toValue: 0,
            duration: 220,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            setRulesToastVisible(false);
          });
        }, 3000);
      });
    },
    [isCustomMode, rulesToastAnim],
  );

  const queueRulesToast = useCallback(
    (key, force = false) => {
      if (!key) {
        return;
      }
      if (!force && (!isCustomMode || !activeRuleChipsRef.current.length)) {
        return;
      }
      if (lastRulesKeyRef.current === key) {
        return;
      }
      pendingRulesKeyRef.current = key;
    },
    [isCustomMode],
  );

  const showFavoriteToast = useCallback(
    (message, variant = "success") => {
      if (!message) {
        return;
      }
      if (favoriteToastTimerRef.current) {
        clearTimeout(favoriteToastTimerRef.current);
        favoriteToastTimerRef.current = null;
      }
      setFavoriteToast({
        visible: true,
        message,
        variant,
      });
      favoriteToastAnim.setValue(0);
      Animated.timing(favoriteToastAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        favoriteToastTimerRef.current = setTimeout(() => {
          Animated.timing(favoriteToastAnim, {
            toValue: 0,
            duration: 180,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            setFavoriteToast((prev) => ({ ...prev, visible: false }));
          });
        }, 2000);
      });
    },
    [favoriteToastAnim],
  );

  useEffect(
    () => () => {
      if (favoriteToastTimerRef.current) {
        clearTimeout(favoriteToastTimerRef.current);
        favoriteToastTimerRef.current = null;
      }
    },
    [],
  );

  const handleAddFavorite = useCallback(
    async (text, meta = {}) => {
      const trimmed = String(text || "").trim();
      if (!trimmed) {
        return;
      }
      if (!isPlus) {
        setShowFavoritesInfo(true);
        return;
      }
      if (isFavorite(trimmed)) {
        showFavoriteToast(t("Already in favorites"), "info");
        return;
      }
      try {
        const result = await addFavorite({
          text: trimmed,
          lang: meta.lang ?? null,
          source: meta.source || "game",
        });
        if (result.status === "duplicate") {
          showFavoriteToast(t("Already in favorites"), "info");
        } else if (result.status === "added") {
          showFavoriteToast(t("Added to favorites"), "success");
        } else if (result.status === "no-user") {
          showFavoriteToast(t("Favorites unavailable"), "warn");
        }
      } catch (error) {
        console.warn("Failed to add favorite:", error?.message || error);
        Alert.alert(
          t("Notice"),
          t("Something went wrong. Please try again shortly."),
        );
      }
    },
    [addFavorite, isFavorite, isPlus, showFavoriteToast, t],
  );

  const navigateToOptions = useCallback(() => {
    if (navigatedAwayRef.current) {
      return;
    }
    navigatedAwayRef.current = true;
    clearSession();
    navigation.reset({
      index: 0,
      routes: [
        {
          name: "GameOptionScreen",
          params: { username },
        },
      ],
    });
  }, [navigation, username]);

  const navigateToEnterUsername = useCallback(() => {
    if (navigatedAwayRef.current) {
      return;
    }
    navigatedAwayRef.current = true;
    clearSession();
    navigation.reset({
      index: 0,
      routes: [{ name: "EnterUsername" }],
    });
  }, [navigation]);

  const navigateToGameEnd = useCallback(() => {
    if (navigatedAwayRef.current) {
      return;
    }
    navigatedAwayRef.current = true;
    navigation.reset({
      index: 0,
      routes: [
        {
          name: "GameEnd",
          params: { username, gamepin },
        },
      ],
    });
  }, [gamepin, navigation, username]);

  // Preload the drink sound once
  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          require("../assets/drink-up.mp3"),
          { shouldPlay: false, volume: 1.0 },
        );
        drinkSoundRef.current = sound;
      } catch (error) {
        console.warn("Failed to preload drink sound:", error?.message);
      }
    })();

    return () => {
      try {
        drinkSoundRef.current?.unloadAsync();
      } catch (error) {
        console.warn("Failed to unload drink sound:", error?.message);
      }
    };
  }, []);

  const playDrinkUp = async () => {
    try {
      const snd = drinkSoundRef.current;
      if (!snd) {
        const { sound } = await Audio.Sound.createAsync(
          require("../assets/drink-up.mp3"),
        );
        drinkSoundRef.current = sound;
      }
      await drinkSoundRef.current.setPositionAsync(0);
      await drinkSoundRef.current.playAsync();
    } catch (error) {
      console.warn("Failed to play drink sound:", error?.message);
    }
  };

  // Subscribe to Firebase game state
  useEffect(() => {
    const gameRef = ref(database, `games/${gamepin}`);
    const unsubscribe = onValue(gameRef, (snapshot) => {
      if (navigatedAwayRef.current) {
        return;
      }

      const gameData = snapshot.val();
      if (!gameData) {
        navigateToOptions();
        unsubscribe();
        return;
      }
      if (isGameInactive(gameData.lastActivityAt)) {
        remove(gameRef).catch((error) => {
          console.warn(
            "Failed to remove inactive game:",
            error?.message || error,
          );
        });
        navigateToEnterUsername();
        unsubscribe();
        return;
      }

      const playersData = gameData.players || {};
      const playerRecord =
        playersData[usernameKey] || playersData[username];

      const rulesRaw = gameData.rules || [];
      const rulesArray = Array.isArray(rulesRaw)
        ? rulesRaw
        : Object.values(rulesRaw || {});
      const roundsTotalValue = Number(gameData.roundsTotal) || MAX_ROUNDS;
      const normalizedRulesSnapshot = Array.isArray(rulesArray)
        ? rulesArray.map((rule) => ({
            ...rule,
            activeRounds: Array.isArray(rule?.activeRounds)
              ? rule.activeRounds.map((round) => Number(round))
              : [],
          }))
        : [];

      if (!playerRecord || playerRecord.status === "left") {
        navigateToOptions();
        unsubscribe();
        return;
      }

      const rawPlayers = Object.entries(playersData).map(([key, value]) => {
        const data = value || {};
        const safeKey = data.usernameKey || key;
        const displayName = data.username || safeKey;
        return {
          ...data,
          username: displayName,
          usernameKey: safeKey,
        };
      });

      const activePlayers = rawPlayers.filter(
        (player) => player?.status !== "left",
      );
      // Keep turn order deterministic across all devices.
      activePlayers.sort((a, b) => {
        const aKey = String(a?.usernameKey || toUserKey(a?.username || ""));
        const bKey = String(b?.usernameKey || toUserKey(b?.username || ""));
        return aKey.localeCompare(bKey);
      });
      const currentPlayerSnapshot =
        activePlayers[Number(gameData.currentPlayerIndex) || 0] || null;
      const currentAcceptedCount = Array.isArray(
        currentPlayerSnapshot?.acceptedTraits,
      )
        ? currentPlayerSnapshot.acceptedTraits.length
        : 0;
      const currentDateNumberSnapshot =
        Math.max(currentAcceptedCount, 0) + 1;
      const activeRulesSnapshot =
        gameData.mode === "custom"
          ? normalizedRulesSnapshot.filter((rule) => {
              if (!rule?.enabled) {
                return false;
              }
              if (rule?.id === "skip_rule") {
                return false;
              }
              const rounds = rule.activeRounds || [];
              return rounds.includes(currentDateNumberSnapshot);
            })
          : [];
      const hasActiveRulesSnapshot = activeRulesSnapshot.length > 0;

      setGameState((prev) => ({
        ...prev,
        traits: gameData.traits ? Object.values(gameData.traits) : [],
        usedTraits: gameData.usedTraits || [],
        currentTrait: gameData.currentTrait || null,
        currentPlayerIndex: gameData.currentPlayerIndex || 0,
        currentRound: gameData.currentRound || 1,
        players: activePlayers,
        playerAcceptedTraits:
          (playerRecord && playerRecord.acceptedTraits) || [],
        traitReveal: gameData.traitReveal || null,
        mode: gameData.mode || "default",
        roundsTotal: roundsTotalValue,
        rules: rulesArray,
        turnVotes: gameData.turnVotes || {},
      }));

      const effectiveRounds =
        gameData.mode === "custom" ? roundsTotalValue : MAX_ROUNDS;
      const finalRoundReached = (gameData.currentRound || 0) > effectiveRounds;
      const isGameFinished =
        gameData.isGameEnded === true || gameData.status === "finished";
      if (finalRoundReached || isGameFinished) {
        navigateToGameEnd();
        unsubscribe();
        return;
      }

      // Handle overlay animations (shared between players)
      if (gameData.animation) {
        const anim = gameData.animation;
        const startedAt = Number(anim.startedAt) || 0;
        const hasTimestamp = startedAt > 0;

        if (anim.startedAt && anim.startedAt !== lastAnimTsRef.current) {
          lastAnimTsRef.current = anim.startedAt;
          if (anim.phase === "next" && anim.drink) {
            playDrinkUp();
          }
        }

        const shouldShowOverlay = hasTimestamp
          ? startedAt !== overlaySeenTsRef.current
          : overlaySeenTsRef.current === 0;

        if (shouldShowOverlay) {
          overlaySeenTsRef.current = hasTimestamp ? startedAt : -1;

          if (anim.phase === "decision") {
            if (animationClearTimerRef.current) {
              clearTimeout(animationClearTimerRef.current);
              animationClearTimerRef.current = null;
            }
            if (anim.kind === "skip") {
              setOverlay({
                visible: true,
                bgColor: "#f59e0b",
                title: t("Skipped"),
                subtitle: "",
                reason: anim.reason || null,
              });
            } else {
              const yes = anim.kind === "juu" || anim.kind === "yes";
              setOverlay({
                visible: true,
                bgColor: yes ? "#22c55e" : "#ef4444",
                title: yes ? t("To be continued") : t("Break up"),
                subtitle: "",
                reason: anim.reason || null,
              });
            }
          } else if (anim.phase === "next") {
            queueAnimationClear(
              anim.startedAt,
              Number(anim.durationMs) || NEXT_ANIM_DURATION,
            );
            const nextPlayerName = anim.nextPlayerName || "-";
            const isCustomAnimation = gameData.mode === "custom";
            const nextPlayerFromAnim = activePlayers.find(
              (player) =>
                player?.username === nextPlayerName ||
                player?.usernameKey === toUserKey(nextPlayerName),
            );
            const indexedPlayer = activePlayers[gameData.currentPlayerIndex] || null;
            const nextPlayerCandidate =
              nextPlayerFromAnim ||
              (indexedPlayer?.username === nextPlayerName ? indexedPlayer : null);
            const hasTraitReveal = !!gameData.traitReveal;
            const nextPlayerHasAccepted = Array.isArray(
              nextPlayerCandidate?.acceptedTraits,
            )
              ? nextPlayerCandidate.acceptedTraits.length > 0
              : false;
            if (
              isCustomAnimation &&
              hasActiveRulesSnapshot &&
              !nextPlayerHasAccepted &&
              !hasTraitReveal
            ) {
              queueRulesToast(`next:${anim.startedAt || Date.now()}`, true);
            }
            setOverlay({
              visible: true,
              bgColor: "#ff66c4",
              title: isCustomAnimation
                ? nextPlayerName
                : t("Next: {{name}}", { name: nextPlayerName }),
              subtitle: isCustomAnimation
                ? ""
                : t("Date {{number}}", {
                    number: anim.nextDateNumber || "-",
                  }),
              reason: anim.reason || null,
            });
          }

          setShowOverlay(true);
          overlayX.setValue(screenW);
          animateIn(overlayX).start();
        }
      } else if (overlay.visible) {
        animateOutLeft(overlayX, () => {
          setOverlay((prev) =>
            prev.visible ? { ...prev, visible: false } : prev,
          );
          setShowOverlay(false);
          overlaySeenTsRef.current = 0;
        });
      }

      if (!gameData.animation && animationClearTimerRef.current) {
        clearTimeout(animationClearTimerRef.current);
        animationClearTimerRef.current = null;
      }
      if (!gameData.animation) {
        overlaySeenTsRef.current = 0;
      }

    });

    return () => unsubscribe();
  }, [
    gamepin,
    navigateToGameEnd,
    navigateToEnterUsername,
    navigateToOptions,
    overlay.visible,
    overlayX,
    queueAnimationClear,
    queueRulesToast,
    username,
    usernameKey,
  ]);

  const currentTraitId = gameState.currentTrait?.traitId ?? null;
  const totalRounds = isCustomMode
    ? Number(gameState.roundsTotal) || MAX_ROUNDS
    : MAX_ROUNDS;
  const usedTraitCount = Array.isArray(gameState.usedTraits)
    ? gameState.usedTraits.length
    : 0;

  const traitPoolCount = useMemo(() => {
    if (Array.isArray(gameState.traits)) {
      return gameState.traits.length;
    }
    if (gameState.traits && typeof gameState.traits === "object") {
      return Object.keys(gameState.traits).length;
    }
    return 0;
  }, [gameState.traits]);

  const progressPercent =
    traitPoolCount > 0 ? Math.min(usedTraitCount / traitPoolCount, 1) : 0;
  const traitsPlayedLabel = traitPoolCount
    ? t("{{used}}/{{total}} traits played", {
        used: usedTraitCount,
        total: traitPoolCount,
      })
    : t("{{used}} traits played", { used: usedTraitCount });

  const currentPlayer =
    gameState.players[gameState.currentPlayerIndex] || null;
  const currentPlayerKey =
    currentPlayer?.usernameKey ||
    toUserKey(currentPlayer?.username || "");
  const isCurrentUserTurn =
    !!currentPlayerKey && currentPlayerKey === usernameKey;
  const acceptedTraits = Array.isArray(currentPlayer?.acceptedTraits)
    ? currentPlayer.acceptedTraits
    : [];
  const currentDateNumber = Math.max(acceptedTraits.length, 0) + 1;
  const normalizedRules = useMemo(() => {
    if (!Array.isArray(gameState.rules)) {
      return [];
    }
    return gameState.rules.map((rule) => ({
      ...rule,
      activeRounds: Array.isArray(rule?.activeRounds)
        ? rule.activeRounds.map((round) => Number(round))
        : [],
    }));
  }, [gameState.rules]);
  const activeRules = useMemo(() => {
    if (!isCustomMode) {
      return [];
    }
    return normalizedRules.filter((rule) => {
      if (!rule?.enabled) {
        return false;
      }
      if (rule?.id === "skip_rule") {
        return false;
      }
      const rounds = rule.activeRounds || [];
      return rounds.includes(currentDateNumber);
    });
  }, [currentDateNumber, isCustomMode, normalizedRules]);
  const activeRuleIds = useMemo(
    () => activeRules.map((rule) => rule?.id).filter(Boolean),
    [activeRules],
  );
  const activeRuleChips = useMemo(() => {
    if (!activeRules.length) {
      return [];
    }
    const labelMap = {
      reverse_answer: t("Reverse Answer"),
      blind_choose: t("Blind Choose"),
      majority_decides: t("Majority decides"),
      loudest_decides: t("Loudest decides"),
      custom_rule: t("Custom Rule"),
    };
    return activeRules
      .map((rule, index) => {
        if (!rule) {
          return null;
        }
        const ruleId = rule?.id || "";
        let label = "";
        if (ruleId === "custom_rule" && rule?.text) {
          const customText = String(rule.text).trim();
          label = customText
            ? t("Custom Rule: {{text}}", { text: customText })
            : labelMap.custom_rule;
        } else {
          label = labelMap[ruleId] || ruleId;
        }
        if (!label) {
          return null;
        }
        const tone = RULE_TONES[ruleId] || RULE_TONES.default;
        return {
          key: `${ruleId || "rule"}-${index}`,
          label,
          tone,
        };
      })
      .filter(Boolean);
  }, [activeRules, t]);

  useEffect(() => {
    activeRuleChipsRef.current = activeRuleChips;
  }, [activeRuleChips]);
  const hasBlindChoose = activeRuleIds.includes("blind_choose");
  const hasReverseAnswer = activeRuleIds.includes("reverse_answer");
  const hasMajorityRule = activeRuleIds.includes("majority_decides");
  const hasLoudestRule = activeRuleIds.includes("loudest_decides");
  const skipRule = normalizedRules.find(
    (rule) => rule?.id === "skip_rule" && rule?.enabled,
  );
  const skipRuleUses = skipRule ? Number(skipRule.uses) || 1 : 0;
  // Product rule: only the player whose turn it is can decide.
  const groupDecisionActive = false;
  const currentTurnKey = useMemo(() => {
    if (!currentPlayerKey) {
      return "";
    }
    const traitKey = currentTraitId ?? "trait";
    return `${gameState.currentRound}:${currentPlayerKey}:${traitKey}`;
  }, [currentPlayerKey, currentTraitId, gameState.currentRound]);
  const turnVotesForKey =
    (currentTurnKey && gameState.turnVotes?.[currentTurnKey]) || {};
  const hasVoted =
    isCustomMode &&
    groupDecisionActive &&
    !isCurrentUserTurn &&
    !!turnVotesForKey?.[usernameKey];
  const revealState = gameState.traitReveal || null;
  const isRevealForThisTrait =
    revealState &&
    currentTraitId &&
    revealState.traitId &&
    revealState.traitId === currentTraitId;
  const revealShownCount = isRevealForThisTrait
    ? Math.min(
        Math.max(Number(revealState.shownCount) || 0, acceptedTraits.length ? 1 : 0),
        acceptedTraits.length,
      )
    : 0;
  const revealActive =
    isRevealForThisTrait && acceptedTraits.length > 0 && revealShownCount > 0;
  const revealVisible =
    revealActive && !overlay.visible && !showOverlay && !decisionInProgress;
  const revealedTraits = useMemo(() => {
    if (!revealVisible) {
      return [];
    }
    return acceptedTraits.slice(0, revealShownCount);
  }, [acceptedTraits, revealVisible, revealShownCount]);
  const revealNextCount = revealVisible
    ? Math.max(acceptedTraits.length - revealShownCount, 0)
    : 0;
  const revealSignature = currentTraitId
    ? `${currentTraitId}:${acceptedTraits.length}`
    : "";
  const finalRoundReached = (gameState.currentRound || 0) > totalRounds;
  const isLastRound = (gameState.currentRound || 0) >= totalRounds;
  const leftLastRound = overlay.reason === "player_left" && isLastRound;
  const revealExpected =
    !finalRoundReached &&
    !leftLastRound &&
    currentTraitId &&
    acceptedTraits.length > 0 &&
    !decisionInProgress;
  const revealPending =
    revealExpected &&
    !revealVisible &&
    !overlay.visible &&
    !showOverlay &&
    revealSeenSignatureRef.current !== revealSignature;
  const backgroundBlurActive =
    showOverlay || overlay.visible || revealVisible || revealPending;

  useEffect(() => {
    if (!isCustomMode || !activeRuleChipsRef.current.length) {
      prevTraitRevealRef.current = gameState.traitReveal;
      return;
    }
    if (prevTraitRevealRef.current && !gameState.traitReveal) {
      queueRulesToast(currentTurnKey);
    }
    prevTraitRevealRef.current = gameState.traitReveal;
  }, [currentTurnKey, gameState.traitReveal, isCustomMode, queueRulesToast]);

  useEffect(() => {
    if (!pendingRulesKeyRef.current) {
      return;
    }
    if (overlay.visible || showOverlay || revealVisible || gameState.traitReveal) {
      if (rulesToastDelayRef.current) {
        clearTimeout(rulesToastDelayRef.current);
        rulesToastDelayRef.current = null;
      }
      return;
    }
    if (rulesToastDelayRef.current) {
      return;
    }
    rulesToastDelayRef.current = setTimeout(() => {
      if (overlay.visible || showOverlay || revealVisible || gameState.traitReveal) {
        return;
      }
      const key = pendingRulesKeyRef.current;
      pendingRulesKeyRef.current = null;
      showRulesToast(key);
    }, 320);
  }, [overlay.visible, revealVisible, showOverlay, showRulesToast, gameState.traitReveal]);

  const countdownEnabled = !isCustomMode || !groupDecisionActive;
  const decisionButtonsDisabled =
    decisionInProgress || !decisionReady || (hasVoted && groupDecisionActive);
  const decisionCountdownLabel =
    decisionCountdown !== null && countdownEnabled
      ? t(" ({{seconds}}s)", { seconds: decisionCountdown })
      : "";
  const fallbackPlayerLabel = t("Player");
  const displayName = currentPlayer?.username || fallbackPlayerLabel;
  const playerInitial = displayName.slice(0, 1).toUpperCase();
  const totalAccepted = acceptedTraits.length;
  const currentDateLabel = t("Date {{number}}", {
    number: currentDateNumber,
  });
  const revealProgressLabel = totalAccepted
    ? t("{{shown}}/{{total}} shown", {
        shown: revealedTraits.length,
        total: totalAccepted,
      })
    : t("Accepted traits");
  const otherPlayerName = currentPlayer?.username || t("the player");
  const traitMetaText = isCustomMode
    ? groupDecisionActive
      ? isCurrentUserTurn
        ? t("The group decides for you")
        : hasVoted
        ? t("Vote sent")
        : t("Cast your vote")
      : isCurrentUserTurn
      ? decisionCountdown !== null && countdownEnabled
        ? t("Decision unlocks in {{seconds}}s", {
            seconds: decisionCountdown,
          })
        : t("Your call!")
      : t("Waiting for {{name}}", { name: otherPlayerName })
    : isCurrentUserTurn
    ? revealVisible
      ? t("Review your accepted traits")
      : decisionCountdown !== null
      ? t("Decision unlocks in {{seconds}}s", {
          seconds: decisionCountdown,
        })
      : t("Your call!")
    : revealVisible
    ? t("Reviewing {{name}}'s choices", { name: otherPlayerName })
    : t("Waiting for {{name}}", { name: otherPlayerName });

  const headerSubtitleText = isCustomMode
    ? groupDecisionActive
      ? isCurrentUserTurn
        ? t("The group decides this round.")
        : hasVoted
        ? t("Vote received. Waiting for others.")
        : t("Cast your vote on this trait.")
      : isCurrentUserTurn
      ? t("Decide: yes or no.")
      : t("Waiting for {{name}} to decide", {
          name: currentPlayer?.username || "-",
        })
    : isCurrentUserTurn
    ? t("Does this trait describe you?")
    : t("Waiting for {{name}} to decide", {
        name: currentPlayer?.username || "-",
      });

  const isDecisionMaker = isCustomMode
    ? groupDecisionActive
      ? !isCurrentUserTurn
      : isCurrentUserTurn
    : isCurrentUserTurn;
  const skipRemaining =
    typeof currentPlayer?.skipRemaining === "number"
      ? currentPlayer.skipRemaining
      : typeof currentPlayer?.skipAvailable === "boolean"
      ? currentPlayer.skipAvailable
        ? 1
        : 0
      : skipRuleUses;
  const canUseSkip =
    isCustomMode &&
    isCurrentUserTurn &&
    !groupDecisionActive &&
    currentDateNumber >= 2 &&
    skipRemaining > 0;
  const showAcceptedTraits = true;

  const buildNextTraitUpdates = useCallback(() => {
    const traitPool = Array.isArray(gameState.traits)
      ? gameState.traits.filter(Boolean)
      : [];
    const baseUsed = Array.isArray(gameState.usedTraits)
      ? gameState.usedTraits.filter(
          (value) => value !== null && value !== undefined,
        )
      : [];
    const usedAccumulator = [...baseUsed];
    const usedKeySet = new Set(usedAccumulator.map((value) => String(value)));

    const getTraitKey = (trait) => {
      if (!trait || typeof trait !== "object") {
        return null;
      }
      if (trait.traitId !== undefined && trait.traitId !== null) {
        return trait.traitId;
      }
      if (trait.id !== undefined && trait.id !== null) {
        return trait.id;
      }
      if (typeof trait.text === "string" && trait.text.trim().length > 0) {
        return trait.text.trim();
      }
      return null;
    };

    const pushUsed = (value) => {
      if (value === null || value === undefined) {
        return;
      }
      const key = String(value);
      if (usedKeySet.has(key)) {
        return;
      }
      usedKeySet.add(key);
      usedAccumulator.push(value);
    };

    const currentKey = getTraitKey(gameState.currentTrait);
    pushUsed(currentKey);

    const available = traitPool.filter((trait) => {
      const key = getTraitKey(trait);
      if (key === null || key === undefined) {
        return true;
      }
      return !usedKeySet.has(String(key));
    });

    if (!available.length) {
      return {
        currentTrait: null,
        usedTraits: usedAccumulator,
        traitReveal: null,
      };
    }

    const randomIndex = Math.floor(Math.random() * available.length);
    const nextTrait = available[randomIndex];
    pushUsed(getTraitKey(nextTrait));

    return {
      currentTrait: nextTrait,
      usedTraits: usedAccumulator,
      traitReveal: null,
    };
  }, [gameState.currentTrait, gameState.traits, gameState.usedTraits]);

  // Cancel the local decision countdown timer so another phase can start cleanly
  const clearDecisionCountdown = useCallback(() => {
    if (decisionTimerRef.current) {
      clearInterval(decisionTimerRef.current);
      decisionTimerRef.current = null;
    }
    setDecisionCountdown(null);
  }, []);

  const leaveGame = useCallback(async () => {
    if (leaveInProgress) {
      return;
    }

    clearDecisionCountdown();
    if (nextPhaseTimeoutRef.current) {
      clearTimeout(nextPhaseTimeoutRef.current);
      nextPhaseTimeoutRef.current = null;
    }
    if (animationClearTimerRef.current) {
      clearTimeout(animationClearTimerRef.current);
      animationClearTimerRef.current = null;
    }
    setLeaveInProgress(true);

    try {
      const gameRef = ref(database, `games/${gamepin}`);
      const snapshot = await get(gameRef);

      if (!snapshot.exists()) {
        navigateToOptions();
        return;
      }

      const gameData = snapshot.val() || {};
      const playersData = gameData.players || {};
      const playerKeys = Object.keys(playersData);

      const rawPlayers = playerKeys.map((key) => ({
        key,
        username: key,
        ...playersData[key],
      }));

      const activePlayers = rawPlayers.filter(
        (player) => player?.status !== "left",
      );

      const leavingIndex = activePlayers.findIndex(
        (player) => player.key === username,
      );

      const updatedActive = activePlayers.filter(
        (player) => player.key !== username,
      );

      const currentIndex = Math.max(
        0,
        Math.min(
          Number(gameData.currentPlayerIndex) || 0,
          activePlayers.length ? activePlayers.length - 1 : 0,
        ),
      );

      let nextIndex = currentIndex;
      let shouldAdvanceTrait = false;

      if (leavingIndex !== -1) {
        if (!updatedActive.length) {
          nextIndex = 0;
        } else if (leavingIndex < currentIndex) {
          nextIndex = Math.max(currentIndex - 1, 0);
        } else if (leavingIndex === currentIndex) {
          shouldAdvanceTrait = true;
          if (currentIndex >= updatedActive.length) {
            nextIndex = 0;
          } else {
            nextIndex = currentIndex % updatedActive.length;
          }
        }
      } else {
        nextIndex = Math.min(
          nextIndex,
          Math.max(updatedActive.length - 1, 0),
        );
      }

      const currentRoundValue = Number(gameData.currentRound) || 1;
      let nextRound = currentRoundValue;

      if (
        shouldAdvanceTrait &&
        updatedActive.length > 0 &&
        nextIndex === 0
      ) {
        nextRound = currentRoundValue + 1;
      }

      const updates = {
        [`players/${usernameKey}/status`]: "left",
        [`players/${usernameKey}/leftAt`]: Date.now(),
        [`players/${usernameKey}/active`]: false,
        currentPlayerIndex: nextIndex,
        currentRound: nextRound,
        lastActivityAt: serverTimestamp(),
      };

      if (
        gameData.traitReveal &&
        gameData.traitReveal.player === username
      ) {
        updates.traitReveal = null;
      }

      let nextPlayerName = "-";
      let nextDateNumber = 1;

      if (shouldAdvanceTrait) {
        const traitUpdates = buildNextTraitUpdates();
        Object.assign(updates, traitUpdates);

        if (updatedActive.length > 0) {
          const nextPlayer = updatedActive[nextIndex] || null;
          nextPlayerName = nextPlayer?.username || "-";
          const nextAcceptedLength = Array.isArray(
            nextPlayer?.acceptedTraits,
          )
            ? nextPlayer.acceptedTraits.length
            : 0;
          nextDateNumber = nextAcceptedLength + 1;
          const nextTraitId = traitUpdates.currentTrait?.traitId ?? null;
          if (nextTraitId && nextAcceptedLength > 0) {
            updates.traitReveal = {
              traitId: nextTraitId,
              player: nextPlayer?.username || "",
              shownCount: 1,
              total: nextAcceptedLength,
              startedAt: Date.now(),
            };
          }
        }
      }

      await update(gameRef, updates);

      if (shouldAdvanceTrait && updatedActive.length > 0) {
        const animationRef = ref(database, `games/${gamepin}/animation`);
        try {
          await set(animationRef, {
            phase: "next",
            nextPlayerName,
            nextDateNumber,
            drink: false,
            startedAt: Date.now(),
            durationMs: NEXT_ANIM_DURATION,
            reason: "player_left",
          });
        } catch (error) {
          console.warn(
            "Failed to broadcast next animation after leaving:",
            error?.message,
          );
        }
      }

      navigateToOptions();
    } catch (error) {
      console.error("Failed to leave game:", error);
      Alert.alert(
        t("Leaving failed"),
        t("We couldn't leave the game right now. Please try again shortly."),
      );
    } finally {
      if (!navigatedAwayRef.current) {
        setLeaveInProgress(false);
      }
    }
  }, [
    buildNextTraitUpdates,
    clearDecisionCountdown,
    gamepin,
    leaveInProgress,
    navigateToOptions,
    username,
  ]);

  const confirmLeaveGame = useCallback(() => {
    if (leaveInProgress) {
      return;
    }

    if (Platform.OS === "web") {
      const confirmResult =
        typeof window !== "undefined"
          ? window.confirm(
              t("Leave the game? Your traits stay in play for the others."),
            )
          : true;
      if (confirmResult) {
        leaveGame();
      }
      return;
    }

    Alert.alert(
      t("Leave Game"),
      t("Are you sure you want to leave the game? Your traits stay in play."),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Leave"),
          style: "destructive",
          onPress: leaveGame,
        },
      ],
    );
  }, [leaveGame, leaveInProgress]);

  useEffect(() => {
    if (!currentTraitId) {
      revealInitSignatureRef.current = "";
      return;
    }

    const totalAccepted = acceptedTraits.length;
    const signature = `${currentTraitId}:${totalAccepted}`;

    if (overlay.visible || showOverlay) {
      return;
    }

    if (revealInitSignatureRef.current === signature) {
      return;
    }

    const traitRevealRef = ref(database, `games/${gamepin}/traitReveal`);

    if (
      gameState.traitReveal &&
      gameState.traitReveal.traitId === currentTraitId &&
      (Number(gameState.traitReveal?.shownCount) || 0) >= 1
    ) {
      revealInitSignatureRef.current = signature;
      return;
    }

    if (!isCurrentUserTurn) {
      return;
    }

    const syncRevealState = async () => {
      try {
        if (!totalAccepted) {
          if (
            gameState.traitReveal &&
            gameState.traitReveal.traitId === currentTraitId
          ) {
            await set(traitRevealRef, null);
          }
          revealInitSignatureRef.current = signature;
          return;
        }

        const shouldReset =
          !gameState.traitReveal ||
          gameState.traitReveal.traitId !== currentTraitId;

        if (shouldReset) {
          await set(traitRevealRef, {
            traitId: currentTraitId,
            player: currentPlayer?.username || "",
            shownCount: 1,
            total: totalAccepted,
            startedAt: Date.now(),
          });
        } else if ((Number(gameState.traitReveal?.shownCount) || 0) < 1) {
          await update(traitRevealRef, { shownCount: 1 });
        }

        revealInitSignatureRef.current = signature;
      } catch (error) {
        console.warn("Failed to synchronise trait reveal:", error?.message);
      }
    };

    syncRevealState();
  }, [
    acceptedTraits.length,
    currentPlayer?.username,
    currentTraitId,
    gameState.traitReveal,
    gamepin,
    isCustomMode,
    overlay.visible,
    showOverlay,
    isCurrentUserTurn,
  ]);

  // Watch for trait change to animate the trait card
  useEffect(() => {
    cardX.setValue(screenW);
    animateIn(cardX).start();
  }, [cardX, currentTraitId]);

  const handleRevealNext = useCallback(async () => {
    if (!revealVisible || !isCurrentUserTurn) {
      return;
    }

    if (gameState.traitReveal?.traitId !== currentTraitId) {
      return;
    }

    const traitRevealRef = ref(database, `games/${gamepin}/traitReveal`);
    const shownCount = Math.max(
      Number(gameState.traitReveal?.shownCount) || 0,
      0,
    );
    const totalCount = acceptedTraits.length;

    if (shownCount >= totalCount) {
      try {
        await set(traitRevealRef, null);
      } catch (error) {
        console.warn("Failed to close trait reveal:", error?.message);
      }
      return;
    }

    const nextShown = Math.min(shownCount + 1, totalCount);

    try {
      await update(traitRevealRef, {
        shownCount: nextShown,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.warn("Failed to progress trait reveal:", error?.message);
    }
  }, [
    acceptedTraits.length,
    gameState.traitReveal,
    gamepin,
    isCurrentUserTurn,
    revealVisible,
    currentTraitId,
  ]);

  useEffect(() => {
    if (revealVisible && revealSignature) {
      revealSeenSignatureRef.current = revealSignature;
    }
  }, [revealSignature, revealVisible]);

  useEffect(() => {
    const isDecisionMaker = isCustomMode
      ? groupDecisionActive
        ? !isCurrentUserTurn
        : isCurrentUserTurn
      : isCurrentUserTurn;

    if (!isDecisionMaker || decisionInProgress) {
      clearDecisionCountdown();
      setDecisionReady(isDecisionMaker && !decisionInProgress);
      return;
    }

    if (!currentTraitId) {
      clearDecisionCountdown();
      setDecisionReady(false);
      return;
    }

    if (showOverlay || overlay.visible) {
      clearDecisionCountdown();
      setDecisionReady(false);
      return;
    }

    if (revealVisible) {
      clearDecisionCountdown();
      setDecisionReady(false);
      return;
    }

    if (isCustomMode && groupDecisionActive) {
      clearDecisionCountdown();
      setDecisionReady(true);
      return;
    }

    if (decisionTimerRef.current) {
      return;
    }

    setDecisionReady(false);
    let remaining = 5;
    setDecisionCountdown(remaining);

    decisionTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearDecisionCountdown();
        setDecisionReady(true);
      } else {
        setDecisionCountdown(remaining);
      }
    }, 1000);

    return () => clearDecisionCountdown();
  }, [
    clearDecisionCountdown,
    currentTraitId,
    decisionInProgress,
    isCurrentUserTurn,
    isCustomMode,
    groupDecisionActive,
    overlay.visible,
    revealVisible,
    showOverlay,
  ]);

  useEffect(() => {
    return () => {
      if (nextPhaseTimeoutRef.current) {
        clearTimeout(nextPhaseTimeoutRef.current);
        nextPhaseTimeoutRef.current = null;
      }
      if (animationClearTimerRef.current) {
        clearTimeout(animationClearTimerRef.current);
        animationClearTimerRef.current = null;
      }
      if (rulesToastTimerRef.current) {
        clearTimeout(rulesToastTimerRef.current);
        rulesToastTimerRef.current = null;
      }
      if (rulesToastDelayRef.current) {
        clearTimeout(rulesToastDelayRef.current);
        rulesToastDelayRef.current = null;
      }
    };
  }, []);

  const finalizeCustomDecision = async (rawDecision, decidedByKey) => {
    if (!gameState.currentTrait || !currentPlayerKey || !currentTurnKey) {
      return false;
    }

    const lockRef = ref(
      database,
      `games/${gamepin}/turnDecisions/${currentTurnKey}`,
    );
    const lockResult = await runTransaction(
      lockRef,
      (current) => {
        if (current?.finalized) {
          return current;
        }
        return {
          finalized: true,
          decision: rawDecision,
          decidedBy: decidedByKey,
          decidedAt: Date.now(),
          turnKey: currentTurnKey,
        };
      },
      { applyLocally: false },
    );

    if (!lockResult.committed) {
      return false;
    }

    const finalDecision =
      hasReverseAnswer && rawDecision !== "SKIPPED"
        ? rawDecision === "YES"
          ? "NO"
          : "YES"
        : rawDecision;

    const baseAccepted = Array.isArray(currentPlayer?.acceptedTraits)
      ? currentPlayer.acceptedTraits
      : [];
    const baseMaxAccepted = Number(currentPlayer?.maxAccepted || 0);
    const baseSkipped = Number(currentPlayer?.skipCount || 0);
    const baseKept = Number(currentPlayer?.keepCount || 0);
    const nextAccepted =
      finalDecision === "YES"
        ? [...baseAccepted, gameState.currentTrait]
        : finalDecision === "NO"
        ? []
        : baseAccepted;
    const nextMaxAccepted = Math.max(
      baseMaxAccepted,
      baseAccepted.length,
      nextAccepted.length,
    );

    const nextPlayerIndex =
      (gameState.currentPlayerIndex + 1) % gameState.players.length;
    const nextRound =
      nextPlayerIndex === 0
        ? gameState.currentRound + 1
        : gameState.currentRound;
    const nextPlayer = gameState.players[nextPlayerIndex] || null;
    const nextPlayerName = nextPlayer?.username || "-";
    const nextDateNumber = nextRound;
    const nextAcceptedLength = Array.isArray(nextPlayer?.acceptedTraits)
      ? nextPlayer.acceptedTraits.length
      : 0;
    const decisionKind =
      finalDecision === "YES"
        ? "yes"
        : finalDecision === "SKIPPED"
        ? "skip"
        : "no";

    const traitUpdates = buildNextTraitUpdates();

    const updates = {
      [`players/${currentPlayerKey}/decisions/${gameState.currentRound}`]:
        finalDecision,
      [`players/${currentPlayerKey}/acceptedTraits`]: nextAccepted,
      [`players/${currentPlayerKey}/maxAccepted`]: nextMaxAccepted,
      [`players/${currentPlayerKey}/keepCount`]:
        finalDecision === "YES" ? baseKept + 1 : baseKept,
      [`players/${currentPlayerKey}/skipCount`]:
        finalDecision === "NO" ? baseSkipped + 1 : baseSkipped,
      [`turnHistory/${currentTurnKey}`]: {
        round: gameState.currentRound,
        playerKey: currentPlayerKey,
        playerName: currentPlayer?.username || "",
        trait: gameState.currentTrait?.text || "",
        traitId: gameState.currentTrait?.traitId ?? null,
        decision: finalDecision,
      },
      currentPlayerIndex: nextPlayerIndex,
      currentRound: nextRound,
      ...traitUpdates,
      lastActivityAt: serverTimestamp(),
      traitReveal: null,
      [`turnVotes/${currentTurnKey}`]: null,
    };

    const nextTraitId = traitUpdates.currentTrait?.traitId ?? null;
    if (nextTraitId && nextAcceptedLength > 0) {
      updates.traitReveal = {
        traitId: nextTraitId,
        player: nextPlayer?.username || "",
        shownCount: 1,
        total: nextAcceptedLength,
        startedAt: Date.now(),
      };
    }

    if (finalDecision === "SKIPPED") {
      const nextSkipRemaining = Math.max(skipRemaining - 1, 0);
      updates[`players/${currentPlayerKey}/skipRemaining`] = nextSkipRemaining;
      updates[`players/${currentPlayerKey}/skipAvailable`] =
        nextSkipRemaining > 0;
    }
    if (nextRound > totalRounds) {
      updates.status = "finished";
      updates.isGameEnded = true;
    }

    try {
      await set(ref(database, `games/${gamepin}/animation`), {
        phase: "decision",
        kind: decisionKind,
        startedAt: Date.now(),
        durationMs: DECISION_ANIM_DURATION,
      });
    } catch (error) {
      console.warn("Failed to update animation state:", error?.message);
    }

    if (nextPhaseTimeoutRef.current) {
      clearTimeout(nextPhaseTimeoutRef.current);
      nextPhaseTimeoutRef.current = null;
    }

    nextPhaseTimeoutRef.current = setTimeout(() => {
      set(ref(database, `games/${gamepin}/animation`), {
        phase: "next",
        nextPlayerName,
        nextDateNumber,
        drink: false,
        startedAt: Date.now(),
        durationMs: NEXT_ANIM_DURATION,
      }).catch((error) => {
        console.warn("Failed to update animation state:", error?.message);
      });
      nextPhaseTimeoutRef.current = null;
    }, DECISION_ANIM_DURATION);

    animateOutLeft(cardX, async () => {
      cardX.setValue(screenW);
      try {
        await update(ref(database, `games/${gamepin}`), updates);
      } catch (error) {
        console.warn("Failed to update custom game state:", error?.message);
      } finally {
        animateIn(cardX).start(() => setDecisionInProgress(false));
      }
    });
    return true;
  };

  const handleDecision = async (choice) => {
    if (!gameState.currentTrait || decisionInProgress) {
      return;
    }

    if (isCustomMode) {
      if (groupDecisionActive && isCurrentUserTurn) {
        return;
      }
      if (groupDecisionActive && hasVoted) {
        return;
      }
      if (!currentTurnKey) {
        return;
      }
      if (choice === "skip" && !canUseSkip) {
        return;
      }

      const rawDecision =
        choice === "skip"
          ? "SKIPPED"
          : choice === "yes"
          ? "YES"
          : "NO";

      if (groupDecisionActive) {
        if (choice === "skip") {
          return;
        }
        const voteRef = ref(
          database,
          `games/${gamepin}/turnVotes/${currentTurnKey}/${usernameKey}`,
        );
        try {
          await set(voteRef, rawDecision);
        } catch (error) {
          console.warn("Failed to submit vote:", error?.message);
          return;
        }

        const votes = {
          ...(turnVotesForKey || {}),
          [usernameKey]: rawDecision,
        };
        const eligibleVoters = Math.max(gameState.players.length - 1, 1);
        const threshold = Math.floor(eligibleVoters / 2) + 1;
        const yesCount = Object.values(votes).filter(
          (value) => value === "YES",
        ).length;
        const noCount = Object.values(votes).filter(
          (value) => value === "NO",
        ).length;
        if (
          hasLoudestRule ||
          yesCount >= threshold ||
          noCount >= threshold
        ) {
          setDecisionInProgress(true);
          clearDecisionCountdown();
          setDecisionReady(false);
          const committed = await finalizeCustomDecision(
            hasLoudestRule
              ? rawDecision
              : yesCount >= threshold
              ? "YES"
              : "NO",
            usernameKey,
          );
          if (!committed) {
            setDecisionInProgress(false);
          }
        }
        return;
      }

      setDecisionInProgress(true);
      clearDecisionCountdown();
      setDecisionReady(false);
      {
        const committed = await finalizeCustomDecision(rawDecision, usernameKey);
        if (!committed) {
          setDecisionInProgress(false);
        }
      }
      return;
    }

    setDecisionInProgress(true);
    clearDecisionCountdown();
    setDecisionReady(false);

    const currentTurnPlayer =
      gameState.players[gameState.currentPlayerIndex] || null;

    if (!currentTurnPlayer) {
      setDecisionInProgress(false);
      return;
    }

    const targetKey =
      currentTurnPlayer.usernameKey ||
      toUserKey(currentTurnPlayer.username);
    const playerRef = ref(
      database,
      `games/${gamepin}/players/${targetKey}`,
    );

    const baseAccepted = Array.isArray(currentTurnPlayer.acceptedTraits)
      ? currentTurnPlayer.acceptedTraits
      : [];

    const baseMaxAccepted = Number(currentTurnPlayer.maxAccepted || 0);
    const baseSkipped = Number(currentTurnPlayer.skipCount || 0);
    const baseKept = Number(currentTurnPlayer.keepCount || 0);

    const nextAccepted =
      choice === "juu"
        ? [...baseAccepted, gameState.currentTrait]
        : [];
    const nextMaxAccepted = Math.max(
      baseMaxAccepted,
      baseAccepted.length,
      nextAccepted.length,
    );

    await update(playerRef, {
      acceptedTraits: nextAccepted,
      maxAccepted: nextMaxAccepted,
      keepCount: choice === "juu" ? baseKept + 1 : baseKept,
      skipCount: choice === "ei" ? baseSkipped + 1 : baseSkipped,
    });

    const nextPlayerIndex =
      (gameState.currentPlayerIndex + 1) % gameState.players.length;
    const nextRound =
      nextPlayerIndex === 0
        ? gameState.currentRound + 1
        : gameState.currentRound;
    const nextPlayer =
      gameState.players[nextPlayerIndex] || null;
    const nextPlayerName = nextPlayer?.username || "-";
    const nextAcceptedLength = Array.isArray(nextPlayer?.acceptedTraits)
      ? nextPlayer.acceptedTraits.length
      : 0;
    const nextDateNumber = nextAcceptedLength + 1;
    const decisionStartedAt = Date.now();

    try {
      await set(ref(database, `games/${gamepin}/animation`), {
        phase: "decision",
        kind: choice,
        startedAt: decisionStartedAt,
        durationMs: DECISION_ANIM_DURATION,
      });
    } catch (error) {
      console.warn("Failed to update animation state:", error?.message);
    }

    if (nextPhaseTimeoutRef.current) {
      clearTimeout(nextPhaseTimeoutRef.current);
      nextPhaseTimeoutRef.current = null;
    }

    nextPhaseTimeoutRef.current = setTimeout(() => {
      set(ref(database, `games/${gamepin}/animation`), {
        phase: "next",
        nextPlayerName,
        nextDateNumber,
        drink: false,
        startedAt: Date.now(),
        durationMs: NEXT_ANIM_DURATION,
      }).catch((error) => {
        console.warn("Failed to update animation state:", error?.message);
      });
      nextPhaseTimeoutRef.current = null;
    }, DECISION_ANIM_DURATION);

    animateOutLeft(cardX, async () => {
      const finalDecision = choice === "juu" ? "YES" : "NO";
      const turnHistoryKey =
        currentTurnKey ||
        `${gameState.currentRound}:${targetKey}:${currentTraitId ?? "trait"}`;
      const traitUpdates = buildNextTraitUpdates();
      const updates = {
        [`players/${targetKey}/decisions/${gameState.currentRound}`]: finalDecision,
        [`turnHistory/${turnHistoryKey}`]: {
          round: gameState.currentRound,
          playerKey: targetKey,
          playerName: currentTurnPlayer?.username || "",
          trait: gameState.currentTrait?.text || "",
          traitId: gameState.currentTrait?.traitId ?? null,
          decision: finalDecision,
        },
        currentPlayerIndex: nextPlayerIndex,
        currentRound: nextRound,
        ...traitUpdates,
        lastActivityAt: serverTimestamp(),
      };
      const nextTraitId = traitUpdates.currentTrait?.traitId ?? null;
      if (nextTraitId && nextAcceptedLength > 0) {
        updates.traitReveal = {
          traitId: nextTraitId,
          player: nextPlayer?.username || "",
          shownCount: 1,
          total: nextAcceptedLength,
          startedAt: Date.now(),
        };
      }

      cardX.setValue(screenW);
      try {
        await update(ref(database, `games/${gamepin}`), updates);
      } catch (error) {
        console.warn("Failed to update game state:", error?.message);
      } finally {
        animateIn(cardX).start(() => setDecisionInProgress(false));
      }
    });
  };

  const traitText =
      isCustomMode && hasBlindChoose
        ? t("Hidden trait")
        : gameState.currentTrait?.text ?? t("Waiting for the next trait...");
  const favoriteTraitText = String(gameState.currentTrait?.text || "").trim();
  const canFavoriteTrait =
    !!favoriteTraitText && !(isCustomMode && hasBlindChoose);
  const favoriteTraitSaved =
    canFavoriteTrait && isFavorite(favoriteTraitText);
  const overlayIsStatus =
    overlay.bgColor === "#22c55e" ||
    overlay.bgColor === "#ef4444" ||
    overlay.bgColor === "#f59e0b";
  const overlayGradient =
    overlay.bgColor === "#22c55e"
      ? ["rgba(34,197,94,0.96)", "rgba(21,128,61,0.92)"]
      : overlay.bgColor === "#ef4444"
      ? ["rgba(239,68,68,0.96)", "rgba(185,28,28,0.92)"]
      : overlay.bgColor === "#f59e0b"
      ? ["rgba(245,158,11,0.96)", "rgba(217,119,6,0.92)"]
      : theme.backgroundGradient;
  const overlayIconColor = "#ffffff";
  const overlayTitleColor = "#ffffff";
  const overlaySubtitleColor = "rgba(255,255,255,0.9)";
  const rulesToastTranslate = rulesToastAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const favoriteToastTone =
    FAVORITE_TOAST_TONES[favoriteToast.variant] ||
    FAVORITE_TOAST_TONES.success;
  const favoriteToastTranslate = favoriteToastAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const favoriteToastScale = favoriteToastAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

  return (
    <View style={gp.container}>
      <LinearGradient
        colors={["#ff66c4", "#ffde59"]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />

      <SafeAreaView style={gp.safeArea} edges={["top", "bottom"]}>
        <View pointerEvents="none" style={gp.decorativeLayer}>
          <MotionFloat style={gp.blobTop} driftX={10} driftY={-14} />
          <MotionFloat
            style={gp.blobBottom}
            driftX={-8}
            driftY={12}
            delay={500}
          />
        </View>
        <ScrollView
          style={gp.scroll}
          contentContainerStyle={gp.scrollContent}
          showsVerticalScrollIndicator={false}
        >
            <View style={gp.header}>
              <View style={gp.headerTop}>
                <View style={gp.headerLeftRow}>
                  <View style={gp.roundBadge}>
                    <Ionicons
                      name="repeat-outline"
                      size={16}
                      color="#F8ECFF"
                      style={gp.roundBadgeIcon}
                    />
                    <Text style={gp.roundBadgeText}>
                      {t("Round {{number}}", { number: gameState.currentRound })}
                    </Text>
                  </View>
                  <View style={gp.turnChip}>
                    <Ionicons
                      name="person-circle-outline"
                      size={20}
                      color="#F8ECFF"
                      style={gp.turnChipIcon}
                    />
                    <Text
                      style={gp.turnChipText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {currentPlayer?.username || "-"}
                    </Text>
                  </View>
                </View>
                <MotionPressable
                  activeOpacity={0.85}
                  style={gp.headerSettingsButton}
                  onPress={() => setShowSettings(true)}
                  accessibilityLabel={t("Settings")}
                >
                  <Ionicons name="settings-outline" size={20} color="#F8ECFF" />
                </MotionPressable>
              </View>
            <Text style={gp.headerSubtitle}>{headerSubtitleText}</Text>
            <View style={gp.progressWrapper}>
              <View style={gp.progressTrack}>
                <View
                  style={[
                    gp.progressFill,
                    {
                      width: `${Math.max(
                        progressPercent * 100,
                        progressPercent > 0 ? 12 : 6,
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={gp.progressLabel}>{traitsPlayedLabel}</Text>
            </View>

            {isCustomMode && activeRuleChips.length > 0 && (
              <LinearGradient
                colors={["rgba(255, 143, 199, 0.95)", "rgba(255, 102, 196, 0.85)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={gp.rulesCard}
              >
                <View style={gp.rulesHeader}>
                  <Ionicons
                    name="sparkles-outline"
                    size={18}
                    color="#FCE7FF"
                    style={gp.rulesBannerIcon}
                  />
                  <Text style={gp.rulesTitle}>{t("Rules")}</Text>
                </View>
                <View style={gp.rulesPanel}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={gp.rulesList}
                  >
                    {activeRuleChips.map((chip) => (
                      <LinearGradient
                        key={chip.key}
                        colors={
                          chip.tone?.pillGradient || RULE_TONES.default.pillGradient
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[gp.ruleChip, chip.tone?.chip]}
                      >
                        <View style={[gp.ruleDotRing, chip.tone?.dotRing]}>
                          <View style={[gp.ruleDot, chip.tone?.dot]} />
                        </View>
                        <Text style={[gp.ruleChipText, chip.tone?.text]}>
                          {chip.label}
                        </Text>
                      </LinearGradient>
                    ))}
                  </ScrollView>
                </View>
              </LinearGradient>
            )}
          </View>

          <Animated.View
            style={[
              gp.traitCard,
              {
                transform: [{ translateX: cardX }],
                opacity: revealVisible || revealPending ? 0 : 1,
              },
            ]}
          >
            <LinearGradient
                colors={["rgba(255,255,255,0.95)", "rgba(238,235,255,0.92)"]}
                style={gp.traitInner}
              >
                {canFavoriteTrait && (
                  <MotionPressable
                    style={[
                      gp.favoriteIconButton,
                      favoriteTraitSaved && gp.favoriteIconButtonActive,
                    ]}
                    onPress={() => handleAddFavorite(favoriteTraitText)}
                    activeOpacity={0.9}
                  >
                    <Ionicons
                      name={favoriteTraitSaved ? "star" : "star-outline"}
                      size={18}
                      color={favoriteTraitSaved ? "#f59e0b" : "#ffffff"}
                    />
                  </MotionPressable>
                )}
                <View style={gp.traitLabelRow}>
                  <Ionicons
                    name="heart"
                    size={18}
                    color="#ff66c4"
                  style={gp.traitLabelIcon}
                />
                <Text style={gp.traitLabel}>{t("Date partner trait")}</Text>
                </View>
                <Text style={gp.traitText}>{traitText}</Text>
                {isCurrentUserTurn && !(isCustomMode && hasBlindChoose) && (
                  <View style={gp.traitCalloutRow}>
                    <Ionicons
                      name="megaphone-outline"
                      size={16}
                      color="#c2724e"
                      style={gp.traitCalloutIcon}
                    />
                    <Text style={gp.traitCalloutText}>
                      {t("Read the trait aloud to the other players")}
                    </Text>
                  </View>
                )}
                <View style={gp.traitMetaRow}>
                  <Ionicons
                    name={
                    isCurrentUserTurn ? "heart-circle-outline" : "people-outline"
                  }
                  size={18}
                  color="#c2724e"
                  style={gp.traitMetaIcon}
                />
                <Text style={gp.traitMetaText}>{traitMetaText}</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {isDecisionMaker ? (
            <>
              <View style={gp.actions}>
                <MotionPressable
                  activeOpacity={0.9}
                  style={[
                    gp.actionButton,
                    decisionButtonsDisabled && gp.actionButtonDisabled,
                  ]}
                  onPress={() => handleDecision(isCustomMode ? "yes" : "juu")}
                  disabled={decisionButtonsDisabled}
                >
                  <LinearGradient
                    colors={["#34d399", "#22c55e"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={gp.actionButtonGradient}
                  >
                    <Ionicons
                      name="heart-outline"
                      size={20}
                      color="#ffffff"
                      style={gp.actionIcon}
                    />
                    <Text style={gp.actionText}>
                      {`${t("Keep")}${decisionCountdownLabel}`}
                    </Text>
                  </LinearGradient>
                </MotionPressable>
                <MotionPressable
                  activeOpacity={0.9}
                  style={[
                    gp.actionButton,
                    decisionButtonsDisabled && gp.actionButtonDisabled,
                  ]}
                  onPress={() => handleDecision(isCustomMode ? "no" : "ei")}
                  disabled={decisionButtonsDisabled}
                >
                  <LinearGradient
                    colors={["#f87171", "#ef4444"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={gp.actionButtonGradient}
                  >
                    <Ionicons
                      name="close-outline"
                      size={20}
                      color="#ffffff"
                      style={gp.actionIcon}
                    />
                    <Text style={gp.actionText}>
                      {`${t("Break up")}${decisionCountdownLabel}`}
                    </Text>
                  </LinearGradient>
                </MotionPressable>
              </View>
              {isCustomMode && canUseSkip && (
                <MotionPressable
                  activeOpacity={0.9}
                  style={[
                    gp.skipButton,
                    decisionButtonsDisabled && gp.actionButtonDisabled,
                  ]}
                  onPress={() => handleDecision("skip")}
                  disabled={decisionButtonsDisabled}
                >
                  <LinearGradient
                    colors={["#ff66c4", "#ff4fb3"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={gp.skipButtonGradient}
                  >
                    <Ionicons
                      name="play-skip-forward-outline"
                      size={18}
                      color="#ffffff"
                      style={gp.actionIcon}
                    />
                    <Text style={gp.actionText}>
                      {`${t("Use Skip")} (${skipRemaining})`}
                    </Text>
                  </LinearGradient>
                </MotionPressable>
              )}
            </>
          ) : (
            <View style={gp.waitingCard}>
              <Ionicons
                name="hourglass-outline"
                size={18}
                color="#F8ECFF"
                style={gp.waitingIcon}
              />
              <Text style={gp.waitingText}>
                {groupDecisionActive && isCustomMode
                  ? t("Waiting for the group to decide...")
                  : t("Waiting for {{name}} to decide...", {
                      name: otherPlayerName,
                    })}
              </Text>
            </View>
          )}

          {showAcceptedTraits && (
            <LinearGradient
              colors={theme.cardFrameGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={gp.acceptedCard}
            >
              <View style={gp.acceptedInner}>
                <View style={gp.acceptedHeader}>
                  <View style={gp.acceptedTitleWrap}>
                    <Ionicons
                      name="ribbon-outline"
                      size={18}
                      color={theme.accentPrimary}
                      style={gp.acceptedIcon}
                    />
                    <Text style={gp.acceptedTitle}>{t("Accepted Traits")}</Text>
                  </View>
                  <View style={gp.acceptedCounter}>
                    <Text style={gp.acceptedCounterText}>
                      {acceptedTraits.length}
                    </Text>
                  </View>
                </View>

                {acceptedTraits.length ? (
                  acceptedTraits.map((trait, index) => (
                    <View key={trait.traitId || index} style={gp.acceptedItemRow}>
                      <View style={gp.acceptedIndexBubble}>
                        <Text style={gp.acceptedIndexText}>{index + 1}</Text>
                      </View>
                      <Text style={gp.acceptedItemText}>
                        {trait.text || trait}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={gp.emptyState}>
                    <Ionicons
                      name="sparkles-outline"
                      size={18}
                      color="rgba(255,255,255,0.8)"
                      style={gp.emptyIcon}
                    />
                    <Text style={gp.emptyText}>
                      {t("No accepted traits yet. Make bold choices!")}
                    </Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          )}
        </ScrollView>

        {favoriteToast.visible && (
          <Animated.View
            pointerEvents="none"
            style={[
              gp.favoriteToastWrap,
              {
                opacity: favoriteToastAnim,
                transform: [
                  { translateY: favoriteToastTranslate },
                  { scale: favoriteToastScale },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={favoriteToastTone.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={gp.favoriteToastCard}
            >
              <Ionicons
                name={favoriteToastTone.icon}
                size={18}
                color="#ffffff"
                style={gp.favoriteToastIcon}
              />
              <Text style={gp.favoriteToastText}>{favoriteToast.message}</Text>
            </LinearGradient>
          </Animated.View>
        )}

        {showFavoritesInfo && (
          <View style={gp.favoritesInfoBackdrop}>
            <View style={gp.favoritesInfoCard}>
              <LinearGradient
                colors={["#ff66c4", "#ff914d"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={gp.favoritesInfoHeader}
              >
                <View style={gp.favoritesInfoHeaderRow}>
                  <View style={gp.favoritesInfoIconWrap}>
                    <Ionicons name="star" size={18} color="#ffffff" />
                  </View>
                  <Text style={gp.favoritesInfoTitle}>
                    {t("Favorites are a Plus feature")}
                  </Text>
                </View>
                <Text style={gp.favoritesInfoSubtitle}>
                  {t("Adding traits to favorites is available for Plus subscribers.")}
                </Text>
              </LinearGradient>

              <View style={gp.favoritesInfoBody}>
                <View style={gp.favoritesInfoBullet}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color="#22c55e"
                    style={gp.favoritesInfoBulletIcon}
                  />
                  <Text style={gp.favoritesInfoBulletText}>
                    {t("Save traits you love for later.")}
                  </Text>
                </View>
                <View style={gp.favoritesInfoBullet}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color="#22c55e"
                    style={gp.favoritesInfoBulletIcon}
                  />
                  <Text style={gp.favoritesInfoBulletText}>
                    {t("Use favorites in future games via Auto Fill -> Favorites.")}
                  </Text>
                </View>
              </View>

              <View style={gp.favoritesInfoActions}>
                <MotionPressable
                  style={gp.favoritesInfoSecondary}
                  onPress={() => setShowFavoritesInfo(false)}
                >
                  <Text style={gp.favoritesInfoSecondaryText}>
                    {t("Close")}
                  </Text>
                </MotionPressable>
                <MotionPressable
                  style={gp.favoritesInfoPrimary}
                  onPress={() => {
                    setShowFavoritesInfo(false);
                    setShowPlus(true);
                  }}
                >
                  <LinearGradient
                    colors={theme.primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={gp.favoritesInfoPrimaryInner}
                  >
                    <Text style={gp.favoritesInfoPrimaryText}>
                      {t("Open Plus")}
                    </Text>
                  </LinearGradient>
                </MotionPressable>
              </View>
            </View>
          </View>
        )}

        {rulesToastVisible && isCustomMode && activeRuleChips.length > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              gp.rulesOverlayWrap,
              {
                opacity: rulesToastAnim,
                transform: [{ translateY: rulesToastTranslate }],
              },
            ]}
          >
            <LinearGradient
              colors={theme.backgroundGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[gp.overlayCard, gp.rulesOverlayCard]}
            >
              <Ionicons
                name="sparkles-outline"
                size={28}
                color="#ffffff"
                style={gp.overlayIcon}
              />
              <Text style={gp.overlayTitle}>{t("Rules")}</Text>
              <View style={gp.rulesToastList}>
                {activeRuleChips.map((chip) => (
                  <LinearGradient
                    key={`toast-${chip.key}`}
                    colors={
                      chip.tone?.pillGradient || RULE_TONES.default.pillGradient
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={gp.rulesToastChip}
                  >
                    <Text style={gp.rulesToastLine}>{chip.label}</Text>
                  </LinearGradient>
                ))}
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {backgroundBlurActive && (
          <BlurView
            intensity={70}
            tint="dark"
            {...androidBlurProps}
            style={gp.backdropBlur}
            pointerEvents="none"
          />
        )}

        {revealVisible && (
          <View style={gp.revealOverlayWrap}>
            <BlurView
              intensity={70}
              tint="dark"
              {...androidBlurProps}
              style={gp.revealBlur}
              pointerEvents="none"
            />
            <LinearGradient
              colors={theme.primaryButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={gp.revealDateBadge}
            >
              <Text style={gp.revealDateTitle}>{currentDateLabel}</Text>
            </LinearGradient>
              <LinearGradient
                colors={[theme.modalSurface, theme.modalSurface]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={gp.revealCard}
              >
              <View style={gp.revealHeader}>
                <View style={gp.revealAvatar}>
                  <Text style={gp.revealAvatarText}>{playerInitial}</Text>
                </View>
                <View style={gp.revealHeaderText}>
                  <Text style={gp.revealPlayerName}>{displayName}</Text>
                  <Text style={gp.revealPlayerSubtitle}>
                    {revealProgressLabel}
                  </Text>
                </View>
                <View style={gp.revealBadge}>
                  <Ionicons
                    name="ribbon-outline"
                    size={16}
                    color={theme.accentPrimary}
                    style={gp.revealBadgeIcon}
                  />
                  <Text style={gp.revealBadgeText}>{totalAccepted}</Text>
                </View>
              </View>

              <View style={gp.revealDivider} />

              <ScrollView
                style={gp.revealList}
                contentContainerStyle={gp.revealListContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={gp.revealTag}>
                  <Ionicons
                    name="heart"
                    size={16}
                    color={theme.accentPrimary}
                    style={gp.revealTagIcon}
                  />
                  <Text style={gp.revealTagText}>
                    {t("Date partner traits")}
                  </Text>
                </View>
                {revealedTraits.map((trait, index) => (
                  <View key={trait.traitId || index} style={gp.revealItem}>
                    <View style={gp.revealIndexBubble}>
                      <Text style={gp.revealIndexText}>{index + 1}</Text>
                    </View>
                    <Text style={gp.revealItemText}>
                      {trait?.text || trait}
                    </Text>
                    {!!trait?.text && (
                      <MotionPressable
                        style={[
                          gp.revealFavoriteButton,
                          isFavorite(trait.text) &&
                            gp.revealFavoriteButtonActive,
                        ]}
                        onPress={() => handleAddFavorite(trait.text)}
                      >
                        <Ionicons
                          name={isFavorite(trait.text) ? "star" : "star-outline"}
                          size={16}
                          color={
                            isFavorite(trait.text) ? "#f59e0b" : "#c2724e"
                          }
                        />
                      </MotionPressable>
                    )}
                  </View>
                ))}
              </ScrollView>

              <MotionPressable
                activeOpacity={0.9}
                style={[
                  gp.revealButton,
                  !isCurrentUserTurn && gp.revealButtonDisabled,
                ]}
                onPress={handleRevealNext}
                disabled={!isCurrentUserTurn}
              >
                <LinearGradient
                  colors={theme.primaryButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={gp.revealButtonGradient}
                >
                  <View style={gp.revealButtonContent}>
                    <Text style={gp.revealButtonText}>
                      {revealNextCount > 0
                        ? t("Next trait")
                        : t("Show new trait")}
                    </Text>
                    <Ionicons
                      name="arrow-forward-outline"
                      size={18}
                      color="#ffffff"
                      style={gp.revealButtonIcon}
                    />
                  </View>
                </LinearGradient>
              </MotionPressable>
              {isCurrentUserTurn && (
                <View style={gp.revealCallout}>
                  <Ionicons
                    name="megaphone-outline"
                    size={18}
                    color={theme.accentPrimary}
                    style={gp.revealCalloutIcon}
                  />
                    <Text style={gp.revealCalloutText}>
                      {t("Read traits aloud")}
                    </Text>
                </View>
              )}
              {!isCurrentUserTurn && (
                <Text style={gp.revealWaitingText}>
                  {t("Waiting for {{name}} to continue", { name: displayName })}
                </Text>
              )}
            </LinearGradient>
          </View>
        )}

        {(showOverlay || overlay.visible) && (
          <Animated.View
            style={[
              gp.overlayWrap,
              {
                transform: [{ translateX: overlayX }],
              },
            ]}
          >
            <LinearGradient
              colors={overlayGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={gp.overlayCard}
            >
              <Ionicons
                name={
                  overlay.bgColor === "#22c55e"
                    ? "trophy-outline"
                    : overlay.bgColor === "#ef4444"
                    ? "close-circle-outline"
                    : "sparkles-outline"
                }
                size={32}
                color={overlayIconColor}
                style={gp.overlayIcon}
              />
              <Text
                style={[
                  gp.overlayTitle,
                  !overlayIsStatus && { color: overlayTitleColor },
                ]}
              >
                {overlay.title}
              </Text>
              {!!overlay.subtitle && (
                <Text
                  style={[
                    gp.overlaySubtitle,
                    !overlayIsStatus && { color: overlaySubtitleColor },
                  ]}
                >
                  {overlay.subtitle}
                </Text>
              )}
            </LinearGradient>
          </Animated.View>
        )}

        <SettingsModal
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          onOpenGameRules={() => setShowRules(true)}
          onOpenFavorites={() => navigation.navigate("Favorites")}
          onOpenAutoFillManager={() => navigation.navigate("AutoFillTraitManager")}
          onOpenPlus={() => {
            if (isPlus) {
              return;
            }
            setShowSettings(false);
            setShowPlus(true);
          }}
          showLeave
          onLeave={leaveGame}
          isPlus={isPlus}
        />
        {!isPlus && (
          <PlusModal
            visible={showPlus}
            onClose={() => setShowPlus(false)}
            planName={planName}
            planPrice={planPrice}
            onRestorePurchases={handleRestorePurchases}
          />
        )}
        <GameRulesModal
          visible={showRules}
          onClose={() => setShowRules(false)}
        />
      </SafeAreaView>
    </View>
  );
}

const gp = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#120F2C",
  },
  safeArea: {
    flex: 1,
  },
  decorativeLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  blobTop: {
    position: "absolute",
    top: -160,
    right: -120,
    width: 320,
    height: 320,
    borderRadius: 320,
    backgroundColor: "rgba(255,255,255,0.16)",
    transform: [{ rotate: "18deg" }],
  },
  blobBottom: {
    position: "absolute",
    bottom: 140,
    left: -110,
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: "rgba(255,255,255,0.12)",
    transform: [{ rotate: "-18deg" }],
  },
  scroll: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 80,
    paddingHorizontal: 24,
  },
  header: {
    width: "100%",
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 12,
  },
  headerLeftRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  roundBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  roundBadgeIcon: {
    marginRight: 6,
  },
  roundBadgeText: {
    color: "#F8ECFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  turnChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    marginLeft: 10,
    flexShrink: 1,
    minWidth: 0,
  },
  turnChipIcon: {
    marginRight: 6,
  },
  turnChipText: {
    color: "#F8ECFF",
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
  },
  headerSettingsButton: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginLeft: 14,
    flexShrink: 0,
  },
  leaveButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(17,16,32,0.32)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  leaveButtonDisabled: {
    opacity: 0.6,
  },
  leaveButtonIcon: {
    marginRight: 6,
  },
  leaveButtonText: {
    color: "#F8ECFF",
    fontSize: 14,
    fontWeight: "600",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    lineHeight: 20,
  },
  progressWrapper: {
    marginTop: 14,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#F8ECFF",
    borderRadius: 999,
  },
  progressLabel: {
    marginTop: 6,
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "600",
  },
  rulesCard: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    shadowColor: "#5a0a2d",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 6,
    alignSelf: "center",
    width: "92%",
    maxWidth: 360,
  },
  rulesOverlayWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  rulesOverlayCard: {
    width: "72%",
    maxWidth: 300,
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 18,
  },
  rulesHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  rulesBannerIcon: {
    marginRight: 8,
  },
  rulesTitle: {
    color: "#FCE7FF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  rulesPanel: {
    backgroundColor: "rgba(255, 255, 255, 0.42)",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    shadowColor: "#8b2c60",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  rulesOverlayPanel: {
    marginTop: 14,
  },
  rulesToastList: {
    marginTop: 12,
    alignItems: "center",
  },
  rulesToastChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    alignSelf: "center",
    marginBottom: 8,
    shadowColor: "#5a0a2d",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  rulesToastLine: {
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  favoriteToastWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: "center",
    zIndex: 19,
    paddingHorizontal: 24,
  },
  favoriteToastCard: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#5a0a2d",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },
  favoriteToastIcon: {
    marginRight: 8,
  },
  favoriteToastText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  favoritesInfoBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    backgroundColor: "rgba(16, 8, 22, 0.62)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  favoritesInfoCard: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.98)",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
    shadowColor: "#13093A",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 12,
  },
  favoritesInfoHeader: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  favoritesInfoHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  favoritesInfoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  favoritesInfoTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.3,
    color: "#ffffff",
  },
  favoritesInfoSubtitle: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.92)",
  },
  favoritesInfoBody: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: "rgba(255, 236, 247, 0.55)",
  },
  favoritesInfoBullet: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  favoritesInfoBulletIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  favoritesInfoBulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: theme.bodyMuted,
    fontWeight: "600",
  },
  favoritesInfoActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 18,
    paddingTop: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    gap: 12,
  },
  favoritesInfoSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.accentMutedBorder,
    backgroundColor: theme.accentMuted,
    alignItems: "center",
  },
  favoritesInfoSecondaryText: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.metaLabel,
  },
  favoritesInfoPrimary: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  favoritesInfoPrimaryInner: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  favoritesInfoPrimaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  rulesList: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    paddingRight: 4,
  },
  ruleChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    marginRight: 8,
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    shadowColor: "#5a0a2d",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  ruleDotRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  ruleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ruleChipText: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    flexShrink: 1,
  },
  traitCard: {
    width: "100%",
    borderRadius: 28,
    marginBottom: 24,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  traitInner: {
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  traitLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  traitLabelIcon: {
    marginRight: 6,
  },
  traitLabel: {
    color: "#c2724e",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  traitText: {
    marginTop: 18,
    color: "#1E1736",
    fontSize: 28,
    lineHeight: 34,
    textAlign: "center",
    fontWeight: "700",
  },
  favoriteIconButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 102, 196, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
    shadowColor: "#8b2c60",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  favoriteIconButtonActive: {
    backgroundColor: "rgba(245, 158, 11, 0.85)",
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  traitCalloutRow: {
    marginTop: 12,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  traitCalloutIcon: {
    marginRight: 6,
  },
  traitCalloutText: {
    color: "#c2724e",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    flexShrink: 1,
  },
  traitMetaRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  traitMetaIcon: {
    marginRight: 8,
  },
  traitMetaText: {
    color: "#c2724e",
    fontSize: 13,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 12,
    width: "100%",
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    marginHorizontal: 6,
  },
  actionButtonDisabled: {
    opacity: 0.65,
  },
  skipButton: {
    marginTop: 12,
    borderRadius: 16,
    overflow: "hidden",
  },
  skipButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonGradient: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIcon: {
    marginRight: 8,
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    flexShrink: 1,
  },
  waitingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17,16,32,0.4)",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  waitingIcon: {
    marginRight: 8,
  },
  waitingText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 14,
    fontWeight: "600",
  },
  acceptedCard: {
    width: "100%",
    borderRadius: 26,
    padding: 1.5,
    marginTop: 32,
    shadowColor: theme.neutralShadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 10,
  },
  acceptedInner: {
    borderRadius: 24,
    paddingVertical: 22,
    paddingHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.6)",
  },
  acceptedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  acceptedTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  acceptedIcon: {
    marginRight: 8,
  },
  acceptedTitle: {
    color: theme.bodyText,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  acceptedCounter: {
    minWidth: 34,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,222,89,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptedCounterText: {
    color: theme.metaLabel,
    fontSize: 14,
    fontWeight: "700",
  },
  acceptedItemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  acceptedIndexBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,102,196,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  acceptedIndexText: {
    color: theme.accentPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  acceptedItemText: {
    flex: 1,
    color: theme.bodyMuted,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 12,
  },
  emptyIcon: {
    marginBottom: 6,
  },
  emptyText: {
    color: theme.helperText,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  revealOverlayWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  revealBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 245, 238, 0.5)",
  },
  backdropBlur: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 18,
    backgroundColor: "rgba(255, 245, 238, 0.5)",
  },
  revealDateBadge: {
    alignSelf: "stretch",
    width: "100%",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
    overflow: "hidden",
  },
  revealDateTitle: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
  },
  revealCard: {
    width: "100%",
    borderRadius: 28,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
    paddingVertical: 30,
    paddingHorizontal: 24,
    backgroundColor: theme.neutralSurface,
    borderWidth: 1,
    borderColor: "rgba(255, 222, 207, 0.6)",
    shadowColor: theme.neutralShadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 16,
  },
  revealHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  revealTag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: theme.accentMuted,
    borderWidth: 1,
    borderColor: theme.accentMutedBorder,
    marginBottom: 16,
    marginTop: 4,
  },
  revealTagIcon: {
    marginRight: 6,
  },
  revealTagText: {
    color: theme.metaLabel,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  revealAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255, 102, 196, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  revealAvatarText: {
    color: theme.bodyText,
    fontSize: 22,
    fontWeight: "800",
  },
  revealHeaderText: {
    flex: 1,
  },
  revealPlayerName: {
    color: theme.bodyText,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  revealPlayerSubtitle: {
    marginTop: 2,
    color: theme.helperText,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  revealBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: theme.badgeBackground,
    marginLeft: 12,
  },
  revealBadgeIcon: {
    marginRight: 4,
  },
  revealBadgeText: {
    color: theme.badgeText,
    fontSize: 14,
    fontWeight: "700",
  },
  revealDivider: {
    marginVertical: 18,
    height: 1,
    backgroundColor: "rgba(255, 222, 207, 0.4)",
  },
  revealList: {
    maxHeight: 240,
  },
  revealListContent: {
    paddingBottom: 4,
  },
  revealItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  revealIndexBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.accentMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  revealIndexText: {
    color: theme.accentPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  revealItemText: {
    flex: 1,
    color: theme.bodyMuted,
    fontSize: 18,
    fontWeight: "600",
  },
  revealFavoriteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    backgroundColor: "rgba(255, 102, 196, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 102, 196, 0.2)",
  },
  revealFavoriteButtonActive: {
    backgroundColor: "rgba(255, 222, 89, 0.35)",
    borderColor: "rgba(245, 158, 11, 0.5)",
  },
  revealButton: {
    marginTop: 16,
    borderRadius: 18,
    overflow: "hidden",
  },
  revealButtonDisabled: {
    opacity: 0.6,
  },
  revealButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  revealButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  revealCallout: {
    marginTop: 12,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255, 222, 89, 0.35)",
    borderWidth: 1,
    borderColor: "rgba(255, 145, 77, 0.35)",
  },
  revealCalloutIcon: {
    marginRight: 8,
  },
  revealCalloutText: {
    color: theme.metaLabel,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  revealButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  revealButtonIcon: {
    marginLeft: 10,
  },
  revealWaitingText: {
    marginTop: 12,
    color: theme.helperText,
    fontSize: 13,
    textAlign: "center",
  },
  overlayWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayCard: {
    width: "86%",
    maxWidth: 420,
    marginHorizontal: 28,
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: theme.neutralShadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 24,
    elevation: 12,
  },
  overlayIcon: {
    marginBottom: 10,
  },
  overlayTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  overlaySubtitle: {
    marginTop: 8,
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
    textAlign: "center",
  },
});





