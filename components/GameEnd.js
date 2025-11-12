import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  ScrollView,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ref, update, remove, get, runTransaction } from "firebase/database";
import { database } from "../firebaseConfig";
import styles from "../styles";
import { canUseMobileAds, loadGoogleMobileAds } from "../utils/googleMobileAds";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
//import AdSenseBanner from './AdSenseBanner'; // Tuo AdSense-komponentti

let WebBannerAd = null;
const ANDROID_INTERSTITIAL_AD_UNIT = "ca-app-pub-7869485729301293/9203602714";
const IOS_INTERSTITIAL_AD_UNIT = "ca-app-pub-7869485729301293/5683769226";
if (Platform.OS === "web") {
  try {
    WebBannerAd = require("./WebBannerAd.web").default;
  } catch (error) {
    console.warn("WebBannerAd unavailable:", error?.message || String(error));
  }
}

export default function GameEnd({ route, navigation }) {
  const { gamepin, username } = route.params || {};
  const [players, setPlayers] = useState([]);

  const longestLeaders = useMemo(() => {
    const sorted = [...players].sort(
      (a, b) =>
        b.treffit - a.treffit ||
        b.accepted - a.accepted ||
        a.username.localeCompare(b.username),
    );
    return sorted;
  }, [players]);

  const skipLeaders = useMemo(() => {
    const sorted = [...players].sort(
      (a, b) =>
        b.skipCount - a.skipCount ||
        b.accepted - a.accepted ||
        a.username.localeCompare(b.username),
    );
    return sorted;
  }, [players]);

  const champion = longestLeaders[0];

  const totalMatchedTraits = useMemo(
    () => players.reduce((sum, player) => sum + (player.accepted || 0), 0),
    [players],
  );

  const highlightStats = useMemo(
    () => [
      {
        key: "players",
        label: "Players",
        value: String(players.length),
        icon: "people-outline",
      },
      {
        key: "winning",
        label: "Winning date",
        value: champion ? `Date ${champion.treffit}` : "\u2014",
        icon: "trophy-outline",
      },
      {
        key: "matches",
        label: "Total matches",
        value: String(totalMatchedTraits),
        icon: "sparkles-outline",
      },
    ],
    [players.length, champion?.treffit, totalMatchedTraits],
  );

  if (!gamepin || !username) {
    console.error("GameEnd: Missing gamepin or username!");
    return null;
  }

  useFocusEffect(
    useCallback(() => {
      const blockBack = (event) => {
        const actionType = event.data?.action?.type;
        if (actionType === "GO_BACK" || actionType === "POP") {
          event.preventDefault();
        }
      };

      const navUnsubscribe = navigation.addListener("beforeRemove", blockBack);
      const hardwareSubscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => true,
      );

      return () => {
        navUnsubscribe();
        hardwareSubscription.remove();
      };
    }, [navigation]),
  );

  // Peli poistetaan 5 minuutin kuluttua
  useEffect(() => {
    const deleteGameTimeout = setTimeout(
      async () => {
        const gameRef = ref(database, `games/${gamepin}`);
        try {
          await remove(gameRef);
          console.log(`Peli ${gamepin} poistettu tietokannasta.`);
        } catch (error) {
          console.error("Virhe pelin poistamisessa:", error);
        }
      },
      5 * 60 * 1000,
    );

    return () => clearTimeout(deleteGameTimeout);
  }, [gamepin]);

  // Show an interstitial ad once when arriving on the Game End screen
  useEffect(() => {
    let interstitial;
    let unsubscribers = [];
    let didShow = false;
    let retried = false;
    (async () => {
      if (!canUseMobileAds) {
        console.log("Interstitial skipped: running in Expo Go or Web");
        return;
      }
      try {
        const { InterstitialAd, TestIds, AdEventType } =
          await loadGoogleMobileAds();
        const adUnitId = __DEV__
          ? TestIds.INTERSTITIAL
          : Platform.OS === "ios"
            ? IOS_INTERSTITIAL_AD_UNIT
            : ANDROID_INTERSTITIAL_AD_UNIT; // GameEnd interstitial (production)
        interstitial = InterstitialAd.createForAdRequest(adUnitId, {
          requestNonPersonalizedAdsOnly: true,
        });
        unsubscribers.push(
          interstitial.addAdEventListener(AdEventType.LOADED, () => {
            console.log("Interstitial loaded");
            try {
              interstitial.show();
              didShow = true;
            } catch (e) {
              console.log("Interstitial show error:", e?.message || String(e));
            }
          }),
        );
        unsubscribers.push(
          interstitial.addAdEventListener(AdEventType.CLOSED, () => {
            console.log("Interstitial closed");
          }),
        );
        unsubscribers.push(
          interstitial.addAdEventListener(AdEventType.ERROR, (e) => {
            console.log("Interstitial error:", e?.message || String(e));
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
        // If loading takes too long, attempt one timed retry
        setTimeout(() => {
          if (!didShow && !retried) {
            retried = true;
            try {
              interstitial.load();
            } catch {}
          }
        }, 4000);
      } catch (e) {
        // SDK not available or not linked
        console.log("Interstitial unavailable:", e?.message || String(e));
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

  // Load leaderboard once
  useEffect(() => {
    (async () => {
      try {
        const playersSnap = await get(
          ref(database, `games/${gamepin}/players`),
        );
        const playersVal = playersSnap.exists() ? playersSnap.val() : {};
        const arr = Object.keys(playersVal).map((key) => {
          const p = playersVal[key] || {};
          const accepted = Array.isArray(p.acceptedTraits)
            ? p.acceptedTraits.length
            : 0;
          const treffit = accepted + 1; // 0 -> 1., 2 -> 3., etc.
          const skipCount = Number(p.skipCount || 0);
          return {
            username: p.username || key,
            accepted,
            treffit,
            skipCount,
          };
        });
        setPlayers(arr);
      } catch (e) {
        console.error("Leaderboard load error", e);
      }
    })();
  }, [gamepin]);

  // Replay: first presser creates new game as host; others join it; go straight to CardTraits
  const handleReplay = async () => {
    try {
      const replayRef = ref(database, `games/${gamepin}/replay`);
      const candidatePin = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { committed, snapshot } = await runTransaction(
        replayRef,
        (current) => {
          if (current && current.newGamepin) {
            return current;
          }
          return {
            newGamepin: candidatePin,
            host: username,
            createdAt: Date.now(),
          };
        },
        { applyLocally: false },
      );

      const replayData = snapshot?.val() || {};
      const targetPin = replayData.newGamepin;
      const hostUser = replayData.host;

      if (!targetPin || !hostUser) {
        console.error("Replay data missing the new game pin or host");
        return;
      }

      const created =
        committed &&
        replayData.newGamepin === candidatePin &&
        hostUser === username;

      if (created) {
        const hostKeySafe = hostUser.replace(/[.#$/\[\]]/g, "_");
        await update(ref(database, `games/${targetPin}`), {
          host: hostUser,
          gamepin: targetPin,
          isGameStarted: false,
        });
        await update(
          ref(database, `games/${targetPin}/players/${hostKeySafe}`),
          {
            username: hostUser,
            traits: [],
            isHost: true,
          },
        );
      }

      const keySafeUsername = username.replace(/[.#$/\[\]]/g, "_");
      const isHost = hostUser === username;
      await update(
        ref(database, `games/${targetPin}/players/${keySafeUsername}`),
        {
          username,
          traits: [],
          isHost,
        },
      );

      navigation.navigate("CardTraits", { username, gamepin: targetPin });
    } catch (error) {
      console.error("Virhe Replay-napissa:", error);
    }
  };

  const handleExit = () => {
    navigation.navigate("GameOptionScreen", { username });
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
      <SafeAreaView style={ge.safeArea} edges={["top", "bottom"]}>
        <View pointerEvents="none" style={ge.decorativeLayer}>
          <View style={ge.blobTop} />
          <View style={ge.blobBottom} />
        </View>
        <ScrollView
          style={ge.scroll}
          contentContainerStyle={ge.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={require("../assets/logoNew.png")}
            style={ge.logo}
          />
          <View style={ge.heroCard}>
            <LinearGradient
              colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0.05)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={ge.heroGradient}
            >
              <View style={ge.heroIconWrap}>
                <Ionicons
                  name={champion ? "trophy" : "sparkles"}
                  size={28}
                  color="#FFD700"
                />
              </View>
              <Text style={ge.heroEyebrow}>Game finished</Text>
              <Text style={ge.heroTitle}>
                {champion
                  ? `${champion.username} claimed the crown`
                  : "Thanks for playing Treffipeli"}
              </Text>
              <Text style={ge.heroSubtitle}>
                {champion
                  ? `Winning date: ${champion.treffit}. Ready for another round?`
                  : "Create a new game or head back to the lobby - the next round awaits!"}
              </Text>
              {champion ? (
                <View style={ge.heroMetaRow}>
                  <Ionicons
                    name="ribbon-outline"
                    size={18}
                    color="#F8ECFF"
                    style={ge.heroMetaIcon}
                  />
                  <Text style={ge.heroMetaText}>
                    {champion.accepted || 0} accepted traits
                  </Text>
                </View>
              ) : null}
            </LinearGradient>
          </View>

          <View style={ge.statsGrid}>
            {highlightStats.map((stat) => (
              <View key={stat.key} style={ge.statCard}>
                <View style={ge.statIconWrap}>
                  <Ionicons name={stat.icon} size={18} color="#F8ECFF" />
                </View>
                <Text style={ge.statValue}>{stat.value}</Text>
                <Text style={ge.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <View style={ge.leaderboardCard}>
            <View style={ge.sectionHeaderRow}>
              <View style={ge.sectionLabelWrap}>
                <Ionicons
                  name="podium-outline"
                  size={18}
                  color="#F8ECFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={ge.sectionLabel}>Longest Dates</Text>
              </View>
              {champion ? (
                <View style={ge.sectionChip}>
                  <Ionicons
                    name="trophy-outline"
                    size={14}
                    color="#FFD700"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={ge.sectionChipText}>Winner</Text>
                </View>
              ) : null}
            </View>

            {longestLeaders.length ? (
              longestLeaders.map((player, index) => {
                const matchLabel = player.accepted === 1 ? "match" : "matches";
                const isChampion = index === 0;
                return (
                  <View
                    key={`${player.username}-longest-${index}`}
                    style={[
                      ge.leaderRow,
                      isChampion ? ge.leaderRowChampion : null,
                    ]}
                  >
                    <View
                      style={[
                        ge.rankBadge,
                        isChampion ? ge.rankBadgeChampion : null,
                      ]}
                    >
                      <Text
                        style={[
                          ge.rankText,
                          isChampion ? ge.rankTextChampion : null,
                        ]}
                      >
                        #{index + 1}
                      </Text>
                    </View>
                    <View style={ge.leaderInfo}>
                      <Text
                        style={[
                          ge.leaderName,
                          isChampion ? ge.leaderNameChampion : null,
                        ]}
                      >
                        {player.username}
                      </Text>
                      <Text style={ge.leaderMeta}>
                        {player.accepted || 0} {matchLabel}
                      </Text>
                    </View>
                    <View
                      style={[
                        ge.scorePill,
                        isChampion ? ge.scorePillChampion : null,
                      ]}
                    >
                      <Text
                        style={[
                          ge.scoreText,
                          isChampion ? ge.scoreTextChampion : null,
                        ]}
                      >
                        Date {player.treffit}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={ge.emptyStateWrap}>
                <Ionicons
                  name="sparkles-outline"
                  size={22}
                  color="rgba(255,255,255,0.6)"
                  style={{ marginBottom: 10 }}
                />
                <Text style={ge.emptyState}>
                  The leaderboard will update as soon as players finish their rounds.
                </Text>
              </View>
            )}
          </View>

          <View style={[ge.leaderboardCard, ge.leaderboardSecondary]}>
            <View style={ge.sectionHeaderRow}>
              <View style={ge.sectionLabelWrap}>
                <Ionicons
                  name="close-circle-outline"
                  size={18}
                  color="#F8ECFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={ge.sectionLabel}>Most Skips</Text>
              </View>
            </View>

            {skipLeaders.length ? (
              skipLeaders.map((player, index) => {
                const skipLabel = player.skipCount === 1 ? "skip" : "skips";
                const isTopSkipper = index === 0 && player.skipCount > 0;
                return (
                  <View
                    key={`${player.username}-skips-${index}`}
                    style={[
                      ge.leaderRow,
                      isTopSkipper ? ge.leaderRowChampion : null,
                    ]}
                  >
                    <View
                      style={[
                        ge.rankBadge,
                        isTopSkipper ? ge.rankBadgeChampion : null,
                      ]}
                    >
                      <Text
                        style={[
                          ge.rankText,
                          isTopSkipper ? ge.rankTextChampion : null,
                        ]}
                      >
                        #{index + 1}
                      </Text>
                    </View>
                    <View style={ge.leaderInfo}>
                      <Text
                        style={[
                          ge.leaderName,
                          isTopSkipper ? ge.leaderNameChampion : null,
                        ]}
                      >
                        {player.username}
                      </Text>
                      <Text style={ge.leaderMeta}>
                        Longest date {player.treffit}
                      </Text>
                    </View>
                    <View
                      style={[
                        ge.scorePill,
                        isTopSkipper ? ge.scorePillChampion : null,
                      ]}
                    >
                      <Text
                        style={[
                          ge.scoreText,
                          isTopSkipper ? ge.scoreTextChampion : null,
                        ]}
                      >
                        {player.skipCount} {skipLabel}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={ge.emptyStateWrap}>
                <Ionicons
                  name="hourglass-outline"
                  size={22}
                  color="rgba(255,255,255,0.6)"
                  style={{ marginBottom: 10 }}
                />
                <Text style={ge.emptyState}>
                  Skips are tracked once players start making decisions.
                </Text>
              </View>
            )}
          </View>

          {Platform.OS === "web" && WebBannerAd ? (
            <View style={ge.adWrap}>
              <WebBannerAd style={ge.ad} />
            </View>
          ) : null}

          <View style={ge.actionsRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleReplay}
              style={ge.actionButton}
            >
              <LinearGradient
                colors={["#906AFE", "#ff66c4"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={ge.actionButtonGradient}
              >
                <Ionicons
                  name="refresh-outline"
                  size={20}
                  color="#ffffff"
                  style={ge.actionIcon}
                />
                <Text style={ge.actionText}>Play again</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleExit}
              style={[ge.actionButton, ge.secondaryActionButton]}
            >
              <LinearGradient
                colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.05)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={ge.actionButtonGradient}
              >
                <Ionicons
                  name="home-outline"
                  size={20}
                  color="#F8ECFF"
                  style={ge.actionIcon}
                />
                <Text style={ge.actionText}>Back to lobby</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const ge = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  decorativeLayer: {
    ...StyleSheet.absoluteFillObject,
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
    backgroundColor: "rgba(255,255,255,0.1)",
    transform: [{ rotate: "-16deg" }],
  },
  scroll: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 52,
  },
  logo: {
    height: 86,
    width: 180,
    resizeMode: "contain",
    marginBottom: 24,
  },
  heroCard: {
    width: "100%",
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 24,
    shadowColor: "#13093A",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 26,
    elevation: 10,
  },
  heroGradient: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255, 215, 0, 0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
  },
  heroSubtitle: {
    marginTop: 10,
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  heroMetaRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  heroMetaIcon: {
    marginRight: 8,
  },
  heroMetaText: {
    color: "#F8ECFF",
    fontSize: 13,
    fontWeight: "600",
  },
  statsGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 24,
    marginHorizontal: -8,
  },
  statCard: {
    minWidth: 120,
    flexBasis: "30%",
    marginHorizontal: 8,
    marginBottom: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  statLabel: {
    marginTop: 4,
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    letterSpacing: 0.6,
    textAlign: "center",
  },
  leaderboardCard: {
    width: "100%",
    borderRadius: 24,
    padding: 20,
    backgroundColor: "rgba(18,22,71,0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    marginBottom: 26,
  },
  leaderboardSecondary: {
    marginTop: 18,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionLabel: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  sectionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,215,0,0.22)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  sectionChipText: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginBottom: 12,
  },
  leaderRowChampion: {
    backgroundColor: "rgba(255,215,0,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  rankBadgeChampion: {
    backgroundColor: "rgba(255,215,0,0.32)",
  },
  rankText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  rankTextChampion: {
    color: "#2b1a00",
  },
  leaderInfo: {
    flex: 1,
  },
  leaderName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  leaderNameChampion: {
    color: "#FFD700",
  },
  leaderMeta: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 2,
  },
  scorePill: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  scorePillChampion: {
    backgroundColor: "rgba(255,215,0,0.28)",
  },
  scoreText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  scoreTextChampion: {
    color: "#2b1a00",
  },
  emptyStateWrap: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  emptyState: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    textAlign: "center",
  },
  adWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  ad: {
    width: "100%",
    minHeight: 90,
  },
  actionsRow: {
    width: "100%",
    flexDirection: "row",
    marginTop: 8,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    marginHorizontal: 6,
  },
  secondaryActionButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  actionButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  actionIcon: {
    marginRight: 10,
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});





