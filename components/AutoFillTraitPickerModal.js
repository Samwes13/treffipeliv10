import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "../contexts/LanguageContext";
import { useFavorites } from "../contexts/FavoritesContext";
import useAutoFillTraits from "../hooks/useAutoFillTraits";
import { listenTraits } from "../services/autofillTraitsService";
import { getRandomFavorite } from "../services/favoritesService";
import theme from "../utils/theme";
import MotionPressable from "./MotionPressable";

const normalizeText = (value) => String(value || "").trim().toLowerCase();
const FAVORITES_CATEGORY_ID = "__favorites__";

export default function AutoFillTraitPickerModal({
  visible,
  mode,
  usedTraits = [],
  onSelect,
  onClose,
}) {
  const { t, language } = useLanguage();
  const { favorites, favoritesLoading } = useFavorites();
  const { categories, loading: categoriesLoading } = useAutoFillTraits(mode);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [traits, setTraits] = useState([]);
  const [traitsLoading, setTraitsLoading] = useState(false);

  const getCategoryName = (category) => {
    if (!category) {
      return "";
    }
    if (language === "fi") {
      return category.nameFi || category.name || category.nameEn || "";
    }
    return category.name || category.nameEn || category.nameFi || "";
  };

  const getTraitText = (trait) => {
    if (!trait) {
      return "";
    }
    if (language === "fi") {
      return trait.textFi || trait.text || trait.textEn || "";
    }
    return trait.text || trait.textEn || trait.textFi || "";
  };

  const usedSet = useMemo(() => {
    const normalized = usedTraits
      .map((trait) => normalizeText(trait))
      .filter(Boolean);
    return new Set(normalized);
  }, [usedTraits]);

  useEffect(() => {
    if (!visible) {
      setSelectedCategoryId(null);
      setTraits([]);
      setTraitsLoading(false);
    }
  }, [visible]);

  useEffect(() => {
    if (
      !visible ||
      !mode ||
      !selectedCategoryId ||
      selectedCategoryId === FAVORITES_CATEGORY_ID
    ) {
      setTraits([]);
      return undefined;
    }
    setTraitsLoading(true);
    const unsubscribe = listenTraits(
      mode,
      selectedCategoryId,
      (items) => {
        setTraits(items);
        setTraitsLoading(false);
      },
      { includeDisabled: false },
    );
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [mode, selectedCategoryId, visible]);

  const handleClose = () => {
    onClose && onClose();
  };

  const handleSelectTrait = (traitText) => {
    if (!traitText) {
      return;
    }
    const key = normalizeText(traitText);
    if (usedSet.has(key)) {
      Alert.alert(t("Duplicate Traits"), t("This trait is already on the list."));
      return;
    }
    onSelect && onSelect(traitText);
    handleClose();
  };

  const handleRandomPick = () => {
    const available = traits.filter((trait) => {
      const label = getTraitText(trait);
      const key = normalizeText(label);
      return key.length > 0 && !usedSet.has(key);
    });
    if (!available.length) {
      Alert.alert(
        t("Notice"),
        t("No unused traits available in this category."),
      );
      return;
    }
    const randomTrait =
      available[Math.floor(Math.random() * available.length)];
    handleSelectTrait(getTraitText(randomTrait));
  };

  const handleRandomFavoritePick = () => {
    const { favorite } = getRandomFavorite(favorites, "ALL", {
      excludeSet: usedSet,
    });
    if (!favorite) {
      const hasAny = favorites.length > 0;
      const message = !hasAny
        ? t("No favorites yet")
        : t("No unused favorites available.");
      Alert.alert(t("Notice"), message);
      return;
    }
    handleSelectTrait(String(favorite.text || ""));
  };

  const headerTitle =
    mode === "bad" ? t("Challenging Traits") : t("Good Traits");

  const selectedCategory =
    selectedCategoryId === FAVORITES_CATEGORY_ID
      ? null
      : categories.find((category) => category.id === selectedCategoryId);

  const favoriteFilteredList = useMemo(() => {
    if (!favorites.length) {
      return [];
    }
    return favorites.filter((item) => {
      if (!item?.text) {
        return false;
      }
      return true;
    });
  }, [favorites]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <LinearGradient
          colors={["rgba(255, 155, 205, 0.98)", "rgba(255, 222, 89, 0.9)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.panel}
        >
          <View style={styles.panelInner}>
            <LinearGradient
              colors={theme.primaryButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.header}
            >
              <View style={styles.headerTitleRow}>
                <Ionicons
                  name="sparkles-outline"
                  size={20}
                  color="#ffffff"
                  style={styles.headerIcon}
                />
                <Text style={styles.headerTitle}>{headerTitle}</Text>
              </View>
              <MotionPressable style={styles.closeButton} onPress={handleClose}>
                <Ionicons name="close" size={20} color="#ffffff" />
              </MotionPressable>
            </LinearGradient>

            {!selectedCategoryId ? (
              <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("Choose category")}</Text>
              {categoriesLoading ? (
                <ActivityIndicator size="small" color={theme.accentPrimary} />
              ) : (
                <ScrollView
                  style={styles.scroll}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <MotionPressable
                    key="favorites"
                    style={styles.favoriteRow}
                    onPress={() => setSelectedCategoryId(FAVORITES_CATEGORY_ID)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.favoriteIconWrap}>
                      <Ionicons name="star" size={16} color="#ffffff" />
                    </View>
                    <Text style={[styles.categoryName, styles.favoriteRowText]}>
                      {t("Favorites")}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#ffffff"
                    />
                  </MotionPressable>
                  {categories.length ? (
                    categories.map((category) => (
                      <MotionPressable
                        key={category.id}
                        style={styles.categoryRow}
                        onPress={() => setSelectedCategoryId(category.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.categoryName}>
                          {getCategoryName(category) || t("Unnamed category")}
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={theme.helperText}
                        />
                      </MotionPressable>
                    ))
                  ) : (
                    <Text style={styles.inlineEmptyText}>
                      {t("No categories available yet.")}
                    </Text>
                  )}
                </ScrollView>
              )}
              </View>
            ) : selectedCategoryId === FAVORITES_CATEGORY_ID ? (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <MotionPressable
                    style={styles.backButton}
                    onPress={() => setSelectedCategoryId(null)}
                  >
                    <Ionicons
                      name="arrow-back"
                      size={16}
                      color={theme.metaLabel}
                      style={styles.backIcon}
                    />
                    <Text style={styles.backText}>{t("Back")}</Text>
                  </MotionPressable>
                  <Text style={styles.sectionTitle}>{t("Favorites")}</Text>
                </View>

                <MotionPressable
                  style={[
                    styles.randomButton,
                    (favoritesLoading || favorites.length === 0) &&
                      styles.randomButtonDisabled,
                  ]}
                  onPress={handleRandomFavoritePick}
                  disabled={favoritesLoading || favorites.length === 0}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={theme.primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.randomButtonGradient}
                  >
                    <Ionicons name="shuffle-outline" size={18} color="#fff" />
                    <Text style={styles.randomButtonText}>
                      {t("Random favorite")}
                    </Text>
                  </LinearGradient>
                </MotionPressable>

                <Text style={styles.listTitle}>{t("Pick from favorites")}</Text>
                {favoritesLoading ? (
                  <ActivityIndicator size="small" color={theme.accentPrimary} />
                ) : favoriteFilteredList.length ? (
                  <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {favoriteFilteredList.map((trait) => {
                      const traitLabel = String(trait.text || "");
                      const isUsed = usedSet.has(normalizeText(traitLabel));
                      return (
                        <MotionPressable
                          key={trait.id}
                          style={[
                            styles.traitRow,
                            isUsed && styles.traitRowDisabled,
                          ]}
                          onPress={() => handleSelectTrait(traitLabel)}
                          activeOpacity={0.85}
                          disabled={isUsed}
                        >
                          <View style={styles.favoriteContent}>
                            <Text
                              style={[
                                styles.traitText,
                                isUsed && styles.traitTextDisabled,
                              ]}
                            >
                              {traitLabel}
                            </Text>
                            {!!trait.lang && (
                              <View style={styles.favoriteLangBadge}>
                                <Text style={styles.favoriteLangBadgeText}>
                                  {trait.lang}
                                </Text>
                              </View>
                            )}
                          </View>
                          {isUsed ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={16}
                              color={theme.helperText}
                            />
                          ) : (
                            <Ionicons
                              name="star"
                              size={16}
                              color={theme.accentPrimary}
                            />
                          )}
                        </MotionPressable>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <Text style={styles.emptyText}>
                    {t("No favorites yet")}
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <MotionPressable
                  style={styles.backButton}
                  onPress={() => setSelectedCategoryId(null)}
                >
                  <Ionicons
                    name="arrow-back"
                    size={16}
                    color={theme.metaLabel}
                    style={styles.backIcon}
                  />
                  <Text style={styles.backText}>{t("Back")}</Text>
                </MotionPressable>
                <Text style={styles.sectionTitle}>
                  {getCategoryName(selectedCategory) || t("Choose category")}
                </Text>
              </View>

              <MotionPressable
                style={[
                  styles.randomButton,
                  (!traits.length || traitsLoading) &&
                    styles.randomButtonDisabled,
                ]}
                onPress={handleRandomPick}
                disabled={!traits.length || traitsLoading}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={theme.primaryButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.randomButtonGradient}
                >
                  <Ionicons name="shuffle-outline" size={18} color="#fff" />
                  <Text style={styles.randomButtonText}>
                    {t("Random from category")}
                  </Text>
                </LinearGradient>
              </MotionPressable>

              <Text style={styles.listTitle}>{t("Pick from list")}</Text>
              {traitsLoading ? (
                <ActivityIndicator size="small" color={theme.accentPrimary} />
              ) : traits.length ? (
                <ScrollView
                  style={styles.scroll}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {traits.map((trait) => {
                    const traitLabel = getTraitText(trait);
                    const isUsed = usedSet.has(normalizeText(traitLabel));
                    return (
                      <MotionPressable
                        key={trait.id}
                        style={[
                          styles.traitRow,
                          isUsed && styles.traitRowDisabled,
                        ]}
                        onPress={() => handleSelectTrait(traitLabel)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.traitText,
                            isUsed && styles.traitTextDisabled,
                          ]}
                        >
                          {traitLabel}
                        </Text>
                        {isUsed && (
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color={theme.helperText}
                          />
                        )}
                      </MotionPressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={styles.emptyText}>
                  {t("No traits available in this category.")}
                </Text>
              )}
              </View>
            )}
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 5, 25, 0.68)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  panel: {
    width: "100%",
    maxWidth: 540,
    maxHeight: "86%",
    borderRadius: 26,
    padding: 2,
    shadowColor: "#3b1024",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 14,
  },
  panelInner: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.98)",
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.4,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  section: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.bodyText,
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255, 102, 196, 0.18)",
  },
  backIcon: {
    marginRight: 6,
  },
  backText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#b8327b",
  },
  scroll: {
    maxHeight: 340,
  },
  scrollContent: {
    paddingBottom: 6,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 120, 182, 0.35)",
    backgroundColor: "rgba(255, 225, 239, 0.65)",
    marginBottom: 12,
  },
  favoriteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 120, 182, 0.45)",
    backgroundColor: "rgba(255, 102, 196, 0.85)",
    marginBottom: 12,
  },
  favoriteIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.25)",
    marginRight: 10,
  },
  favoriteRowText: {
    color: "#ffffff",
  },
  categoryName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: theme.bodyText,
  },
  randomButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
  },
  randomButtonDisabled: {
    opacity: 0.6,
  },
  randomButtonGradient: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  randomButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 8,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#b8327b",
    marginBottom: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  traitRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 120, 182, 0.25)",
    backgroundColor: "rgba(255, 240, 248, 0.8)",
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  traitRowDisabled: {
    opacity: 0.5,
  },
  traitText: {
    flex: 1,
    fontSize: 15,
    color: theme.bodyText,
  },
  traitTextDisabled: {
    color: theme.helperText,
  },
  favoriteContent: {
    flex: 1,
    marginRight: 10,
  },
  favoriteLangBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: theme.badgeBackground,
  },
  favoriteLangBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.badgeText,
  },
  emptyText: {
    fontSize: 14,
    color: theme.helperText,
    textAlign: "center",
    paddingVertical: 16,
  },
  inlineEmptyText: {
    fontSize: 13,
    color: theme.helperText,
    textAlign: "center",
    paddingVertical: 8,
  },
});
