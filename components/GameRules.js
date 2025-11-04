import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function GameRules() {
  return (
    <ScrollView contentContainerStyle={s.container}>
      <LinearGradient
        colors={["#5170ff", "#ff66c4"]}
        style={s.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={s.headerTitle}>Treffipeli Rules</Text>
        <Text style={s.headerSubtitle}>Quick guide to playing</Text>
      </LinearGradient>

      <View style={s.card}>
        <Text style={s.cardTitle}>Getting Started</Text>
        <Text style={s.bullet}>
          • Each player writes 3 good and 3 bad traits about a fictional date
          partner.
        </Text>
        <Text style={s.bullet}>
          • Start the game when everyone has finished entering traits.
        </Text>
        <Text style={s.bullet}>• The host (creator) starts the game.</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>How It Works</Text>
        <Text style={s.bullet}>• The game has 6 rounds.</Text>
        <Text style={s.bullet}>
          • Each round shows a random trait to the current player.
        </Text>
        <Text style={s.bullet}>
          • Decision: "Yes" adds the trait to your Accepted list. "No" clears
          your Accepted list.
        </Text>
      </View>

      <View style={s.cardAlt}>
        <Text style={s.cardTitleAlt}>Bonus Challenges</Text>
        <Text style={s.bulletAlt}>
          • On dates 1, 3, 5, and 6: share a fun twist about how the trait could play out.
        </Text>
        <Text style={s.bulletAlt}>
          • The player who received the trait describes how they would handle it on the date.
        </Text>
        <Text style={s.bulletAlt}>
          • On a "No" decision: come up with a dramatic excuse for ending the date.
        </Text>
      </View>

      <View style={s.note}>
        <Text style={s.noteTitle}>Reminder</Text>
        <Text style={s.noteText}>Enjoy the game and keep the vibe friendly!</Text>
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
