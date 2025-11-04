import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ref,
  onValue,
  update,
  remove,
  get,
  set,
  runTransaction,
} from "firebase/database";
import { database } from "../firebaseConfig";
import styles from "../styles";
import { canUseMobileAds, loadGoogleMobileAds } from "../utils/googleMobileAds";
import { LinearGradient } from "expo-linear-gradient";
import ModalAlert from "./ModalAlert";
import { Ionicons } from "@expo/vector-icons";

const INITIAL_ANIMATION_DURATION_MS = 4000;
const GAME_START_COUNTDOWN_MS = 4000;

export default function GameLobby({ route, navigation }) {
  const { username, gamepin } = route.params;
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [allPlayersReady, setAllPlayersReady] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [countdownData, setCountdownData] = useState(null);
  const [countdownStep, setCountdownStep] = useState(null);
  const [countdownActive, setCountdownActive] = useState(false);

  useEffect(() => {
    const gameRef = ref(database, `games/${gamepin}`);

    const unsubscribe = onValue(gameRef, (snapshot) => {
      const gameData = snapshot.val();

      if (!gameData) {
        setCountdownData(null);
        return;
      }

      const playerList = Object.values(gameData.players || {});
      setPlayers(playerList);

      const currentPlayer = playerList.find(
        (player) => player.username === username,
      );

      if (!currentPlayer) {
        navigation.navigate("GameOptionScreen", { username });
        return;
      }

      if (gameData.players[username]?.isHost) {
        setIsHost(true);
      } else {
        setIsHost(false);
      }

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
  }, [gamepin, username, navigation]);

  useEffect(() => {
    let interstitial;
    let unsubscribers = [];
    let didShow = false;
    let retried = false;

    (async () => {
      if (!canUseMobileAds) {
        console.log("Lobby interstitial skipped: unsupported platform");
        return;
      }

      try {
        const { InterstitialAd, TestIds, AdEventType } =
          await loadGoogleMobileAds();
        const adUnitId = __DEV__
          ? TestIds.INTERSTITIAL
          : "ca-app-pub-7869485729301293/9203602714";
        interstitial = InterstitialAd.createForAdRequest(adUnitId, {
          requestNonPersonalizedAdsOnly: true,
        });

        unsubscribers.push(
          interstitial.addAdEventListener(AdEventType.LOADED, () => {
            try {
              interstitial.show();
              didShow = true;
            } catch (e) {
              console.log("Lobby interstitial show error:", e?.message || String(e));
            }
          }),
        );

        unsubscribers.push(
          interstitial.addAdEventListener(AdEventType.CLOSED, () => {
            console.log("Lobby interstitial closed");
          }),
        );

        unsubscribers.push(
          interstitial.addAdEventListener(AdEventType.ERROR, (e) => {
            console.log("Lobby interstitial error:", e?.message || String(e));
            if (!retried) {
              retried = true;
              setTimeout(() => {
                try {
                  interstitial.load();
                } catch {}
              }, 1200);
            }
          }),
        );

        interstitial.load();

        setTimeout(() => {
          if (!didShow && !retried) {
            retried = true;
            try {
              interstitial.load();
            } catch {}
          }
        }, 4000);
      } catch (e) {
        console.log("Lobby interstitial unavailable:", e?.message || String(e));
      }
    })();

    return () => {
      unsubscribers.forEach((unsub) => {
        try {
          unsub && unsub();
        } catch {}
      });
    };
  }, []);

  useEffect(() => {
    if (!countdownData?.startAt || !countdownData?.durationMs) {
      setCountdownStep(null);
      setCountdownActive(false);
      return;
    }

    const steps = ["3", "2", "1", "GO!"];
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
  }, [countdownData]);

  useEffect(() => {
    if (isGameStarted) {
      navigation.navigate("GamePlay", { username, gamepin });
    }
  }, [isGameStarted, navigation, gamepin, username]);

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

          await update(ref(database, `games/${gamepin}`), {
            currentTrait: shuffledTraits[0],
            usedTraits: [shuffledTraits[0].traitId],
            currentPlayerIndex: 0,
            currentRound: 1,
            isGameStarted: true,
          });

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

  const showRemoveModal = (playerUsername) => {
    setPlayerToRemove(playerUsername);
    setModalVisible(true);
  };

  const removePlayer = async () => {
    if (!playerToRemove) {
      setModalVisible(false);
      return;
    }

    try {
      const playerRef = ref(
        database,
        `games/${gamepin}/players/${playerToRemove}`,
      );
      await remove(playerRef);

      const traitsRef = ref(
        database,
        `games/${gamepin}/traits/${playerToRemove}`,
      );
      await remove(traitsRef);

      if (playerToRemove === username) {
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
        source={require("../assets/logoNew.png")}
        style={localStyles.logo}
      />
      <View style={localStyles.hero}>
        <Text style={localStyles.heroTitle}>Game Lobby</Text>
        <Text style={localStyles.heroSubtitle}>
          Wait here until everyone is in and ready to go. Share the game code
          with friends and keep an eye on their progress.
        </Text>
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
              <Ionicons name="pricetag-outline" size={16} color="#FFE5FF" />
              <Text style={localStyles.pinBadgeText}>{gamepin}</Text>
            </View>
            <View style={localStyles.summaryTag}>
              <Ionicons name="people-outline" size={16} color="#6B5D92" />
              <Text style={localStyles.summaryTagText}>
                {players.length} players
              </Text>
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
                <Text style={localStyles.summaryLabel}>Ready</Text>
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
                <Text style={localStyles.summaryLabel}>In progress</Text>
                <Text style={localStyles.summaryValue}>
                  {Math.max(players.length - readyCount, 0)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  const renderPlayer = ({ item }) => {
    const ready = !!item.traitsCompleted;
    const canRemove = isHost && item.username !== username;
    const isCurrentUser = item.username === username;
    const initial =
      item.username && item.username.length > 0
        ? item.username.charAt(0).toUpperCase()
        : "?";

    return (
      <View style={localStyles.playerCard}>
        {canRemove && (
          <TouchableOpacity
            onPress={() => showRemoveModal(item.username)}
            style={localStyles.removeButton}
            accessibilityRole="button"
            accessibilityLabel={`Poista ${item.username}`}
          >
            <Ionicons name="remove-circle" size={20} color="#ef4444" />
          </TouchableOpacity>
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
            {ready ? "Ready" : "In progress"}
          </Text>
          {!ready && (
            <ActivityIndicator
              size="small"
              color="#906AFE"
              style={localStyles.playerSpinner}
            />
          )}
        </View>
        {isCurrentUser && (
          <TouchableOpacity
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
            <Text style={localStyles.editButtonText}>Edit Traits</Text>
          </TouchableOpacity>
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
              color="#6B5D92"
            />
            <Text style={localStyles.footerHintText}>
              {countdownActive
                ? "Countdown in progress — get ready!"
                : allPlayersReady
                ? "Everyone is ready! Start the game whenever you like."
                : "Waiting for players to finish prepping before we begin."}
            </Text>
          </View>
          <TouchableOpacity
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
                  ? ["#906AFE", "#ff66c4"]
                  : ["rgba(144,106,254,0.45)", "rgba(255,102,196,0.45)"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={localStyles.startButtonGradient}
            >
              <Text style={localStyles.startButtonText}>
                {countdownActive ? "Starting..." : "Start Game"}
              </Text>
              <Ionicons name="play-circle" size={26} color="#ffffff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={localStyles.footerSection}>
        <View style={localStyles.footerHint}>
          <Ionicons
            name={countdownActive ? "timer-outline" : "hourglass-outline"}
            size={18}
            color="#6B5D92"
          />
          <Text style={localStyles.footerHintText}>
            {countdownActive
              ? "Countdown started! Get ready to jump in."
              : "Waiting for the host to start the game. We'll notify you as soon as it begins."}
          </Text>
        </View>
      </View>
    );
  };


  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={["#5170ff", "#ff66c4"]}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      <SafeAreaView style={localStyles.safeArea} edges={["top", "bottom"]}>
        <View pointerEvents="none" style={localStyles.decorativeLayer}>
          <View style={localStyles.blobLarge} />
          <View style={localStyles.blobSmall} />
        </View>

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
                  Waiting for the first players
                </Text>
                <Text style={localStyles.emptyText}>
                  Share the game code with your friends. Players will appear
                  here as soon as they join.
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
          title="Remove Player"
          message={`Are you sure you want to remove ${playerToRemove || ""} from the game?`}
          buttons={[
            { text: "Remove", onPress: removePlayer },
            { text: "Cancel", onPress: () => {} },
          ]}
          onClose={() => setModalVisible(false)}
        />
        {countdownStep && (
          <View style={localStyles.countdownOverlay}>
            <LinearGradient
              colors={["#906AFE", "#ff66c4"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={localStyles.countdownBox}
            >
              <Text style={localStyles.countdownTitle}>
                Game starting in
              </Text>
              <Text
                style={[
                  localStyles.countdownValue,
                  countdownStep === "GO!" && localStyles.countdownGoValue,
                ]}
              >
                {countdownStep}
              </Text>
            </LinearGradient>
          </View>
        )}
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
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pinBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pinBadgeText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#4C416A",
    textTransform: "uppercase",
  },
  summaryTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(144, 106, 254, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  summaryTagText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: "600",
    color: "#6B5D92",
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
    color: "#221641",
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
    color: "#221641",
  },
  playerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#362B58",
    textAlign: "center",
    marginBottom: 10,
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
  },
  countdownValue: {
    marginTop: 12,
    fontSize: 48,
    fontWeight: "800",
    color: "#FFFFFF",
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
  },
  startButtonDisabled: {
    opacity: 0.7,
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
});
