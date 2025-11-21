import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ref, set, update, get, remove } from "firebase/database";
import { seedPlayersWithTraits } from "../utils/debugSeed";
import { database } from "../firebaseConfig";
import styles from "../styles";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "../contexts/LanguageContext";

const BASE_TRAITS = [
  "Funny",
  "Kind",
  "Smart",
  "Brave",
  "Calm",
  "Cheerful",
  "Curious",
  "Generous",
  "Patient",
  "Friendly",
  "Honest",
  "Adventurous",
];
const COMMON_DUPES = ["Funny", "Kind", "Honest"];

function toSevenSentences(core, playerIndex, traitIndex) {
  const seed = `${core} ${playerIndex}-${traitIndex}`;
  return [
    `${seed} sentence one.`,
    `${seed} sentence two.`,
    `${seed} sentence three.`,
    `${seed} sentence four.`,
    `${seed} sentence five.`,
    `${seed} sentence six.`,
    `${seed} sentence seven.`,
  ].join(" ");
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const BOT_COUNT = 8;
const BOT_NAMES = Array.from(
  { length: BOT_COUNT },
  (_, i) => `bot${String(i + 1).padStart(2, "0")}`,
);

export default function DebugSimulate({ navigation }) {
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const { t } = useLanguage();

  const log = (msg) => setLogs((l) => [msg, ...l].slice(0, 200));

  const startGameWithDedup = async (gamepin) => {
    const traitsRef = ref(database, `games/${gamepin}/traits`);
    const traitsSnapshot = await get(traitsRef);
    if (!traitsSnapshot.exists()) return [];

    const traitsData = traitsSnapshot.val();
    const all = [];
    Object.keys(traitsData).forEach((uname) => {
      const pTraits = traitsData[uname];
      if (!pTraits || typeof pTraits !== "object") return;
      Object.values(pTraits).forEach((t) => all.push(t));
    });

    const shuffled = shuffle(all.slice());
    const flatObj = {};
    shuffled.forEach((t, i) => {
      flatObj[i] = { traitId: t.traitId, text: t.text, order: i };
    });

    await set(traitsRef, flatObj);
    Object.keys(traitsData).forEach((uname) => {
      remove(ref(database, `games/${gamepin}/traits/${uname}`));
    });

    if (shuffled.length === 0) return [];

    await update(ref(database, `games/${gamepin}`), {
      currentTrait: shuffled[0],
      usedTraits: [shuffled[0].traitId],
      currentPlayerIndex: 0,
      currentRound: 1,
      isGameStarted: true,
    });

    return shuffled;
  };

  const simulateRounds = async (gamepin) => {
    const gameRef = ref(database, `games/${gamepin}`);
    const snap = await get(gameRef);
    const data = snap.val();
    let traits = data.traits ? Object.values(data.traits) : [];
    let usedTraits = Array.isArray(data.usedTraits)
      ? data.usedTraits.slice()
      : [];
    let currentTrait = data.currentTrait || null;
    let currentPlayerIndex = data.currentPlayerIndex || 0;
    let currentRound = data.currentRound || 1;

    const usernames = Object.keys(data.players || {}).sort();
    const decisionCounts = Object.fromEntries(usernames.map((u) => [u, 0]));
    const seen = new Map();
    usedTraits.forEach((traitId) => {
      seen.set(traitId, (seen.get(traitId) || 0) + 1);
    });
    let duplicateCount = 0;

    const pickNextTrait = () => {
      const avail = traits.filter((t) => !usedTraits.includes(t.traitId));
      if (avail.length === 0) return null;
      const r = Math.floor(Math.random() * avail.length);
      return avail[r];
    };

    while (currentRound <= 6) {
      const uname = usernames[currentPlayerIndex];
      const decideYes = Math.random() < 0.5;

      const playerRef = ref(database, `games/${gamepin}/players/${uname}`);
      const pSnap = await get(playerRef);
      const pData = pSnap.val() || {};
      let accepted = Array.isArray(pData.acceptedTraits)
        ? pData.acceptedTraits.slice()
        : [];
      if (decideYes) {
        if (currentTrait) accepted = [...accepted, currentTrait];
      } else {
        accepted = [];
      }
      await update(playerRef, { acceptedTraits: accepted });
      decisionCounts[uname] = (decisionCounts[uname] || 0) + 1;

      const nextTrait = pickNextTrait();
      if (nextTrait) {
        const previousCount = seen.get(nextTrait.traitId) || 0;
        if (previousCount > 0) {
          duplicateCount += 1;
          const message = t(
            "Duplicate trait encountered (#{{count}}): {{id}} - {{text}}",
            {
              count: duplicateCount,
              id: nextTrait.traitId,
              text: nextTrait.text,
            },
          );
          log(message);
          console.log(`[DebugSim] ${message}`);
        }
        usedTraits = usedTraits.concat(nextTrait.traitId);
        seen.set(nextTrait.traitId, previousCount + 1);
        currentTrait = nextTrait;
      } else {
        currentTrait = null;
      }

      const nextPlayerIndex = (currentPlayerIndex + 1) % usernames.length;
      const nextRound = nextPlayerIndex === 0 ? currentRound + 1 : currentRound;

      currentPlayerIndex = nextPlayerIndex;
      currentRound = nextRound;

      await update(gameRef, {
        currentTrait,
        usedTraits,
        currentPlayerIndex,
        currentRound,
      });
    }

    const offenders = Object.entries(decisionCounts).filter(([, c]) => c !== 6);
    if (offenders.length) {
      const details = offenders.map(([u, c]) => `${u}:${c}`).join(", ");
      log(t("Decision count mismatch: {{details}}", { details }));
    } else {
      log(t("All players made 6 decisions."));
    }

    if (duplicateCount > 0) {
      const summary = t(
        "Duplicate traits encountered {{count}} time(s) during headless simulation.",
        { count: duplicateCount },
      );
      log(summary);
      console.log(`[DebugSim] ${summary}`);
    } else {
      const summary = t(
        "No duplicate traits encountered during headless simulation.",
      );
      log(summary);
      console.log(`[DebugSim] ${summary}`);
    }

    log(
      t(
        "Simulation finished at round {{round}}. Used traits: {{used}}. Unique traits: {{unique}}",
        { round: currentRound, used: usedTraits.length, unique: seen.size },
      ),
    );
  };

  const run = async () => {
    if (running) return;
    setRunning(true);
    setLogs([]);
    try {
      const gamepin = `SIM${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      log(
        t("Creating game {{pin}} with {{count}} bots...", {
          pin: gamepin,
          count: BOT_COUNT,
        }),
      );
      await seedPlayersWithTraits({
        gamepin,
        usernames: BOT_NAMES,
        traitFactory: ({ playerIndex, traitIndex }) => {
          const idx = playerIndex + 1;
          const base =
            traitIndex < COMMON_DUPES.length
              ? COMMON_DUPES[traitIndex % COMMON_DUPES.length]
              : BASE_TRAITS[(playerIndex + traitIndex) % BASE_TRAITS.length];
          return toSevenSentences(base, idx, traitIndex);
        },
      });
      log(t("Starting game with all traits (ID-unique during play)..."));
      const list = await startGameWithDedup(gamepin);
      log(t("Total traits loaded: {{count}}", { count: list.length }));
      const useUiAutoplay = __DEV__ === true;
      try {
        navigation.navigate("GamePlay", {
          gamepin,
          username: BOT_NAMES[0],
          debugAutoPlay: useUiAutoplay,
        });
      } catch (_) {}
      if (useUiAutoplay) {
        log(
          t(
            "Autoplay running inside GamePlay. Check console for duplicate trait stats.",
          ),
        );
      } else {
        await simulateRounds(gamepin);
        log(t("Headless simulation complete."));
      }
    } catch (e) {
      console.error(e);
      log(t("Error: {{message}}", { message: e?.message || String(e) }));
    } finally {
      setRunning(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={["#ff66c4", "transparent"]}
        style={styles.background}
        start={{ x: 1, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.container}>
          <Text style={styles.title}>{t("Debug Bot Simulator")}</Text>
          <TouchableOpacity
            style={[styles.button, running && styles.disabledButton]}
            disabled={running}
            onPress={run}
          >
            <Text style={styles.buttonText}>
              {running
                ? t("Running...")
                : t("Run {{count}}-Bot Simulation", { count: BOT_COUNT })}
            </Text>
          </TouchableOpacity>
          <ScrollView style={{ maxHeight: 300, marginTop: 16, width: "100%" }}>
            {logs.map((l, i) => (
              <Text key={i} style={styles.playerText}>
                {l}
              </Text>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}


