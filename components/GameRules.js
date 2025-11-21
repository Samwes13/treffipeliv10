import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "../contexts/LanguageContext";

export default function GameRules() {
  const { t } = useLanguage();

  const gettingStarted = [
    "Each player writes 3 good and 3 challenging traits about a fictional date partner.",
    "Make sure every player finishes entering their traits before you start.",
    "Only the host (creator) can start the game countdown.",
  ];

  const howItWorks = [
    "The game has 6 rounds and cycles through every player.",
    "Each round reveals one random trait for the current player.",
    'Decision: "Keep" adds the trait to your Accepted list; "Skip" clears the list and starts fresh.',
  ];

  const bonusChallenges = [
    "On dates 1, 3, 5, and 6, add a fun twist about how the trait might play out.",
    "Whoever drew the trait explains how they would handle it on that date.",
    'If you tap "Skip", come up with a dramatic excuse for ending the date.',
  ];

  return (
    <ScrollView contentContainerStyle={s.container}>
      <LinearGradient
        colors={["#ff66c4", "#ffde59"]}
        style={s.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={s.headerTitle}>{t("Treffipeli Rules")}</Text>
        <Text style={s.headerSubtitle}>{t("Quick guide to playing")}</Text>
      </LinearGradient>

      <View style={s.card}>
        <Text style={s.cardTitle}>{t("Getting Started")}</Text>
        {gettingStarted.map((line) => (
          <Text key={line} style={s.bullet}>
            - {t(line)}
          </Text>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>{t("How It Works")}</Text>
        {howItWorks.map((line) => (
          <Text key={line} style={s.bullet}>
            - {t(line)}
          </Text>
        ))}
      </View>

      <View style={s.cardAlt}>
        <Text style={s.cardTitleAlt}>{t("Bonus Challenges")}</Text>
        {bonusChallenges.map((line) => (
          <Text key={line} style={s.bulletAlt}>
            - {t(line)}
          </Text>
        ))}
      </View>

      <View style={s.note}>
        <Text style={s.noteTitle}>{t("Reminder")}</Text>
        <Text style={s.noteText}>
          {t("Enjoy the game and keep the vibe friendly!")}
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
  header: {
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.95)",
    textAlign: "center",
    marginTop: 6,
  },
  card: {
    backgroundColor: "#F7F5FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: {
    color: "#6E56CF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  bullet: {
    color: "#44337A",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },
  cardAlt: {
    backgroundColor: "#FFF6E5",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardTitleAlt: {
    color: "#AD5A00",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  bulletAlt: {
    color: "#5C3B09",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },
  note: {
    backgroundColor: "#EBFFEF",
    borderRadius: 12,
    padding: 14,
  },
  noteTitle: {
    color: "#137333",
    fontWeight: "700",
    marginBottom: 6,
    fontSize: 16,
  },
  noteText: {
    color: "#0B5130",
    fontSize: 15,
  },
});


