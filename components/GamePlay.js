import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
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
import { ref, onValue, update, set, get } from "firebase/database";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { database } from "../firebaseConfig";
import { useLanguage } from "../contexts/LanguageContext";
import { toUserKey } from "../utils/userKey";
import theme from "../utils/theme";
import SettingsModal from "./SettingsModal";
import PlusModal from "./PlusModal";
import { saveSession, clearSession } from "../utils/session";

const screenW = Dimensions.get("window").width || 360;
const DECISION_ANIM_DURATION = 2000;
const NEXT_ANIM_DURATION = 2000;
const androidBlurProps =
  Platform.OS === "android"
    ? {
        experimentalBlurMethod: "dimezisBlurView",
      }
    : {};

export default function GamePlay({ route, navigation }) {
  const { gamepin, username } = route.params;
  const { t } = useLanguage();
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
  });

  const [overlay, setOverlay] = useState({
    visible: false,
    bgColor: "rgba(0,0,0,0.8)",
    title: "",
    subtitle: "",
  });

  const [showOverlay, setShowOverlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlus, setShowPlus] = useState(false);
  const [decisionInProgress, setDecisionInProgress] = useState(false);
  const [decisionCountdown, setDecisionCountdown] = useState(null);
  const [decisionReady, setDecisionReady] = useState(false);
  const [leaveInProgress, setLeaveInProgress] = useState(false);
  const planName = "Plus";
  const planPrice = "2,99 EUR";
  const handleRestorePurchases = useCallback(() => {
    console.log("Restore purchases tapped");
  }, []);

  useEffect(() => {
    if (username && gamepin) {
      saveSession(username, gamepin);
    }
  }, [username, gamepin]);

  const cardX = useRef(new Animated.Value(screenW)).current;
  const overlayX = useRef(new Animated.Value(screenW)).current;
  const decisionTimerRef = useRef(null);
  const lastAnimTsRef = useRef(0);
  const drinkSoundRef = useRef(null);
  const animationClearTimerRef = useRef(null);
  const nextPhaseTimeoutRef = useRef(null);
  const revealInitSignatureRef = useRef("");
  const overlaySeenTsRef = useRef(0);
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

      const playersData = gameData.players || {};
      const playerRecord =
        playersData[usernameKey] || playersData[username];

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
      }));

      const finalRoundReached = (gameData.currentRound || 0) > 6;
      if (finalRoundReached) {
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
            const yes = anim.kind === "juu" || anim.kind === "yes";
            setOverlay({
              visible: true,
              bgColor: yes ? "#22c55e" : "#ef4444",
              title: yes ? t("To be continued") : t("Break up"),
              subtitle: "",
            });
          } else if (anim.phase === "next") {
            queueAnimationClear(
              anim.startedAt,
              Number(anim.durationMs) || NEXT_ANIM_DURATION,
            );
            setOverlay({
              visible: true,
              bgColor: "#ff66c4",
              title: t("Next: {{name}}", {
                name: anim.nextPlayerName || "-",
              }),
              subtitle: t("Date {{number}}", {
                number: anim.nextDateNumber || "-",
              }),
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
    navigateToOptions,
    overlay.visible,
    overlayX,
    queueAnimationClear,
    username,
    usernameKey,
  ]);

  const currentTraitId = gameState.currentTrait?.traitId ?? null;
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
  const isCurrentUserTurn = currentPlayer?.username === username;
  const acceptedTraits = Array.isArray(currentPlayer?.acceptedTraits)
    ? currentPlayer.acceptedTraits
    : [];
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
  const revealVisible = revealActive && !overlay.visible && !showOverlay;
  const revealedTraits = useMemo(() => {
    if (!revealVisible) {
      return [];
    }
    return acceptedTraits.slice(0, revealShownCount);
  }, [acceptedTraits, revealVisible, revealShownCount]);
  const revealNextCount = revealVisible
    ? Math.max(acceptedTraits.length - revealShownCount, 0)
    : 0;

  const decisionButtonsDisabled = decisionInProgress || !decisionReady;
  const decisionCountdownLabel =
    decisionCountdown !== null
      ? t(" ({{seconds}}s)", { seconds: decisionCountdown })
      : "";
  const fallbackPlayerLabel = t("Player");
  const displayName = currentPlayer?.username || fallbackPlayerLabel;
  const playerInitial = displayName.slice(0, 1).toUpperCase();
  const totalAccepted = acceptedTraits.length;
  const currentDateLabel = t("Date {{number}}", {
    number: Math.max(totalAccepted, 0) + 1,
  });
  const revealProgressLabel = totalAccepted
    ? t("{{shown}}/{{total}} shown", {
        shown: revealedTraits.length,
        total: totalAccepted,
      })
    : t("Accepted traits");
  const otherPlayerName = currentPlayer?.username || t("the player");
  const traitMetaText = isCurrentUserTurn
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
    if (!isCurrentUserTurn || decisionInProgress) {
      clearDecisionCountdown();
      setDecisionReady(true);
      return;
    }

    if (!currentTraitId) {
      clearDecisionCountdown();
      setDecisionReady(false);
      return;
    }

    if (revealVisible) {
      clearDecisionCountdown();
      setDecisionReady(false);
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
    revealVisible,
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
    };
  }, []);

  const handleDecision = async (choice) => {
    if (!gameState.currentTrait || decisionInProgress) {
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

    const baseSkipped = Number(currentTurnPlayer.skipCount || 0);
    const baseKept = Number(currentTurnPlayer.keepCount || 0);

    const nextAccepted =
      choice === "juu"
        ? [...baseAccepted, gameState.currentTrait]
        : [];

    await update(playerRef, {
      acceptedTraits: nextAccepted,
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
      const traitUpdates = buildNextTraitUpdates();
      const updates = {
        currentPlayerIndex: nextPlayerIndex,
        currentRound: nextRound,
        ...traitUpdates,
      };

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
    gameState.currentTrait?.text ?? t("Waiting for the next trait...");
  const overlayIsStatus =
    overlay.bgColor === "#22c55e" || overlay.bgColor === "#ef4444";
  const overlayGradient =
    overlay.bgColor === "#22c55e"
      ? ["rgba(34,197,94,0.96)", "rgba(21,128,61,0.92)"]
      : overlay.bgColor === "#ef4444"
      ? ["rgba(239,68,68,0.96)", "rgba(185,28,28,0.92)"]
      : theme.backgroundGradient;
  const overlayIconColor = "#ffffff";
  const overlayTitleColor = "#ffffff";
  const overlaySubtitleColor = "rgba(255,255,255,0.9)";

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
          <View style={gp.blobTop} />
          <View style={gp.blobBottom} />
        </View>
        <ScrollView
          style={gp.scroll}
          contentContainerStyle={gp.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={gp.header}>
            <View style={gp.headerTop}>
              <View style={gp.roundRow}>
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
                  <Text style={gp.turnChipText}>
                    {currentPlayer?.username || "-"}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={gp.headerSettingsButton}
                  onPress={() => setShowSettings(true)}
                  accessibilityLabel={t("Settings")}
                >
                  <Ionicons name="settings-outline" size={20} color="#F8ECFF" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={gp.headerSubtitle}>
              {isCurrentUserTurn
                ? t("Does this trait describe you?")
                : t("Waiting for {{name}} to decide", {
                    name: currentPlayer?.username || "-",
                  })}
            </Text>
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
          </View>

          <Animated.View
            style={[
              gp.traitCard,
              {
                transform: [{ translateX: cardX }],
                opacity: revealVisible ? 0 : 1,
              },
            ]}
          >
            <LinearGradient
              colors={["rgba(255,255,255,0.95)", "rgba(238,235,255,0.92)"]}
              style={gp.traitInner}
            >
              <View style={gp.traitLabelRow}>
                <Ionicons
                  name="heart"
                  size={18}
                  color="#ff66c4"
                  style={gp.traitLabelIcon}
                />
                <Text style={gp.traitLabel}>{t("Date partner traits")}</Text>
              </View>
              <Text style={gp.traitText}>{traitText}</Text>
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

          {isCurrentUserTurn ? (
            <View style={gp.actions}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  gp.actionButton,
                  decisionButtonsDisabled && gp.actionButtonDisabled,
                ]}
                onPress={() => handleDecision("juu")}
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
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  gp.actionButton,
                  decisionButtonsDisabled && gp.actionButtonDisabled,
                ]}
                onPress={() => handleDecision("ei")}
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
                    {`${t("Skip")}${decisionCountdownLabel}`}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={gp.waitingCard}>
              <Ionicons
                name="hourglass-outline"
                size={18}
                color="#F8ECFF"
                style={gp.waitingIcon}
              />
              <Text style={gp.waitingText}>
                {t("Waiting for {{name}} to decide...", {
                  name: otherPlayerName,
                })}
              </Text>
            </View>
          )}

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
        </ScrollView>

        {revealVisible && (
          <View style={gp.revealOverlayWrap}>
            <BlurView
              intensity={80}
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
              colors={theme.cardFrameGradient}
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
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity
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
              </TouchableOpacity>
              <Text style={gp.revealReadAloudText}>
                {t("Read traits aloud")}
              </Text>
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
            <BlurView
              intensity={70}
              tint="dark"
              {...androidBlurProps}
              style={gp.overlayBlur}
              pointerEvents="none"
            />
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
          onOpenPlus={() => {
            setShowSettings(false);
            setShowPlus(true);
          }}
          showLeave
          onLeave={leaveGame}
        />
        <PlusModal
          visible={showPlus}
          onClose={() => setShowPlus(false)}
          planName={planName}
          planPrice={planPrice}
          onRestorePurchases={handleRestorePurchases}
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
  roundRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 0,
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
  },
  turnChipIcon: {
    marginRight: 6,
  },
  turnChipText: {
    color: "#F8ECFF",
    fontSize: 14,
    fontWeight: "700",
  },
  headerSettingsButton: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginLeft: 14,
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
  actionButtonGradient: {
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
    backgroundColor: "rgba(255, 251, 244, 0.65)",
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
  revealReadAloudText: {
    marginTop: 8,
    color: theme.helperText,
    fontSize: 13,
    textAlign: "center",
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
  overlayBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 245, 238, 0.5)",
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





