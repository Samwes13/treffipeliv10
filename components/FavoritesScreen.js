import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { useLanguage } from "../contexts/LanguageContext";
import { useFavorites } from "../contexts/FavoritesContext";
import theme from "../utils/theme";
import MotionPressable from "./MotionPressable";

export default function FavoritesScreen({ navigation }) {
  const { t } = useLanguage();
  const { favorites, favoritesLoading, removeFavorite } = useFavorites();
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const filteredFavorites = useMemo(() => {
    if (!normalizedQuery) {
      return favorites;
    }
    return favorites.filter((item) =>
      String(item?.text || "").toLowerCase().includes(normalizedQuery),
    );
  }, [favorites, normalizedQuery]);

  const handleCopy = async (text) => {
    if (!text) {
      return;
    }
    await Clipboard.setStringAsync(String(text));
    Alert.alert(t("Notice"), t("Copied"));
  };

  const handleRemove = (item) => {
    if (!item?.id) {
      return;
    }
    Alert.alert(
      t("Remove"),
      t("Remove {{name}}", { name: item.text || t("Trait") }),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Remove"),
          style: "destructive",
          onPress: () => removeFavorite(item.id),
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.backgroundGradient}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.headerRow}>
          <MotionPressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel={t("Back")}
          >
            <Ionicons name="arrow-back" size={20} color="#ffffff" />
          </MotionPressable>
          <View style={styles.titleWrap}>
            <Ionicons name="star" size={20} color="#ffffff" />
            <Text style={styles.title}>{t("Favorites")}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.panel}>
          <View style={styles.searchRow}>
            <Ionicons
              name="search-outline"
              size={18}
              color={theme.helperText}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder={t("Search favorites")}
              placeholderTextColor={theme.placeholder}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {!!query && (
              <MotionPressable
                style={styles.clearButton}
                onPress={() => setQuery("")}
                accessibilityLabel={t("Clear")}
              >
                <Ionicons name="close" size={16} color={theme.helperText} />
              </MotionPressable>
            )}
          </View>

          {favoritesLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color={theme.accentPrimary} />
              <Text style={styles.loadingText}>{t("Loading…")}</Text>
            </View>
          ) : filteredFavorites.length ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {filteredFavorites.map((item) => (
                <View key={item.id} style={styles.favoriteRow}>
                  <View style={styles.favoriteTextWrap}>
                    <Text style={styles.favoriteText}>{item.text}</Text>
                    {!!item.lang && (
                      <View style={styles.langBadge}>
                        <Text style={styles.langBadgeText}>{item.lang}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.favoriteActions}>
                    <MotionPressable
                      style={styles.actionButton}
                      onPress={() => handleCopy(item.text)}
                      accessibilityLabel={t("Copy")}
                    >
                      <Ionicons
                        name="copy-outline"
                        size={16}
                        color={theme.metaLabel}
                      />
                    </MotionPressable>
                    <MotionPressable
                      style={[styles.actionButton, styles.removeButton]}
                      onPress={() => handleRemove(item)}
                      accessibilityLabel={t("Remove")}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ffffff" />
                    </MotionPressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>
              {favorites.length
                ? t("No favorites match")
                : t("No favorites yet")}
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    marginLeft: 8,
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
  },
  headerSpacer: {
    width: 40,
  },
  panel: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: 18,
    shadowColor: "#13093A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.accentMutedBorder,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.bodyText,
    paddingVertical: 4,
  },
  clearButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accentMuted,
  },
  loadingState: {
    marginTop: 24,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    color: theme.helperText,
    fontSize: 13,
  },
  scroll: {
    marginTop: 16,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  favoriteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 120, 182, 0.25)",
    backgroundColor: "rgba(255, 240, 248, 0.8)",
    marginBottom: 12,
  },
  favoriteTextWrap: {
    flex: 1,
    marginRight: 10,
  },
  favoriteText: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.bodyText,
  },
  langBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.badgeBackground,
  },
  langBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.badgeText,
  },
  favoriteActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 145, 77, 0.18)",
    marginLeft: 8,
  },
  removeButton: {
    backgroundColor: "#ff6b6b",
  },
  emptyText: {
    marginTop: 24,
    textAlign: "center",
    color: theme.helperText,
    fontSize: 14,
  },
});
