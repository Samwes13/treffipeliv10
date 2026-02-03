import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ref,
  onValue,
  update,
  remove,
  get,
  set,
  runTransaction,
  serverTimestamp,
} from "firebase/database";
import { database } from "../firebaseConfig";
import styles from "../styles";
import { LinearGradient } from "expo-linear-gradient";
import ModalAlert from "./ModalAlert";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../contexts/LanguageContext";
import { toUserKey } from "../utils/userKey";
import getLogoSource from "../utils/logo";
import useInterstitialAd from "../hooks/useInterstitialAd";
import SettingsModal from "./SettingsModal";
import PlusModal from "./PlusModal";
import GameRulesModal from "./GameRulesModal";
import { saveSession, clearSession } from "../utils/session";
import { usePlus } from "../contexts/PlusContext";
import * as Clipboard from "expo-clipboard";
import MotionPressable from "./MotionPressable";
import MotionFloat from "./MotionFloat";
import { isGameInactive } from "../utils/gameActivity";

const INITIAL_ANIMATION_DURATION_MS = 4000;
const GAME_START_COUNTDOWN_MS = 4000;
const ANDROID_INTERSTITIAL_AD_UNIT = "ca-app-pub-7869485729301293/9203602714";
const IOS_INTERSTITIAL_AD_UNIT = "ca-app-pub-7869485729301293/5683769226";

