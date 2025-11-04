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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { ref, onValue, update, set } from "firebase/database";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { database } from "../firebaseConfig";

const screenW = Dimensions.get("window").width || 360;

export default function GamePlay({ route, navigation }) {
  const { gamepin, username } = route.params;

  if (!username) {
    console.error("Username is undefined. Please check navigation params.");
    return (
      <View>
        <Text>Error: Username is undefined.</Text>
      </View>
    );
  }

  if (!gamepin) {
    console.error("Gamepin is undefined. Please check navigation params.");
    return (
      <View>
        <Text>Error: Gamepin is undefined.</Text>
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
  const [decisionInProgress, setDecisionInProgress] = useState(false);
  const [decisionCountdown, setDecisionCountdown] = useState(null);
  const [decisionReady, setDecisionReady] = useState(false);

  const cardX = useRef(new Animated.Value(screenW)).current;
  const overlayX = useRef(new Animated.Value(screenW)).current;
  const decisionTimerRef = useRef(null);
  const lastAnimTsRef = useRef(0);
  const drinkSoundRef = useRef(null);
  const animationClearTimerRef = useRef(null);
  const revealInitSignatureRef = useRef("");
  const revealCloseTimerRef = useRef(null);

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
    (startedAt, timeoutMs = 2200) => {
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
      const gameData = snapshot.val();
      if (!gameData) {
        return;
      }

      setGameState((prev) => ({
        ...prev,
        traits: gameData.traits ? Object.values(gameData.traits) : [],
        usedTraits: gameData.usedTraits || [],
        currentTrait: gameData.currentTrait || null,
        currentPlayerIndex: gameData.currentPlayerIndex || 0,
        currentRound: gameData.currentRound || 1,
        players: Object.keys(gameData.players || {}).map((key) => ({
          username: key,
          ...gameData.players[key],
        })),
        playerAcceptedTraits:
          (gameData.players &&
            gameData.players[username] &&
            gameData.players[username].acceptedTraits) ||
          [],
        traitReveal: gameData.traitReveal || null,
      }));

      // Handle overlay animations (shared between players)
      if (gameData.animation) {
        const anim = gameData.animation;
        if (anim.startedAt && anim.startedAt !== lastAnimTsRef.current) {
          lastAnimTsRef.current = anim.startedAt;
          if (
            (anim.phase === "next" && anim.drink) ||
            (anim.phase === "decision" &&
              (anim.kind === "ei" || anim.kind === "no"))
          ) {
            playDrinkUp();
          }
        }

        if (anim.phase === "decision") {
          if (animationClearTimerRef.current) {
            clearTimeout(animationClearTimerRef.current);
            animationClearTimerRef.current = null;
          }
          const yes = anim.kind === "juu" || anim.kind === "yes";
          setOverlay({
            visible: true,
            bgColor: yes ? "#22c55e" : "#ef4444",
            title: yes ? "To be continued" : "Break up",
            subtitle: yes ? "" : "Drink up!",
          });
        } else if (anim.phase === "next") {
          queueAnimationClear(anim.startedAt, 2600);
          setOverlay({
            visible: true,
            bgColor: "#906AFE",
            title: `Next: ${anim.nextPlayerName || "-"}`,
            subtitle: `Date ${anim.nextDateNumber || "-"}`,
          });
        }

        setShowOverlay(true);
        overlayX.setValue(screenW);
        animateIn(overlayX).start();
      } else if (overlay.visible) {
        animateOutLeft(overlayX, () => {
          setOverlay((prev) =>
            prev.visible ? { ...prev, visible: false } : prev,
          );
          setShowOverlay(false);
        });
      }

      if (!gameData.animation && animationClearTimerRef.current) {
        clearTimeout(animationClearTimerRef.current);
        animationClearTimerRef.current = null;
      }

      // Navigate to Game End when the final round has completed
      const finalRoundReached = (gameData.currentRound || 0) > 6;
      if (finalRoundReached) {
        navigation.navigate("GameEnd", { gamepin, username });
      }
    });

    return () => unsubscribe();
  }, [gamepin, navigation, overlay.visible, overlayX, username]);

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
  const revealedTraits = useMemo(() => {
    if (!revealActive) {
      return [];
    }
    return acceptedTraits.slice(0, revealShownCount);
  }, [acceptedTraits, revealActive, revealShownCount]);
  const revealNextCount = revealActive
    ? Math.max(acceptedTraits.length - revealShownCount, 0)
    : 0;

  const decisionButtonsDisabled = decisionInProgress || !decisionReady;
  const decisionCountdownLabel =
    decisionCountdown !== null ? ` (${decisionCountdown}s)` : "";

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

  useEffect(() => {
    if (!currentTraitId) {
      revealInitSignatureRef.current = "";
      return;
    }

    const signature = `${currentTraitId}:${acceptedTraits.length}`;
    if (revealInitSignatureRef.current === signature) {
      return;
    }
    revealInitSignatureRef.current = signature;

    const traitRevealRef = ref(database, `games/${gamepin}/traitReveal`);
    const totalAccepted = acceptedTraits.length;

    const syncRevealState = async () => {
      try {
        if (!totalAccepted) {
          if (
            gameState.traitReveal &&
            gameState.traitReveal.traitId === currentTraitId
          ) {
            await set(traitRevealRef, null);
          }
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
  ]);

  // Watch for trait change to animate the trait card
  useEffect(() => {
    cardX.setValue(screenW);
    animateIn(cardX).start();
  }, [cardX, currentTraitId]);

  // Clear countdown helper
  const clearDecisionCountdown = useCallback(() => {
    if (decisionTimerRef.current) {
      clearInterval(decisionTimerRef.current);
      decisionTimerRef.current = null;
    }
    setDecisionCountdown(null);
  }, []);

  const handleRevealNext = useCallback(async () => {
    if (!revealActive || !isCurrentUserTurn) {
      return;
    }

    if (revealCloseTimerRef.current) {
      clearTimeout(revealCloseTimerRef.current);
      revealCloseTimerRef.current = null;
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

      if (nextShown >= totalCount) {
        revealCloseTimerRef.current = setTimeout(() => {
          set(traitRevealRef, null).catch((error) => {
            console.warn("Failed to close trait reveal:", error?.message);
          });
          revealCloseTimerRef.current = null;
        }, 700);
      }
    } catch (error) {
      console.warn("Failed to progress trait reveal:", error?.message);
    }
  }, [
    acceptedTraits.length,
    gameState.traitReveal,
    gamepin,
    isCurrentUserTurn,
    revealActive,
  ]);

  useEffect(() => {
    if (!revealActive && revealCloseTimerRef.current) {
      clearTimeout(revealCloseTimerRef.current);
      revealCloseTimerRef.current = null;
    }
  }, [revealActive]);

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

    if (revealActive) {
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
    revealActive,
  ]);

  useEffect(() => {
    return () => {
      if (revealCloseTimerRef.current) {
        clearTimeout(revealCloseTimerRef.current);
        revealCloseTimerRef.current = null;
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

    const playerRef = ref(
      database,
      `games/${gamepin}/players/${currentTurnPlayer.username}`,
    );

    const baseAccepted = Array.isArray(currentTurnPlayer.acceptedTraits)
      ? currentTurnPlayer.acceptedTraits
      : [];

    const baseSkipped = Number(currentTurnPlayer.skipCount || 0);
    const baseKept = Number(currentTurnPlayer.keepCount || 0);

    const nextAccepted =
      choice === "juu"
        ? [...baseAccepted, gameState.currentTrait]
        : baseAccepted;

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

    await set(ref(database, `games/${gamepin}/animation`), {
      phase: "decision",
      kind: choice,
      startedAt: Date.now(),
    });

    animateOutLeft(cardX, async () => {
      try {
        await set(ref(database, `games/${gamepin}/animation`), {
          phase: "next",
          nextPlayerName:
            gameState.players[nextPlayerIndex]?.username || "-",
          nextDateNumber:
            (Array.isArray(
              gameState.players[nextPlayerIndex]?.acceptedTraits,
            )
              ? gameState.players[nextPlayerIndex].acceptedTraits.length
              : 0) + 1,
          drink: choice === "ei",
          startedAt: Date.now(),
        });
      } catch (error) {
        console.warn("Failed to update animation state:", error?.message);
      }

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
    gameState.currentTrait?.text ?? "Waiting for the next trait...";

  return (
    <View style={gp.container}>
      <LinearGradient
        colors={["#5170ff", "#ff66c4"]}
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
            <View style={gp.roundRow}>
              <View style={gp.roundBadge}>
                <Ionicons
                  name="repeat-outline"
                  size={16}
                  color="#F8ECFF"
                  style={gp.roundBadgeIcon}
                />
                <Text style={gp.roundBadgeText}>
                  Round {gameState.currentRound}
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
            </View>
            <Text style={gp.headerSubtitle}>
              {isCurrentUserTurn
                ? "Does this trait describe you?"
                : `Waiting for ${currentPlayer?.username || "-"} to decide`}
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
              <Text style={gp.progressLabel}>
                {traitPoolCount
                  ? `${usedTraitCount}/${traitPoolCount} traits played`
                  : `${usedTraitCount} traits played`}
              </Text>
            </View>
          </View>

          <Animated.View
            style={[
              gp.traitCard,
              {
                transform: [{ translateX: cardX }],
                opacity: revealActive ? 0 : 1,
              },
            ]}
          >
            <LinearGradient
              colors={["rgba(255,255,255,0.95)", "rgba(238,235,255,0.92)"]}
              style={gp.traitInner}
            >
              <View style={gp.traitLabelRow}>
                <Ionicons
                  name="sparkles-outline"
                  size={18}
                  color="#906AFE"
                  style={gp.traitLabelIcon}
                />
                <Text style={gp.traitLabel}>He / She</Text>
              </View>
              <Text style={gp.traitText}>{traitText}</Text>
              <View style={gp.traitMetaRow}>
                <Ionicons
                  name={
                    isCurrentUserTurn ? "heart-circle-outline" : "people-outline"
                  }
                  size={18}
                  color="#6B5D92"
                  style={gp.traitMetaIcon}
                />
                <Text style={gp.traitMetaText}>
                  {isCurrentUserTurn
                    ? revealActive
                      ? "Review your accepted traits"
                      : decisionCountdown !== null
                      ? `Decision unlocks in ${decisionCountdown}s`
                      : "Your call!"
                    : revealActive
                    ? `Reviewing ${currentPlayer?.username || "the player"}'s choices`
                    : `Waiting for ${currentPlayer?.username || "the player"}`}
                </Text>
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
                    Keep{decisionCountdownLabel}
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
                    Skip{decisionCountdownLabel}
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
                Waiting for {currentPlayer?.username || "the player"} to decide…
              </Text>
            </View>
          )}

          <LinearGradient
            colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.05)"]}
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
                    color="#F8ECFF"
                    style={gp.acceptedIcon}
                  />
                  <Text style={gp.acceptedTitle}>Accepted Traits</Text>
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
                    No accepted traits yet. Make bold choices!
                  </Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </ScrollView>

        {revealActive && (
          <View style={gp.revealOverlayWrap}>
            <BlurView
              intensity={70}
              tint="dark"
              style={gp.revealBlur}
              pointerEvents="none"
            />
            <View style={gp.revealCard}>
              <Text style={gp.revealTitle}>
                {currentPlayer?.username || "Player"}'s accepted traits
              </Text>
              <ScrollView
                style={gp.revealList}
                contentContainerStyle={gp.revealListContent}
                showsVerticalScrollIndicator={false}
              >
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
                  colors={["#68d1ff", "#5170ff"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={gp.revealButtonGradient}
                >
                  <Text style={gp.revealButtonText}>
                    {revealNextCount > 0 ? "Next" : "Continue"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
              {!isCurrentUserTurn && (
                <Text style={gp.revealWaitingText}>
                  Waiting for {currentPlayer?.username || "the player"} to
                  continue
                </Text>
              )}
            </View>
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
              colors={
                overlay.bgColor === "#22c55e"
                  ? ["rgba(34,197,94,0.96)", "rgba(21,128,61,0.92)"]
                  : overlay.bgColor === "#ef4444"
                  ? ["rgba(239,68,68,0.96)", "rgba(185,28,28,0.92)"]
                  : ["rgba(144,106,254,0.96)", "rgba(255,102,196,0.92)"]
              }
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
                color="#ffffff"
                style={gp.overlayIcon}
              />
              <Text style={gp.overlayTitle}>{overlay.title}</Text>
              {!!overlay.subtitle && (
                <Text style={gp.overlaySubtitle}>{overlay.subtitle}</Text>
              )}
            </LinearGradient>
          </Animated.View>
        )}
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
  roundRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  roundBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
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
    borderRadius: 16,
  },
  turnChipIcon: {
    marginRight: 6,
  },
  turnChipText: {
    color: "#F8ECFF",
    fontSize: 14,
    fontWeight: "700",
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
    color: "#6B5D92",
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
    color: "#6B5D92",
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
  },
  acceptedInner: {
    borderRadius: 24,
    paddingVertical: 22,
    paddingHorizontal: 20,
    backgroundColor: "rgba(17,16,32,0.55)",
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
    color: "#F8ECFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  acceptedCounter: {
    minWidth: 34,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptedCounterText: {
    color: "#F8ECFF",
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
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  acceptedIndexText: {
    color: "#F8ECFF",
    fontSize: 13,
    fontWeight: "700",
  },
  acceptedItemText: {
    flex: 1,
    color: "rgba(255,255,255,0.92)",
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
    color: "rgba(255,255,255,0.72)",
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
  },
  revealCard: {
    width: "100%",
    borderRadius: 28,
    paddingVertical: 30,
    paddingHorizontal: 24,
    backgroundColor: "rgba(15,14,29,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#0a071b",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 16,
  },
  revealTitle: {
    color: "#F8ECFF",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 22,
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
    backgroundColor: "rgba(104,209,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  revealIndexText: {
    color: "#F8ECFF",
    fontSize: 14,
    fontWeight: "700",
  },
  revealItemText: {
    flex: 1,
    color: "rgba(245,242,255,0.95)",
    fontSize: 16,
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
  revealWaitingText: {
    marginTop: 12,
    color: "rgba(255,255,255,0.75)",
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
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayCard: {
    width: "100%",
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#120F2C",
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
