import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
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
import theme from "../utils/theme";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLanguage } from "../contexts/LanguageContext";
import { toUserKey } from "../utils/userKey";
import getLogoSource from "../utils/logo";
import useInterstitialAd from "../hooks/useInterstitialAd";
import { clearSession } from "../utils/session";
import { usePlus } from "../contexts/PlusContext";
import MotionPressable from "./MotionPressable";
import MotionFloat from "./MotionFloat";
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
  const { t, language } = useLanguage();
  const { isPlus } = usePlus();
  const logoSource = getLogoSource(language);

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
        b.skipCount - a.skipCount || a.username.localeCompare(b.username),
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
        key: "winning",
        label: t("Winning date"),
        value: champion
          ? t("Date {{number}}", { number: champion.treffit })
          : "\u2014",
        icon: "trophy-outline",
        accent: "#FFD166",
        gradient: ["rgba(255, 249, 235, 0.98)", "rgba(255, 233, 218, 0.92)"],
        borderColor: "rgba(255, 209, 102, 0.45)",
        iconBackground: "rgba(255, 209, 102, 0.25)",
      },
      {
        key: "players",
        label: t("Players"),
        value: String(players.length),
        icon: "people-outline",
        accent: "#8DD9FF",
        gradient: ["rgba(236, 248, 255, 0.98)", "rgba(226, 236, 255, 0.92)"],
        borderColor: "rgba(141, 217, 255, 0.45)",
        iconBackground: "rgba(141, 217, 255, 0.25)",
      },
      {
        key: "matches",
        label: t("Total matches"),
        value: String(totalMatchedTraits),
        icon: "sparkles-outline",
        accent: "#FF7EC8",
        gradient: ["rgba(255, 236, 246, 0.98)", "rgba(255, 225, 240, 0.92)"],
        borderColor: "rgba(255, 126, 200, 0.45)",
        iconBackground: "rgba(255, 126, 200, 0.25)",
      },
    ],
    [players.length, champion?.treffit, totalMatchedTraits, t],
  );
  const heroTitle = champion
    ? t("{{name}} claimed the crown", { name: champion.username })
    : t("Thanks for playing Treffipeli");
  const heroSubtitle = champion
    ? t("Winning date: {{number}}. Ready for another round?", {
        number: champion.treffit,
      })
    : t(
        "Create a new game or head back to the lobby - the next round awaits!",
      );
  const heroMetaText = champion
    ? t("{{count}} accepted traits", { count: champion.accepted || 0 })
    : "";

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

  useEffect(() => {
    clearSession();
  }, []);

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

  useInterstitialAd({
    iosAdUnitId: IOS_INTERSTITIAL_AD_UNIT,
    androidAdUnitId: ANDROID_INTERSTITIAL_AD_UNIT,
    screenName: "GameEnd",
    autoShow: true,
    showDelayMs: 800,
    enabled: Boolean(gamepin && username) && !isPlus,
  });

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
          const acceptedTraitsCount = Array.isArray(p.acceptedTraits)
            ? p.acceptedTraits.length
            : 0;
          const keepCount =
            p.keepCount === undefined || p.keepCount === null
              ? null
              : Number(p.keepCount);
          const accepted = Number.isFinite(keepCount)
            ? keepCount
            : acceptedTraitsCount;
          const maxAcceptedRaw =
            p.maxAccepted === undefined || p.maxAccepted === null
              ? 0
              : Number(p.maxAccepted);
          const maxAccepted = Math.max(
            Number.isFinite(maxAcceptedRaw) ? maxAcceptedRaw : 0,
            acceptedTraitsCount,
          );
          // Date numbering is 1-based, so add 1 to the accepted streak.
          const treffit = Math.min(maxAccepted + 1, 6);
          const skipCount = Number.isFinite(Number(p.skipCount))
            ? Number(p.skipCount)
            : 0;
          return {
            username: p.username || key,
            accepted,
            treffit,
            skipCount,
            maxAccepted,
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
        const hostKeySafe = toUserKey(hostUser);
        await update(ref(database, `games/${targetPin}`), {
          host: hostUser,
          gamepin: targetPin,
          isGameStarted: false,
        });
        await update(
          ref(database, `games/${targetPin}/players/${hostKeySafe}`),
          {
            username: hostUser,
            usernameKey: hostKeySafe,
            traits: [],
            isHost: true,
          },
        );
      }

      const keySafeUsername = toUserKey(username);
      const isHost = hostUser === username;
      await update(
        ref(database, `games/${targetPin}/players/${keySafeUsername}`),
        {
          username,
          usernameKey: keySafeUsername,
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
        colors={["#ff66c4", "#ffde59"]}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      <SafeAreaView style={ge.safeArea} edges={["top", "bottom"]}>
        <View pointerEvents="none" style={ge.decorativeLayer}>
          <MotionFloat style={ge.blobTop} driftX={9} driftY={-13} />
          <MotionFloat
            style={ge.blobBottom}
            driftX={-7}
            driftY={11}
            delay={450}
          />
        </View>
        <ScrollView
          style={ge.scroll}
          contentContainerStyle={ge.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={logoSource}
            style={ge.logo}
          />
          <View style={ge.heroCard}>
            <LinearGradient
              colors={["rgba(255, 255, 255, 0.96)", "rgba(255, 232, 244, 0.9)"]}
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
              <View style={ge.heroBadge}>
                <Text style={ge.heroEyebrow}>{t("Game finished")}</Text>
              </View>
              <Text style={ge.heroTitle}>{heroTitle}</Text>
              <Text style={ge.heroSubtitle}>{heroSubtitle}</Text>
              {champion ? (
                <View style={ge.heroMetaRow}>
                  <Ionicons
                    name="ribbon-outline"
                    size={18}
                    color={theme.accentPrimary}
                    style={ge.heroMetaIcon}
                  />
                  <Text style={ge.heroMetaText}>{heroMetaText}</Text>
                </View>
              ) : null}
            </LinearGradient>
          </View>

          <View style={ge.statsGrid}>
            {highlightStats.map((stat) => {
              const isWide = stat.key === "winning";
              return (
              <LinearGradient
                key={stat.key}
                colors={stat.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  ge.statCard,
                  isWide && ge.statCardWide,
                  { borderColor: stat.borderColor },
                ]}
              >
                <View
                  style={[
                    ge.statIconWrap,
                    {
                      backgroundColor: stat.iconBackground,
                      borderColor: stat.borderColor,
                    },
                  ]}
                >
                  <Ionicons name={stat.icon} size={18} color={stat.accent} />
                </View>
                <Text
                  style={[ge.statValue, isWide && ge.statValueWide]}
                  numberOfLines={1}
                >
                  {stat.value}
                </Text>
                <Text
                  style={[ge.statLabel, isWide && ge.statLabelWide]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {stat.label}
                </Text>
              </LinearGradient>
              );
            })}
          </View>

          <View style={ge.leaderboardCard}>
            <View style={ge.sectionHeaderRow}>
              <View style={ge.sectionLabelWrap}>
                <Ionicons
                  name="podium-outline"
                  size={18}
                  color={theme.accentPrimary}
                  style={{ marginRight: 8 }}
                />
                <Text style={ge.sectionLabel}>{t("Longest Dates")}</Text>
              </View>
              {champion ? (
                <View style={ge.sectionChip}>
                  <Ionicons
                    name="trophy-outline"
                    size={14}
                    color="#FFD700"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={ge.sectionChipText}>{t("Winner")}</Text>
                </View>
              ) : null}
            </View>

            {longestLeaders.length ? (
              longestLeaders.map((player, index) => {
                const matchLabel =
                  player.accepted === 1 ? t("match") : t("matches");
                const rank = index + 1;
                const isGold = rank === 1;
                const isSilver = rank === 2;
                const isBronze = rank === 3;
                return (
                  <View
                    key={`${player.username}-longest-${index}`}
                    style={[
                      ge.leaderRow,
                      (isGold || isSilver || isBronze) && ge.leaderRowTop,
                      isGold && ge.leaderRowChampion,
                      isSilver && ge.leaderRowSilver,
                      isBronze && ge.leaderRowBronze,
                    ]}
                  >
                    <View
                      style={[
                        ge.rankBadge,
                        isGold && ge.rankBadgeChampion,
                        isSilver && ge.rankBadgeSilver,
                        isBronze && ge.rankBadgeBronze,
                      ]}
                    >
                      <Text
                        style={[
                          ge.rankText,
                          isGold && ge.rankTextChampion,
                          isSilver && ge.rankTextSilver,
                          isBronze && ge.rankTextBronze,
                        ]}
                      >
                        #{rank}
                      </Text>
                    </View>
                    <View style={ge.leaderInfo}>
                      <Text
                        style={[
                          ge.leaderName,
                          isGold && ge.leaderNameChampion,
                          isSilver && ge.leaderNameSilver,
                          isBronze && ge.leaderNameBronze,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {player.username}
                      </Text>
                      <Text
                        style={ge.leaderMeta}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {player.accepted || 0} {matchLabel}
                      </Text>
                    </View>
                    <View
                      style={[
                        ge.scorePill,
                        isGold && ge.scorePillChampion,
                        isSilver && ge.scorePillSilver,
                        isBronze && ge.scorePillBronze,
                      ]}
                    >
                      <Text
                        style={[
                          ge.scoreText,
                          isGold && ge.scoreTextChampion,
                          isSilver && ge.scoreTextSilver,
                          isBronze && ge.scoreTextBronze,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="clip"
                      >
                        {t("Date {{number}}", { number: player.treffit })}
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
                  color={theme.helperText}
                  style={{ marginBottom: 10 }}
                />
                <Text style={ge.emptyState}>
                  {t(
                    "The leaderboard will update as soon as players finish their rounds.",
                  )}
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
                  color={theme.accentPrimary}
                  style={{ marginRight: 8 }}
                />
                <Text style={ge.sectionLabel}>{t("Most Skips")}</Text>
              </View>
            </View>

            {skipLeaders.length ? (
              skipLeaders.map((player, index) => {
                const skipLabel =
                  player.skipCount === 1 ? t("skip") : t("skips");
                const rank = index + 1;
                const isGold = rank === 1;
                const isSilver = rank === 2;
                const isBronze = rank === 3;
                return (
                  <View
                    key={`${player.username}-skips-${index}`}
                    style={[
                      ge.leaderRow,
                      (isGold || isSilver || isBronze) && ge.leaderRowTop,
                      isGold && ge.leaderRowChampion,
                      isSilver && ge.leaderRowSilver,
                      isBronze && ge.leaderRowBronze,
                    ]}
                  >
                    <View
                      style={[
                        ge.rankBadge,
                        isGold && ge.rankBadgeChampion,
                        isSilver && ge.rankBadgeSilver,
                        isBronze && ge.rankBadgeBronze,
                      ]}
                    >
                      <Text
                        style={[
                          ge.rankText,
                          isGold && ge.rankTextChampion,
                          isSilver && ge.rankTextSilver,
                          isBronze && ge.rankTextBronze,
                        ]}
                      >
                        #{rank}
                      </Text>
                    </View>
                    <View style={ge.leaderInfo}>
                      <Text
                        style={[
                          ge.leaderName,
                          isGold && ge.leaderNameChampion,
                          isSilver && ge.leaderNameSilver,
                          isBronze && ge.leaderNameBronze,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {player.username}
                      </Text>
                    </View>
                    <View
                      style={[
                        ge.scorePill,
                        isGold && ge.scorePillChampion,
                        isSilver && ge.scorePillSilver,
                        isBronze && ge.scorePillBronze,
                      ]}
                    >
                      <Text
                        style={[
                          ge.scoreText,
                          isGold && ge.scoreTextChampion,
                          isSilver && ge.scoreTextSilver,
                          isBronze && ge.scoreTextBronze,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="clip"
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
                  color={theme.helperText}
                  style={{ marginBottom: 10 }}
                />
                <Text style={ge.emptyState}>
                  {t(
                    "Skips are tracked once players start making decisions.",
                  )}
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
            <MotionPressable
              activeOpacity={0.9}
              onPress={handleReplay}
              style={ge.actionButton}
            >
              <LinearGradient
                colors={["#FFB347", "#FF416C"]}
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
                <Text style={ge.actionText}>{t("Play again")}</Text>
              </LinearGradient>
            </MotionPressable>
            <MotionPressable
              activeOpacity={0.9}
              onPress={handleExit}
              style={[ge.actionButton, ge.secondaryActionButton]}
            >
              <LinearGradient
                colors={["#42E695", "#3BB2B8"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={ge.actionButtonGradient}
              >
                <Ionicons
                  name="home-outline"
                  size={20}
                  color="#ffffff"
                  style={ge.actionIcon}
                />
                <Text style={ge.actionText}>{t("Back to lobby")}</Text>
              </LinearGradient>
            </MotionPressable>
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
    borderWidth: 1,
    borderColor: "rgba(255, 145, 77, 0.25)",
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
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroBadge: {
    backgroundColor: "rgba(255, 145, 77, 0.16)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 145, 77, 0.35)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 10,
  },
  heroEyebrow: {
    color: theme.metaLabel,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: theme.bodyText,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  heroSubtitle: {
    marginTop: 10,
    color: theme.bodyMuted,
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
  },
  heroMetaRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 145, 77, 0.14)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  heroMetaIcon: {
    marginRight: 8,
  },
  heroMetaText: {
    color: theme.bodyText,
    fontSize: 13,
    fontWeight: "600",
  },
  statsGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "stretch",
    marginBottom: 26,
    marginHorizontal: -6,
  },
  statCard: {
    flexBasis: "32%",
    minWidth: 128,
    marginHorizontal: 6,
    marginBottom: 14,
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 145, 77, 0.2)",
    shadowColor: "rgba(76, 19, 58, 0.18)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 7,
  },
  statCardWide: {
    flexBasis: "100%",
    minWidth: "100%",
    marginHorizontal: 0,
    paddingVertical: 20,
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 145, 77, 0.2)",
  },
  statValue: {
    color: theme.bodyText,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  statValueWide: {
    fontSize: 26,
  },
  statLabel: {
    marginTop: 6,
    color: theme.metaLabel,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    lineHeight: 16,
    textAlign: "center",
    textTransform: "uppercase",
    flexShrink: 1,
  },
  statLabelWide: {
    letterSpacing: 1,
  },
  leaderboardCard: {
    width: "100%",
    borderRadius: 24,
    padding: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(255, 145, 77, 0.2)",
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
    color: theme.bodyText,
    fontSize: 18,
    fontWeight: "700",
  },
  sectionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 209, 102, 0.28)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 209, 102, 0.45)",
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  sectionChipText: {
    color: theme.badgeText,
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
    backgroundColor: "rgba(255, 239, 248, 0.92)",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 145, 77, 0.2)",
  },
  leaderRowTop: {
    paddingVertical: 16,
    shadowColor: "rgba(76, 19, 58, 0.18)",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 9,
  },
  leaderRowChampion: {
    backgroundColor: "rgba(255, 209, 102, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(255, 209, 102, 0.45)",
  },
  leaderRowSilver: {
    backgroundColor: "rgba(226, 232, 240, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.45)",
  },
  leaderRowBronze: {
    backgroundColor: "rgba(255, 203, 164, 0.3)",
    borderWidth: 1,
    borderColor: "rgba(255, 185, 133, 0.5)",
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 145, 77, 0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  rankBadgeChampion: {
    backgroundColor: "rgba(255, 209, 102, 0.35)",
  },
  rankBadgeSilver: {
    backgroundColor: "rgba(226, 232, 240, 0.65)",
  },
  rankBadgeBronze: {
    backgroundColor: "rgba(255, 203, 164, 0.4)",
  },
  rankText: {
    color: theme.bodyText,
    fontSize: 16,
    fontWeight: "700",
  },
  rankTextChampion: {
    color: "#7c2d12",
  },
  rankTextSilver: {
    color: "#334155",
  },
  rankTextBronze: {
    color: "#9a3412",
  },
  leaderInfo: {
    flex: 1,
    minWidth: 0,
  },
  leaderName: {
    color: theme.bodyText,
    fontSize: 16,
    fontWeight: "600",
  },
  leaderNameChampion: {
    color: "#9a3412",
  },
  leaderNameSilver: {
    color: "#475569",
  },
  leaderNameBronze: {
    color: "#b45309",
  },
  leaderMeta: {
    color: theme.bodyMuted,
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  scorePill: {
    backgroundColor: "rgba(255, 145, 77, 0.16)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 145, 77, 0.3)",
    flexShrink: 0,
  },
  scorePillChampion: {
    backgroundColor: "rgba(255, 209, 102, 0.28)",
    borderColor: "rgba(255, 209, 102, 0.45)",
  },
  scorePillSilver: {
    backgroundColor: "rgba(226, 232, 240, 0.6)",
    borderColor: "rgba(148, 163, 184, 0.4)",
  },
  scorePillBronze: {
    backgroundColor: "rgba(255, 203, 164, 0.45)",
    borderColor: "rgba(255, 185, 133, 0.45)",
  },
  scoreText: {
    color: theme.metaLabel,
    fontSize: 14,
    fontWeight: "700",
  },
  scoreTextChampion: {
    color: "#7c2d12",
  },
  scoreTextSilver: {
    color: "#334155",
  },
  scoreTextBronze: {
    color: "#9a3412",
  },
  emptyStateWrap: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  emptyState: {
    color: theme.bodyMuted,
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
    shadowColor: "rgba(0,0,0,0.35)",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  secondaryActionButton: {
    shadowColor: "rgba(66, 230, 149, 0.45)",
    shadowOpacity: 0.5,
  },
  actionButtonGradient: {
    flex: 1,
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