export default function GameLobby({ route, navigation }) {
  const { username, gamepin } = route.params;
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [allPlayersReady, setAllPlayersReady] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [leaveInProgress, setLeaveInProgress] = useState(false);
  const [gameMode, setGameMode] = useState("default");
  const [roundsTotal, setRoundsTotal] = useState(6);
  const [customRules, setCustomRules] = useState([]);
  const [countdownData, setCountdownData] = useState(null);
  const [countdownStep, setCountdownStep] = useState(null);
  const [countdownActive, setCountdownActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlus, setShowPlus] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const hasNavigatedRef = useRef(false);
  const staleHandledRef = useRef(false);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t, language } = useLanguage();
  const { isPlus, restorePurchases } = usePlus();
  const logoSource = getLogoSource(language);
  const goLabel = t("GO!");
  const usernameKey = useMemo(() => toUserKey(username), [username]);
  const planName = "Plus";
  const planPrice = "2,99 EUR";
  const copyTimeoutRef = useRef(null);
  const countdownOverlayPadding = 24;
  const countdownBoxPadding = 24;
  const countdownBoxWidth = Math.min(
    Math.max(0, width - countdownOverlayPadding * 2) * 0.8,
    340,
  );
  const countdownTextMaxWidth = Math.max(
    0,
    countdownBoxWidth - countdownBoxPadding * 2,
  );
  const countdownBaseSize = Math.max(
    36,
    Math.min(56, Math.round(width * 0.16)),
  );
  const countdownGoBaseSize = Math.min(62, Math.round(width * 0.18));
  const goLabelLength = Math.max(1, goLabel.length);
  const countdownGoSizeByWidth = Math.floor(
    countdownTextMaxWidth / (goLabelLength * 0.7),
  );
  const countdownGoSize = Math.max(
    34,
    Math.min(
      countdownGoBaseSize,
      countdownGoSizeByWidth || countdownGoBaseSize,
    ),
  );
  const countdownLineHeight = Math.round(countdownBaseSize * 1.08);
  const countdownGoLineHeight = Math.round(countdownGoSize * 1.05);
  const handleRestorePurchases = async () => {
    try {
      await restorePurchases();
    } catch (error) {
      console.warn("Restore purchases failed", error?.message || error);
    }
  };

  const leaveLobby = async () => {
    if (leaveInProgress) {
      return;
    }
    setLeaveInProgress(true);
    try {
      const playerKey = usernameKey;
      const playerRef = ref(database, `games/${gamepin}/players/${playerKey}`);
      const traitsRef = ref(database, `games/${gamepin}/traits/${playerKey}`);
      await Promise.all([remove(playerRef), remove(traitsRef)]);
      await update(ref(database, `games/${gamepin}`), {
        lastActivityAt: serverTimestamp(),
      });
      await clearSession();
      navigation.reset({
        index: 0,
        routes: [{ name: "GameOptionScreen", params: { username } }],
      });
    } catch (error) {
      console.error("Failed to leave lobby:", error);
      setLeaveInProgress(false);
    }
  };

  const handleCopyGameCode = async () => {
    if (!gamepin) {
      return;
    }
    try {
      await Clipboard.setStringAsync(gamepin);
      setCodeCopied(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCodeCopied(false);
      }, 1600);
    } catch (error) {
      console.error("Failed to copy game code:", error);
    }
  };

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!gamepin || !usernameKey) {
      return;
    }
    update(ref(database, `games/${gamepin}/players/${usernameKey}`), {
      isPlus: !!isPlus,
    }).catch((error) => {
      console.warn("Failed to update plus status", error?.message || error);
    });
  }, [gamepin, usernameKey, isPlus]);

  useEffect(() => {
    const gameRef = ref(database, `games/${gamepin}`);

    const unsubscribe = onValue(gameRef, (snapshot) => {
      const gameData = snapshot.val();

      if (!gameData) {
        setCountdownData(null);
        return;
      }
      if (isGameInactive(gameData.lastActivityAt)) {
        if (!staleHandledRef.current) {
          staleHandledRef.current = true;
          remove(gameRef).catch((error) => {
            console.warn(
              "Failed to remove inactive game:",
              error?.message || error,
            );
          });
          clearSession();
          navigation.reset({
            index: 0,
            routes: [{ name: "EnterUsername" }],
          });
        }
        return;
      }

      const playerList = Object.entries(gameData.players || {}).map(
        ([key, value]) => {
          const data = value || {};
          const safeKey = data.usernameKey || key;
          const displayName = data.username || safeKey;
          return {
            ...data,
            username: displayName,
            usernameKey: safeKey,
          };
        },
      );
      setPlayers(playerList);
      setGameMode(gameData.mode || "default");
      setRoundsTotal(Number(gameData.roundsTotal) || 6);
      const rulesRaw = gameData.rules || [];
      const rulesArray = Array.isArray(rulesRaw)
        ? rulesRaw
        : Object.values(rulesRaw || {});
      setCustomRules(rulesArray);

      const currentPlayer =
        playerList.find((player) => player.username === username) ||
        playerList.find(
          (player) =>
            (player.usernameKey || toUserKey(player.username)) === usernameKey,
        );

      if (!currentPlayer) {
        navigation.navigate("GameOptionScreen", { username });
        return;
      }

      const playerEntry =
        gameData.players?.[usernameKey] || gameData.players?.[username];
      setIsHost(!!playerEntry?.isHost);

      if (gameData.isGameStarted) {
        setIsGameStarted(true);
      } else {
        setIsGameStarted(false);
      }

      const allReady = playerList.every((player) => player.traitsCompleted);
      setAllPlayersReady(allReady);
      setCountdownData(gameData.countdown || null);
    });

    return () => unsubscribe();
  }, [gamepin, username, usernameKey, navigation]);

  useInterstitialAd({
    iosAdUnitId: IOS_INTERSTITIAL_AD_UNIT,
    androidAdUnitId: ANDROID_INTERSTITIAL_AD_UNIT,
    screenName: "GameLobby",
    autoShow: true,
    showDelayMs: 600,
    enabled: Boolean(gamepin) && !isPlus,
  });

  useEffect(() => {
    if (username && gamepin) {
      saveSession(username, gamepin);
    }
  }, [username, gamepin]);

  useEffect(() => {
    if (!countdownData?.startAt || !countdownData?.durationMs) {
      setCountdownStep(null);
      setCountdownActive(false);
      return;
    }

    const steps = ["3", "2", "1", goLabel];
    const startAt = countdownData.startAt;
    const durationMs = countdownData.durationMs;

    setCountdownActive(true);

    const updateStep = () => {
      const elapsed = Date.now() - startAt;
      if (elapsed >= durationMs) {
        setCountdownStep(null);
        setCountdownActive(false);
        return true;
      }

      const index = Math.min(
        steps.length - 1,
        Math.floor(elapsed / 1000),
      );
      setCountdownStep(steps[index]);
      return false;
    };

    if (updateStep()) {
      return;
    }

    const interval = setInterval(() => {
      if (updateStep()) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [countdownData, goLabel]);

  useEffect(() => {
    if (isGameStarted && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      navigation.reset({
        index: 0,
        routes: [
          {
            name: "GamePlay",
            params: { username, gamepin },
          },
        ],
      });
    } else if (!isGameStarted) {
      hasNavigatedRef.current = false;
    }
  }, [gamepin, isGameStarted, navigation, username]);

  const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const startGame = async () => {
    if (!isHost || !allPlayersReady || countdownActive) {
      return;
    }

    const countdownRef = ref(database, `games/${gamepin}/countdown`);
    const countdownPayload = {
      startAt: Date.now(),
      durationMs: GAME_START_COUNTDOWN_MS,
    };

    try {
      setCountdownData(countdownPayload);
      setCountdownStep("3");
      setCountdownActive(true);
      await set(countdownRef, countdownPayload);
      await update(ref(database, `games/${gamepin}`), {
        lastActivityAt: serverTimestamp(),
      });
    } catch (error) {
      setCountdownData(null);
      setCountdownStep(null);
      setCountdownActive(false);
      console.error("Error initiating countdown:", error);
      return;
    }

    setTimeout(() => {
      (async () => {
        try {
          const traitsRef = ref(database, `games/${gamepin}/traits`);
          const traitsSnapshot = await get(traitsRef);

          if (!traitsSnapshot.exists()) {
            return;
          }

          const traitsData = traitsSnapshot.val();
          const allTraits = [];

          Object.keys(traitsData).forEach((playerUsername) => {
            const playerTraits = traitsData[playerUsername];
            Object.values(playerTraits).forEach((trait) => {
              allTraits.push(trait);
            });
          });

          if (allTraits.length === 0) {
            return;
          }

          const shuffledTraits = shuffleArray(allTraits);
          const shuffledTraitsObject = {};
          shuffledTraits.forEach((trait, index) => {
            shuffledTraitsObject[index] = {
              traitId: trait.traitId,
              text: trait.text,
              order: index,
            };
          });

          await set(traitsRef, shuffledTraitsObject);

          Object.keys(traitsData).forEach((playerUsername) => {
            const playerRef = ref(
              database,
              `games/${gamepin}/traits/${playerUsername}`,
            );
            remove(playerRef);
          });

          const playersRef = ref(database, `games/${gamepin}/players`);
          const playersSnapshot = await get(playersRef);
          let firstPlayerName = null;
          let firstAcceptedCount = 0;

          if (playersSnapshot.exists()) {
            const playersData = playersSnapshot.val();
            const orderedPlayerKeys = Object.keys(playersData);

            if (orderedPlayerKeys.length > 0) {
              const firstKey = orderedPlayerKeys[0];
              const firstPlayerData = playersData[firstKey] || {};
              firstPlayerName = firstPlayerData.username || firstKey;
              const acceptedArray = Array.isArray(firstPlayerData.acceptedTraits)
                ? firstPlayerData.acceptedTraits
                : [];
              firstAcceptedCount = acceptedArray.length;
            }
          }

          const gameUpdates = {
            currentTrait: shuffledTraits[0],
            usedTraits: [shuffledTraits[0].traitId],
            currentPlayerIndex: 0,
            currentRound: 1,
            isGameStarted: true,
            lastActivityAt: serverTimestamp(),
          };
          if (gameMode === "custom") {
            gameUpdates.status = "playing";
          }

          await update(ref(database, `games/${gamepin}`), gameUpdates);

          if (firstPlayerName && shuffledTraits[0]) {
            const nextDateNumber = firstAcceptedCount + 1;
            const startedAt = Date.now();
            const animationRef = ref(database, `games/${gamepin}/animation`);

            await set(animationRef, {
              phase: "next",
              nextPlayerName: firstPlayerName,
              nextDateNumber,
              startedAt,
            });

            setTimeout(() => {
              runTransaction(animationRef, (current) => {
                if (current && current.startedAt === startedAt) {
                  return null;
                }
                return current;
              });
            }, INITIAL_ANIMATION_DURATION_MS);
          }
        } catch (error) {
          console.error("Error starting game:", error);
        } finally {
          try {
            await set(countdownRef, null);
          } catch {}
          setCountdownData(null);
          setCountdownStep(null);
          setCountdownActive(false);
        }
      })();
    }, GAME_START_COUNTDOWN_MS);
  };

  const showRemoveModal = (player) => {
    setPlayerToRemove(player);
    setModalVisible(true);
  };

  const removePlayer = async () => {
    if (!playerToRemove) {
      setModalVisible(false);
      return;
    }

    const targetKey =
      playerToRemove.usernameKey || toUserKey(playerToRemove.username);

    if (!targetKey) {
      setModalVisible(false);
      return;
    }

    try {
      const playerRef = ref(
        database,
        `games/${gamepin}/players/${targetKey}`,
      );
      await remove(playerRef);

      const traitsRef = ref(
        database,
        `games/${gamepin}/traits/${targetKey}`,
      );
      await remove(traitsRef);

      await update(ref(database, `games/${gamepin}`), {
        lastActivityAt: serverTimestamp(),
      });

      if (targetKey === usernameKey) {
        navigation.navigate("JoinGame", { username });
      }
    } catch (error) {
      console.error("Error removing player and traits:", error);
    }

    setModalVisible(false);
  };

  const readyCount = useMemo(
    () => players.filter((player) => player.traitsCompleted).length,
    [players],
  );

  const activeRuleLabels = useMemo(() => {
    if (gameMode !== "custom") {
      return [];
    }
    const labelMap = {
      reverse_answer: t("Reverse Answer"),
      blind_choose: t("Blind Choose"),
      majority_decides: t("Majority decides"),
      loudest_decides: t("Loudest decides"),
      skip_rule: t("Skip rule"),
      custom_rule: t("Custom Rule"),
    };
    return (customRules || [])
      .filter((rule) => rule?.enabled)
      .map((rule) => {
        if (rule?.id === "custom_rule" && rule?.text) {
          return t("Custom Rule: {{text}}", { text: rule.text });
        }
        return labelMap[rule?.id] || rule?.id || "";
      })
      .filter(Boolean);
  }, [customRules, gameMode, t]);

  const playersSorted = useMemo(() => {
    const waiting = [];
    const ready = [];

    players.forEach((player) => {
      if (player.traitsCompleted) {
        ready.push(player);
      } else {
        waiting.push(player);
      }
    });

    return [...waiting, ...ready];
  }, [players]);

  const renderHeader = () => (
    <View style={localStyles.headerSection}>
      <Image
        source={logoSource}
        style={localStyles.logo}
      />
      <View style={localStyles.hero}>
        <Text style={localStyles.heroTitle}>{t("Game Lobby")}</Text>
      </View>

      <LinearGradient
        colors={["rgba(255,255,255,0.82)", "rgba(255,255,255,0.55)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={localStyles.summaryCardGradient}
      >
        <View style={localStyles.summaryCard}>
          <View style={localStyles.summaryHeader}>
            <View style={localStyles.pinBadge}>
              <MotionPressable
                style={localStyles.pinBadgeIconWrap}
                onPress={handleCopyGameCode}
                disabled={!gamepin}
                accessibilityRole="button"
                accessibilityLabel={t("Game Code {{code}}", {
                  code: gamepin || t("unknown"),
                })}
              >
                <Ionicons
                  name={codeCopied ? "checkmark-circle" : "copy-outline"}
                  size={18}
                  color={codeCopied ? "#16a34a" : "#ff66c4"}
                />
              </MotionPressable>
              <View style={localStyles.pinBadgeTextWrap}>
                <Text style={localStyles.pinBadgeLabel}>
                  {t("Game Code")}
                </Text>
                <Text style={localStyles.pinBadgeText}>{gamepin}</Text>
              </View>
            </View>
            <View style={localStyles.summaryTag}>
              <View style={localStyles.summaryTagIconWrap}>
                <Ionicons name="people-outline" size={18} color="#c2724e" />
              </View>
              <View style={localStyles.summaryTagTextWrap}>
                <Text style={localStyles.summaryTagLabel}>
                  {t("Players")}
                </Text>
                <Text style={localStyles.summaryTagText}>
                  {players.length}
                </Text>
              </View>
            </View>
          </View>

          <View style={localStyles.summaryRow}>
            <View style={localStyles.summaryItem}>
              <View
                style={[localStyles.summaryIcon, localStyles.summaryIconReady]}
              >
                <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
              </View>
              <View>
                <Text style={localStyles.summaryLabel}>{t("Ready")}</Text>
                <Text style={localStyles.summaryValue}>{readyCount}</Text>
              </View>
            </View>
            <View style={localStyles.summaryDivider} />
            <View style={localStyles.summaryItem}>
              <View
                style={[localStyles.summaryIcon, localStyles.summaryIconWaiting]}
              >
                <Ionicons name="time-outline" size={22} color="#f97316" />
              </View>
              <View>
                <Text style={localStyles.summaryLabel}>
                  {t("In progress")}
                </Text>
                <Text style={localStyles.summaryValue}>
                  {Math.max(players.length - readyCount, 0)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>

      {gameMode === "custom" && (
        <LinearGradient
          colors={["rgba(255,255,255,0.9)", "rgba(255,245,230,0.8)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={localStyles.customModeCard}
        >
          <View style={localStyles.customModeInner}>
            <View style={localStyles.customModeHeader}>
              <Ionicons
                name="options-outline"
                size={18}
                color="#ff66c4"
                style={localStyles.customModeIcon}
              />
              <Text style={localStyles.customModeTitle}>
                {t("Custom Mode")}
              </Text>
            </View>
            <View style={localStyles.customModeRow}>
              <Ionicons
                name="repeat-outline"
                size={16}
                color="#c2724e"
                style={localStyles.customModeRowIcon}
              />
              <Text style={localStyles.customModeText}>
                {t("Rounds: {{count}}", { count: roundsTotal })}
              </Text>
            </View>
            <View style={localStyles.customModeRow}>
              <Ionicons
                name="sparkles-outline"
                size={16}
                color="#c2724e"
                style={localStyles.customModeRowIcon}
              />
              <Text style={localStyles.customModeText}>
                {activeRuleLabels.length
                  ? activeRuleLabels.join(", ")
                  : t("No active rules")}
              </Text>
            </View>
          </View>
        </LinearGradient>
      )}
    </View>
  );

  const renderPlayer = ({ item }) => {
    const ready = !!item.traitsCompleted;
    const playerKey = item.usernameKey || toUserKey(item.username);
    const isCurrentUser = playerKey === usernameKey;
    const canRemove = isHost && !isCurrentUser;
    const showHostBadge = !!item.isHost;
    const showPlusBadge = !!item.isPlus;
    const initial =
      item.username && item.username.length > 0
        ? item.username.charAt(0).toUpperCase()
        : "?";

    return (
      <View style={localStyles.playerCard}>
        {canRemove && (
          <MotionPressable
            onPress={() => showRemoveModal(item)}
            style={localStyles.removeButton}
            accessibilityRole="button"
            accessibilityLabel={t("Remove {{name}}", {
              name: item.username,
            })}
          >
            <Ionicons name="remove-circle" size={20} color="#ef4444" />
          </MotionPressable>
        )}

        <View
          style={[
            localStyles.playerAvatar,
            ready
              ? localStyles.playerAvatarReady
              : localStyles.playerAvatarWaiting,
          ]}
        >
          <Text style={localStyles.playerInitial}>{initial}</Text>
        </View>
        <Text style={localStyles.playerName} numberOfLines={1}>
          {item.username}
        </Text>
        {(showHostBadge || showPlusBadge) && (
          <View style={localStyles.playerBadgesRow}>
            {showHostBadge && (
              <View style={localStyles.hostBadge}>
                <Ionicons
                  name="ribbon-outline"
                  size={14}
                  color="#c2724e"
                  style={localStyles.hostBadgeIcon}
                />
                <Text style={localStyles.hostBadgeText}>{t("Host")}</Text>
              </View>
            )}
            {showPlusBadge && (
              <View style={localStyles.plusBadge}>
                <Ionicons
                  name="sparkles"
                  size={14}
                  color="#ff66c4"
                  style={localStyles.plusBadgeIcon}
                />
                <Text style={localStyles.plusBadgeText}>{t("Plus")}</Text>
              </View>
            )}
          </View>
        )}
        <View
          style={[
            localStyles.playerStatus,
            ready ? localStyles.playerStatusReady : localStyles.playerStatusWait,
          ]}
        >
          <Ionicons
            name={ready ? "checkmark-done" : "hourglass-outline"}
            size={18}
            color={ready ? "#22c55e" : "#f97316"}
          />
          <Text
            style={[
              localStyles.playerStatusText,
              ready
                ? localStyles.playerStatusTextReady
                : localStyles.playerStatusTextWait,
            ]}
          >
            {ready ? t("Ready") : t("In progress")}
          </Text>
          {!ready && (
            <ActivityIndicator
              size="small"
              color="#ff66c4"
              style={localStyles.playerSpinner}
            />
          )}
        </View>
        {isCurrentUser && (
          <MotionPressable
            activeOpacity={0.9}
            onPress={() =>
              navigation.navigate("CardTraits", {
                username: item.username,
                gamepin,
                editing: true,
              })
            }
            style={localStyles.editButton}
          >
            <Ionicons
              name="create-outline"
              size={18}
              color="#4C3F6C"
              style={localStyles.editButtonIcon}
            />
            <Text style={localStyles.editButtonText}>{t("Edit Traits")}</Text>
          </MotionPressable>
        )}
      </View>
    );
  };

  const renderFooter = () => {
    if (isHost) {
      const canStart = allPlayersReady && !countdownActive;
      return (
        <View style={localStyles.footerSection}>
          <View style={localStyles.footerHint}>
            <Ionicons
              name={countdownActive ? "timer-outline" : "information-circle"}
              size={18}
              color="#c2724e"
            />
            <Text style={localStyles.footerHintText}>
              {countdownActive
                ? t("Countdown in progress - get ready!")
                : allPlayersReady
                ? t("Everyone is ready! Start the game whenever you like.")
                : t("Waiting for players to finish prepping before we begin.")}
            </Text>
          </View>
          <MotionPressable
            activeOpacity={0.9}
            onPress={startGame}
            disabled={!canStart}
            style={[
              localStyles.startButton,
              !canStart && localStyles.startButtonDisabled,
            ]}
          >
            <LinearGradient
              colors={
                canStart
                  ? ["#42E695", "#3BB2B8"]
                  : ["rgba(66,230,149,0.45)", "rgba(59,178,184,0.35)"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={localStyles.startButtonGradient}
            >
              <Text style={localStyles.startButtonText}>
                {countdownActive ? t("Starting...") : t("Start Game")}
              </Text>
              <Ionicons name="play-circle" size={26} color="#ffffff" />
            </LinearGradient>
          </MotionPressable>
        </View>
      );
    }

    return (
      <View style={localStyles.footerSection}>
        <View style={localStyles.footerHint}>
          <Ionicons
            name={countdownActive ? "timer-outline" : "hourglass-outline"}
            size={18}
            color="#c2724e"
          />
          <Text style={localStyles.footerHintText}>
            {countdownActive
              ? t("Countdown started! Get ready to jump in.")
              : t(
                  "Waiting for the host to start the game. We'll notify you as soon as it begins.",
                )}
          </Text>
        </View>
      </View>
    );
  };


  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={["#ff66c4", "#ffde59"]}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      <SafeAreaView style={localStyles.safeArea} edges={["top", "bottom"]}>
        <View pointerEvents="none" style={localStyles.decorativeLayer}>
          <MotionFloat style={localStyles.blobLarge} driftX={9} driftY={-13} />
          <MotionFloat
            style={localStyles.blobSmall}
            driftX={-7}
            driftY={11}
            delay={500}
          />
        </View>
        <MotionPressable
          style={[
            localStyles.settingsButton,
            {
              top: (insets?.top || 0) + 14,
              right: 18,
            },
          ]}
          onPress={() => setShowSettings(true)}
          activeOpacity={0.8}
          accessibilityLabel={t("Settings")}
        >
          <Ionicons name="settings-outline" size={22} color="#fff" />
        </MotionPressable>

        <View style={localStyles.container}>
          <FlatList
            data={playersSorted}
            keyExtractor={(item, index) =>
              String(item.username || item.playerId || index)
            }
            renderItem={renderPlayer}
            numColumns={2}
            ListHeaderComponent={renderHeader}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={
              <View style={localStyles.emptyState}>
                <Ionicons
                  name="people-circle-outline"
                  size={48}
                  color="#F8ECFF"
                />
                <Text style={localStyles.emptyTitle}>
                  {t("Waiting for the first players")}
                </Text>
                <Text style={localStyles.emptyText}>
                  {t(
                    "Share the game code with your friends. Players will appear here as soon as they join.",
                  )}
                </Text>
              </View>
            }
            contentContainerStyle={localStyles.listContent}
            columnWrapperStyle={localStyles.playerRow}
            showsVerticalScrollIndicator={false}
          />
        </View>

        <ModalAlert
          visible={modalVisible}
          variant="warn"
          title={t("Remove Player")}
          message={t("Are you sure you want to remove {{name}} from the game?", {
            name: playerToRemove?.username || t("this player"),
          })}
          buttons={[
            { text: t("Remove"), onPress: removePlayer },
            { text: t("Cancel"), onPress: () => {} },
          ]}
          onClose={() => setModalVisible(false)}
        />
        {countdownStep && (
          <View style={localStyles.countdownOverlay}>
            <LinearGradient
              colors={["#ff66c4", "#ffde59"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={localStyles.countdownBox}
            >
              <Text style={localStyles.countdownTitle}>
                {t("Game starting in")}
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                ellipsizeMode="clip"
                style={[
                  localStyles.countdownValue,
                  countdownStep === goLabel && localStyles.countdownGoValue,
                  { fontSize: countdownBaseSize, lineHeight: countdownLineHeight },
                  countdownStep === goLabel && {
                    fontSize: countdownGoSize,
                    lineHeight: countdownGoLineHeight,
                  },
                ]}
              >
                {countdownStep}
              </Text>
            </LinearGradient>
          </View>
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
          onLeave={leaveLobby}
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

const localStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  decorativeLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  blobLarge: {
    position: "absolute",
    top: -160,
    right: -120,
    width: 280,
    height: 280,
    borderRadius: 280,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    transform: [{ rotate: "16deg" }],
  },
  blobSmall: {
    position: "absolute",
    bottom: 160,
    left: -120,
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    transform: [{ rotate: "-14deg" }],
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listContent: {
    paddingBottom: 40,
    paddingTop: 28,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    height: 96,
    width: 200,
    resizeMode: "contain",
    marginBottom: 12,
  },
  hero: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
  },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.82)",
  },
  summaryCardGradient: {
    width: "100%",
    borderRadius: 28,
    padding: 1.5,
    marginTop: 24,
    shadowColor: "#13093A",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.34,
    shadowRadius: 28,
    elevation: 12,
  },
  summaryCard: {
    borderRadius: 26,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  customModeCard: {
    width: "100%",
    borderRadius: 24,
    padding: 1.2,
    marginTop: 16,
    shadowColor: "#13093A",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 8,
  },
  customModeInner: {
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
  },
  customModeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  customModeIcon: {
    marginRight: 8,
  },
  customModeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2d102a",
  },
  customModeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  customModeRowIcon: {
    marginRight: 8,
  },
  customModeText: {
    flex: 1,
    fontSize: 13,
    color: "#6b3a45",
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pinBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 102, 196, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 102, 196, 0.25)",
  },
  pinBadgeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 102, 196, 0.18)",
    marginRight: 10,
  },
  pinBadgeTextWrap: {
    alignItems: "flex-start",
  },
  pinBadgeLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#8b2f6b",
    textTransform: "uppercase",
  },
  pinBadgeText: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#2d102a",
  },
  summaryTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 145, 77, 0.14)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 145, 77, 0.25)",
  },
  summaryTagIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 145, 77, 0.18)",
    marginRight: 10,
  },
  summaryTagTextWrap: {
    alignItems: "flex-start",
  },
  summaryTagLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#c2724e",
    textTransform: "uppercase",
  },
  summaryTagText: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: "800",
    color: "#7c2d12",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 22,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  summaryIconReady: {
    backgroundColor: "rgba(34, 197, 94, 0.18)",
  },
  summaryIconWaiting: {
    backgroundColor: "rgba(251, 146, 60, 0.2)",
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5C4F84",
  },
  summaryValue: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: "700",
    color: "#2d102a",
  },
  summaryDivider: {
    width: 1,
    height: 46,
    backgroundColor: "rgba(144, 106, 254, 0.24)",
  },
  playerRow: {
    justifyContent: "space-between",
    marginBottom: 16,
  },
  playerCard: {
    flex: 1,
    marginHorizontal: 6,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowColor: "#13093A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 6,
  },
  removeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 2,
  },
  playerAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  playerAvatarReady: {
    backgroundColor: "rgba(34, 197, 94, 0.22)",
  },
  playerAvatarWaiting: {
    backgroundColor: "rgba(251, 146, 60, 0.25)",
  },
  playerInitial: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2d102a",
  },
  playerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#362B58",
    textAlign: "center",
    marginBottom: 10,
  },
  playerBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -6,
    marginBottom: 10,
  },
  hostBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255, 145, 77, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 145, 77, 0.3)",
    marginRight: 6,
  },
  hostBadgeIcon: {
    marginRight: 6,
  },
  hostBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "#c2724e",
    textTransform: "uppercase",
  },
  plusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255, 102, 196, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 102, 196, 0.3)",
  },
  plusBadgeIcon: {
    marginRight: 6,
  },
  plusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "#b91c7f",
    textTransform: "uppercase",
  },
  playerStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  playerStatusReady: {
    backgroundColor: "rgba(34, 197, 94, 0.18)",
  },
  playerStatusWait: {
    backgroundColor: "rgba(251, 146, 60, 0.18)",
  },
  playerStatusText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  playerStatusTextReady: {
    color: "#15803d",
  },
  playerStatusTextWait: {
    color: "#9a3412",
  },
  playerSpinner: {
    marginLeft: 10,
  },
  countdownOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(17, 16, 32, 0.55)",
    paddingHorizontal: 24,
    zIndex: 60,
  },
  countdownBox: {
    width: "80%",
    maxWidth: 340,
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#13093A",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.32,
    shadowRadius: 28,
    elevation: 10,
  },
  countdownTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    textAlign: "center",
  },
  countdownValue: {
    marginTop: 12,
    fontSize: 48,
    fontWeight: "800",
    color: "#FFFFFF",
    width: "100%",
    textAlign: "center",
  },
  countdownGoValue: {
    color: "#FFE066",
    fontSize: 52,
  },
  editButton: {
    marginTop: 12,
    alignSelf: "stretch",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(144, 106, 254, 0.35)",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonIcon: {
    marginRight: 6,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4C3F6C",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "700",
    color: "#F8ECFF",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255, 255, 255, 0.78)",
    textAlign: "center",
  },
  footerSection: {
    marginTop: 12,
    marginBottom: 24,
    paddingHorizontal: 6,
  },
  footerHint: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  footerHintText: {
    marginLeft: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#F8ECFF",
    flex: 1,
  },
  startButton: {
    marginTop: 18,
    borderRadius: 20,
    shadowColor: "rgba(59, 178, 184, 0.55)",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 8,
  },
  startButtonDisabled: {
    opacity: 0.8,
    shadowOpacity: 0.15,
  },
  startButtonGradient: {
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  leaveButton: {
    marginTop: 14,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#13093A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  leaveButtonDisabled: {
    opacity: 0.65,
  },
  leaveButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  leaveIcon: {
    marginRight: 8,
  },
  leaveText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  settingsButton: {
    position: "absolute",
    zIndex: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
});


