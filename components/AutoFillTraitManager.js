import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../contexts/LanguageContext";
import useAutoFillTraits from "../hooks/useAutoFillTraits";
import {
  addCategory,
  addTrait,
  deleteCategory,
  deleteTrait,
  listenTraits,
  updateCategory,
  updateTrait,
} from "../services/autofillTraitsService";
import styles from "../styles";
import theme from "../utils/theme";
import MotionPressable from "./MotionPressable";
import MotionFloat from "./MotionFloat";

const isDevEnv = () => typeof __DEV__ !== "undefined" && __DEV__;

const normalizeDraft = (draft, fallbackEn, fallbackFi) => ({
  en: draft?.en ?? fallbackEn ?? "",
  fi: draft?.fi ?? fallbackFi ?? "",
});

export default function AutoFillTraitManager({ navigation }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState("good");
  const { categories, loading: categoriesLoading } = useAutoFillTraits(null, {
    includeDisabled: true,
  });
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [traits, setTraits] = useState([]);
  const [traitsLoading, setTraitsLoading] = useState(false);
  const [categoryDrafts, setCategoryDrafts] = useState({});
  const [traitDrafts, setTraitDrafts] = useState({});
  const [newCategoryEn, setNewCategoryEn] = useState("");
  const [newCategoryFi, setNewCategoryFi] = useState("");
  const [newTraitEn, setNewTraitEn] = useState("");
  const [newTraitFi, setNewTraitFi] = useState("");
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();
  const isDev = isDevEnv();

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId),
    [categories, selectedCategoryId],
  );

  useEffect(() => {
    if (!categories.length) {
      setSelectedCategoryId(null);
      return;
    }
    if (!selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
      return;
    }
    if (!categories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    setCategoryDrafts((current) => {
      const next = {};
      categories.forEach((category) => {
        const fallbackEn = category.nameEn || category.name || "";
        const fallbackFi = category.nameFi || "";
        next[category.id] = normalizeDraft(current[category.id], fallbackEn, fallbackFi);
      });
      return next;
    });
  }, [categories]);

  useEffect(() => {
    if (!selectedCategoryId) {
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
      { includeDisabled: true },
    );
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [mode, selectedCategoryId]);

  useEffect(() => {
    setTraitDrafts((current) => {
      const next = {};
      traits.forEach((trait) => {
        const fallbackEn = trait.textEn || trait.text || "";
        const fallbackFi = trait.textFi || "";
        next[trait.id] = normalizeDraft(current[trait.id], fallbackEn, fallbackFi);
      });
      return next;
    });
  }, [traits]);

  const showNotice = (message) => {
    Alert.alert(t("Notice"), message);
  };

  const ensureDev = () => {
    if (!isDev) {
      showNotice(t("Dev tools are only available in development."));
      return false;
    }
    return true;
  };

  const requireBothLanguages = (enValue, fiValue) => {
    if (!enValue || !fiValue) {
      showNotice(t("Please fill in both EN and FI fields."));
      return false;
    }
    return true;
  };

  const handleAddCategory = async () => {
    if (!ensureDev()) {
      return;
    }
    const en = newCategoryEn.trim();
    const fi = newCategoryFi.trim();
    if (!requireBothLanguages(en, fi)) {
      return;
    }
    const order = categories.length
      ? Math.max(...categories.map((category) => Number(category.order) || 0)) + 1
      : 0;
    try {
      setSaving(true);
      await addCategory(mode, en, order, {
        name: en,
        nameEn: en,
        nameFi: fi,
      });
      setNewCategoryEn("");
      setNewCategoryFi("");
    } catch (error) {
      showNotice(error?.message || "Failed to add category.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCategory = async (category) => {
    if (!ensureDev()) {
      return;
    }
    const draft = categoryDrafts[category.id] || {};
    const en = String(draft.en || "").trim();
    const fi = String(draft.fi || "").trim();
    if (!requireBothLanguages(en, fi)) {
      return;
    }
    try {
      setSaving(true);
      await updateCategory(mode, category.id, {
        name: en,
        nameEn: en,
        nameFi: fi,
      });
    } catch (error) {
      showNotice(error?.message || "Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCategory = async (category) => {
    if (!ensureDev()) {
      return;
    }
    try {
      setSaving(true);
      await updateCategory(mode, category.id, {
        enabled: category.enabled === false,
      });
    } catch (error) {
      showNotice(error?.message || "Failed to update category.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = (category) => {
    if (!ensureDev()) {
      return;
    }
    Alert.alert(
      t("Remove"),
      t("Remove {{name}}", { name: category.nameEn || category.name || "Category" }),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Remove"),
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);
              await deleteCategory(mode, category.id);
            } catch (error) {
              showNotice(error?.message || "Failed to delete category.");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const handleAddTrait = async () => {
    if (!ensureDev()) {
      return;
    }
    if (!selectedCategoryId) {
      showNotice(t("Select category"));
      return;
    }
    const en = newTraitEn.trim();
    const fi = newTraitFi.trim();
    if (!requireBothLanguages(en, fi)) {
      return;
    }
    try {
      setSaving(true);
      await addTrait(mode, selectedCategoryId, en, {
        text: en,
        textEn: en,
        textFi: fi,
        kind: mode,
      });
      setNewTraitEn("");
      setNewTraitFi("");
    } catch (error) {
      showNotice(error?.message || "Failed to add trait.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTrait = async (trait) => {
    if (!ensureDev()) {
      return;
    }
    const draft = traitDrafts[trait.id] || {};
    const en = String(draft.en || "").trim();
    const fi = String(draft.fi || "").trim();
    if (!requireBothLanguages(en, fi)) {
      return;
    }
    try {
      setSaving(true);
      await updateTrait(mode, selectedCategoryId, trait.id, {
        text: en,
        textEn: en,
        textFi: fi,
        kind: mode,
      });
    } catch (error) {
      showNotice(error?.message || "Failed to save trait.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTrait = async (trait) => {
    if (!ensureDev()) {
      return;
    }
    try {
      setSaving(true);
      await updateTrait(mode, selectedCategoryId, trait.id, {
        enabled: trait.enabled === false,
      });
    } catch (error) {
      showNotice(error?.message || "Failed to update trait.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTrait = (trait) => {
    if (!ensureDev()) {
      return;
    }
    Alert.alert(t("Remove"), t("Remove {{name}}", { name: trait.textEn || trait.text || "Trait" }), [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Remove"),
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true);
            await deleteTrait(mode, selectedCategoryId, trait.id);
          } catch (error) {
            showNotice(error?.message || "Failed to delete trait.");
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const contentBottomPadding = Math.max(24, 24 + (insets?.bottom || 0));

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={theme.backgroundGradient}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />

      <SafeAreaView style={localStyles.safeArea} edges={["top", "bottom"]}>
        <View pointerEvents="none" style={localStyles.decorativeLayer}>
          <MotionFloat style={localStyles.blobLarge} driftX={8} driftY={-10} />
          <MotionFloat
            style={localStyles.blobSmall}
            driftX={-6}
            driftY={10}
            delay={360}
          />
        </View>

        <KeyboardAvoidingView
          style={localStyles.safeArea}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={localStyles.scroll}
            contentContainerStyle={[
              localStyles.scrollContent,
              { paddingBottom: contentBottomPadding },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={localStyles.headerRow}>
              <MotionPressable
                style={localStyles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={20} color="#ffffff" />
              </MotionPressable>
              <Text style={localStyles.headerTitle}>
                {t("Auto Fill Trait Manager")}
              </Text>
              <View style={localStyles.headerSpacer} />
            </View>

            <LinearGradient
              colors={theme.cardFrameGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={localStyles.cardGradient}
            >
              <View style={localStyles.card}>
                <View style={localStyles.modeToggle}>
                  {["good", "bad"].map((tab) => {
                    const active = mode === tab;
                    return (
                      <MotionPressable
                        key={tab}
                        style={[
                          localStyles.modeButton,
                          active && localStyles.modeButtonActive,
                        ]}
                        onPress={() => setMode(tab)}
                      >
                        <Text
                          style={[
                            localStyles.modeButtonText,
                            active && localStyles.modeButtonTextActive,
                          ]}
                        >
                          {tab === "good" ? t("Good Traits") : t("Challenging Traits")}
                        </Text>
                      </MotionPressable>
                    );
                  })}
                </View>

                <View style={localStyles.section}>
                  <View style={localStyles.sectionHeader}>
                    <Text style={localStyles.sectionTitle}>{t("Categories")}</Text>
                    {categoriesLoading && (
                      <ActivityIndicator size="small" color={theme.accentPrimary} />
                    )}
                  </View>
                  <View style={localStyles.dualInputRow}>
                    <TextInput
                      value={newCategoryEn}
                      onChangeText={setNewCategoryEn}
                      placeholder={t("Category name (EN)")}
                      placeholderTextColor={theme.placeholder}
                      style={localStyles.input}
                      editable={!saving}
                    />
                    <TextInput
                      value={newCategoryFi}
                      onChangeText={setNewCategoryFi}
                      placeholder={t("Category name (FI)")}
                      placeholderTextColor={theme.placeholder}
                      style={localStyles.input}
                      editable={!saving}
                    />
                  </View>
                  <MotionPressable
                    style={[localStyles.primaryButton, saving && localStyles.buttonDisabled]}
                    onPress={handleAddCategory}
                    disabled={saving}
                  >
                    <LinearGradient
                      colors={theme.primaryButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={localStyles.primaryButtonInner}
                    >
                      <Ionicons name="add" size={18} color="#ffffff" />
                      <Text style={localStyles.primaryButtonText}>
                        {t("Add category")}
                      </Text>
                    </LinearGradient>
                  </MotionPressable>

                  {categories.map((category) => {
                    const draft = categoryDrafts[category.id] || {};
                    const isSelected = category.id === selectedCategoryId;
                    const enabled = category.enabled !== false;
                    return (
                      <View
                        key={category.id}
                        style={[
                          localStyles.itemCard,
                          isSelected && localStyles.itemCardSelected,
                        ]}
                      >
                        <View style={localStyles.itemHeader}>
                          <Text style={localStyles.itemLabel}>
                            {enabled ? t("Enabled") : t("Disabled")}
                          </Text>
                          <MotionPressable
                            style={localStyles.selectChip}
                            onPress={() => setSelectedCategoryId(category.id)}
                          >
                            <Text style={localStyles.selectChipText}>
                              {isSelected ? t("Selected") : t("Select")}
                            </Text>
                          </MotionPressable>
                        </View>
                        <View style={localStyles.dualInputRow}>
                          <TextInput
                            value={draft.en}
                            onChangeText={(text) =>
                              setCategoryDrafts((current) => ({
                                ...current,
                                [category.id]: { ...current[category.id], en: text },
                              }))
                            }
                            placeholder={t("Category name (EN)")}
                            placeholderTextColor={theme.placeholder}
                            style={localStyles.input}
                            editable={!saving}
                          />
                          <TextInput
                            value={draft.fi}
                            onChangeText={(text) =>
                              setCategoryDrafts((current) => ({
                                ...current,
                                [category.id]: { ...current[category.id], fi: text },
                              }))
                            }
                            placeholder={t("Category name (FI)")}
                            placeholderTextColor={theme.placeholder}
                            style={localStyles.input}
                            editable={!saving}
                          />
                        </View>
                        <View style={localStyles.actionRow}>
                          <MotionPressable
                            style={localStyles.secondaryButton}
                            onPress={() => handleToggleCategory(category)}
                            disabled={saving}
                          >
                            <Text style={localStyles.secondaryButtonText}>
                              {enabled ? t("Disable") : t("Enable")}
                            </Text>
                          </MotionPressable>
                          <MotionPressable
                            style={localStyles.successButton}
                            onPress={() => handleSaveCategory(category)}
                            disabled={saving}
                          >
                            <Text style={localStyles.successButtonText}>
                              {t("Save")}
                            </Text>
                          </MotionPressable>
                          <MotionPressable
                            style={localStyles.dangerButton}
                            onPress={() => handleDeleteCategory(category)}
                            disabled={saving}
                          >
                            <Text style={localStyles.dangerButtonText}>
                              {t("Remove")}
                            </Text>
                          </MotionPressable>
                        </View>
                      </View>
                    );
                  })}
                </View>

                <View style={localStyles.section}>
                  <View style={localStyles.sectionHeader}>
                    <Text style={localStyles.sectionTitle}>{t("Traits")}</Text>
                    {traitsLoading && (
                      <ActivityIndicator size="small" color={theme.accentPrimary} />
                    )}
                  </View>
                  {!selectedCategory && (
                    <Text style={localStyles.helperText}>
                      {t("Select category")}
                    </Text>
                  )}
                  <View style={localStyles.dualInputRow}>
                    <TextInput
                      value={newTraitEn}
                      onChangeText={setNewTraitEn}
                      placeholder={t("Trait text (EN)")}
                      placeholderTextColor={theme.placeholder}
                      style={localStyles.input}
                      editable={!saving && !!selectedCategory}
                    />
                    <TextInput
                      value={newTraitFi}
                      onChangeText={setNewTraitFi}
                      placeholder={t("Trait text (FI)")}
                      placeholderTextColor={theme.placeholder}
                      style={localStyles.input}
                      editable={!saving && !!selectedCategory}
                    />
                  </View>
                  <MotionPressable
                    style={[
                      localStyles.primaryButton,
                      (!selectedCategory || saving) && localStyles.buttonDisabled,
                    ]}
                    onPress={handleAddTrait}
                    disabled={!selectedCategory || saving}
                  >
                    <LinearGradient
                      colors={theme.primaryButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={localStyles.primaryButtonInner}
                    >
                      <Ionicons name="add" size={18} color="#ffffff" />
                      <Text style={localStyles.primaryButtonText}>
                        {t("Add trait")}
                      </Text>
                    </LinearGradient>
                  </MotionPressable>

                  {traits.map((trait) => {
                    const draft = traitDrafts[trait.id] || {};
                    const enabled = trait.enabled !== false;
                    return (
                      <View key={trait.id} style={localStyles.itemCard}>
                        <View style={localStyles.itemHeader}>
                          <Text style={localStyles.itemLabel}>
                            {enabled ? t("Enabled") : t("Disabled")}
                          </Text>
                        </View>
                        <View style={localStyles.dualInputRow}>
                          <TextInput
                            value={draft.en}
                            onChangeText={(text) =>
                              setTraitDrafts((current) => ({
                                ...current,
                                [trait.id]: { ...current[trait.id], en: text },
                              }))
                            }
                            placeholder={t("Trait text (EN)")}
                            placeholderTextColor={theme.placeholder}
                            style={localStyles.input}
                            editable={!saving}
                          />
                          <TextInput
                            value={draft.fi}
                            onChangeText={(text) =>
                              setTraitDrafts((current) => ({
                                ...current,
                                [trait.id]: { ...current[trait.id], fi: text },
                              }))
                            }
                            placeholder={t("Trait text (FI)")}
                            placeholderTextColor={theme.placeholder}
                            style={localStyles.input}
                            editable={!saving}
                          />
                        </View>
                        <View style={localStyles.actionRow}>
                          <MotionPressable
                            style={localStyles.secondaryButton}
                            onPress={() => handleToggleTrait(trait)}
                            disabled={saving}
                          >
                            <Text style={localStyles.secondaryButtonText}>
                              {enabled ? t("Disable") : t("Enable")}
                            </Text>
                          </MotionPressable>
                          <MotionPressable
                            style={localStyles.successButton}
                            onPress={() => handleSaveTrait(trait)}
                            disabled={saving}
                          >
                            <Text style={localStyles.successButtonText}>
                              {t("Save")}
                            </Text>
                          </MotionPressable>
                          <MotionPressable
                            style={localStyles.dangerButton}
                            onPress={() => handleDeleteTrait(trait)}
                            disabled={saving}
                          >
                            <Text style={localStyles.dangerButtonText}>
                              {t("Remove")}
                            </Text>
                          </MotionPressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </LinearGradient>
          </ScrollView>
        </KeyboardAvoidingView>
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
    top: -140,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 190,
    backgroundColor: theme.blobPrimary,
    transform: [{ rotate: "12deg" }],
  },
  blobSmall: {
    position: "absolute",
    bottom: 120,
    left: -70,
    width: 200,
    height: 200,
    borderRadius: 160,
    backgroundColor: theme.blobSecondary,
    transform: [{ rotate: "-14deg" }],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
  },
  headerSpacer: {
    width: 42,
  },
  cardGradient: {
    width: "100%",
    borderRadius: 28,
    padding: 1.6,
    shadowColor: "#13093A",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 10,
  },
  card: {
    borderRadius: 26,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: theme.accentMuted,
    borderRadius: 16,
    padding: 4,
    marginBottom: 18,
  },
  modeButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#14031E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.metaLabel,
  },
  modeButtonTextActive: {
    color: theme.bodyText,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.bodyText,
  },
  dualInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255, 145, 77, 0.3)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.bodyText,
    backgroundColor: "#ffffff",
    marginBottom: 12,
  },
  primaryButton: {
    borderRadius: 14,
    overflow: "hidden",
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  primaryButtonInner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  itemCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(0,0,0,0.03)",
    padding: 12,
    marginBottom: 12,
  },
  itemCardSelected: {
    borderColor: "rgba(255, 102, 196, 0.6)",
    backgroundColor: "rgba(255, 219, 237, 0.3)",
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  itemLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.metaLabel,
  },
  selectChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255, 145, 77, 0.14)",
  },
  selectChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.metaLabel,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  secondaryButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: theme.accentMuted,
    borderWidth: 1,
    borderColor: theme.accentMutedBorder,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.metaLabel,
  },
  successButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
  },
  successButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  dangerButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(239, 68, 68, 0.18)",
  },
  dangerButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b91c1c",
  },
  helperText: {
    fontSize: 13,
    color: theme.helperText,
    marginBottom: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
