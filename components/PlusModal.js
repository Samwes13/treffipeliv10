import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../contexts/LanguageContext";
import theme from "../utils/theme";
import Purchases from "react-native-purchases";

export default function PlusModal({
  visible,
  onClose,
  planName = "Plus",
  planPrice = "2,99 EUR",
  termsUrl = "https://treffipeli.fi/terms",
  privacyUrl = "https://treffipeli.fi/privacy",
  onRestorePurchases,
}) {
  const { t, language } = useLanguage();
  const [displayPrice, setDisplayPrice] = useState(planPrice);
  const [displayCaption, setDisplayCaption] = useState(
    language === "fi" ? t("per month") : t("per month"),
  );
  const [loadingPrice, setLoadingPrice] = useState(false);
  const handleRestore = () => {
    if (onRestorePurchases) {
      onRestorePurchases();
    } else {
      console.log("Restore purchases tapped (no handler provided)");
    }
  };

  const openLink = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.warn("Failed to open link", error?.message || error);
    }
  };

  useEffect(() => {
    let mounted = true;
    const packageLabel = (pkgType) => {
      const type = (pkgType || "").toUpperCase();
      if (type === "MONTHLY") {
        return language === "fi" ? t("per month") : t("per month");
      }
      return type || "";
    };

    const fetchOfferings = async () => {
      if (!visible) {
        return;
      }
      try {
        setLoadingPrice(true);
        const offerings = await Purchases.getOfferings();
        const current = offerings?.current;
        const pkg =
          current?.monthly ||
          current?.availablePackages?.find(
            (p) => p?.packageType?.toLowerCase?.() === "monthly",
          ) ||
          current?.availablePackages?.[0];
        const priceString = pkg?.product?.priceString;
        const caption = packageLabel(pkg?.packageType);
        if (priceString && mounted) {
          setDisplayPrice(
            priceString,
          );
          setDisplayCaption(caption);
        } else if (mounted) {
          setDisplayPrice(planPrice);
          setDisplayCaption(language === "fi" ? t("per month") : t("per month"));
        }
      } catch (error) {
        if (mounted) {
          setDisplayPrice(planPrice);
          setDisplayCaption(language === "fi" ? t("per month") : t("per month"));
        }
      } finally {
        mounted && setLoadingPrice(false);
      }
    };

    fetchOfferings();
    return () => {
      mounted = false;
    };
  }, [language, planPrice, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.offerCard}>
          <LinearGradient
            colors={["#2A1133", "#541C4B", "#8C3160"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.offerHeader}
          >
            <View style={styles.offerBadgeRow}>
              <Ionicons name="sparkles" size={18} color="#FFD5FF" />
              <Text style={styles.offerBadgeText}>{planName}</Text>
            </View>
            <Text style={styles.offerType}>{t("Subscription")}</Text>
            <View style={styles.offerPriceRow}>
              <Text style={styles.offerPrice}>
                {loadingPrice
                  ? t("Loading…")
                  : displayPrice || planPrice}
              </Text>
              <Text style={styles.offerPriceCaption}>{displayCaption}</Text>
            </View>
            <TouchableOpacity style={styles.offerClose} onPress={onClose}>
              <Ionicons name="close" size={22} color="#ffffff" />
            </TouchableOpacity>
          </LinearGradient>

            <View style={styles.offerBody}>
              <View style={styles.offerListItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                color={theme.accentPrimary}
                />
              <Text style={styles.offerListText}>{t("Ad-free")}</Text>
              </View>
            <View style={styles.offerListItem}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.accentPrimary}
              />
              <Text style={styles.offerListText}>
                {t("Support future updates")}
              </Text>
            </View>
            <View style={styles.offerListItem}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.accentPrimary}
              />
              <Text style={styles.offerListText}>{t("Cancel anytime")}</Text>
            </View>

            <TouchableOpacity
              style={styles.offerButton}
              activeOpacity={0.9}
              onPress={onClose}
            >
              <LinearGradient
                colors={theme.primaryButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.offerButtonGradient}
              >
                <Text style={styles.offerButtonText}>{`Start ${planName}`}</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>

              <TouchableOpacity
                style={styles.offerLater}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.offerLaterText}>{t("Maybe later")}</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => openLink(termsUrl)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={theme.bodyText}
                />
                <Text style={styles.linkText}>{t("Terms of Service")}</Text>
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={theme.helperText}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => openLink(privacyUrl)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={theme.bodyText}
                />
                <Text style={styles.linkText}>{t("Privacy Policy")}</Text>
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={theme.helperText}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.restoreButton}
                onPress={handleRestore}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="refresh-circle"
                  size={18}
                  color={theme.bodyText}
                  style={styles.restoreIcon}
                />
                <Text style={styles.restoreText}>{t("Restore purchases")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.modalBackdrop,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  offerCard: {
    width: "90%",
    maxWidth: 420,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#1D0F24",
    position: "relative",
    shadowColor: "#11022C",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.32,
    shadowRadius: 30,
    elevation: 14,
  },
  offerHeader: {
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  offerBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  offerBadgeText: {
    marginLeft: 8,
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  offerType: {
    marginTop: 8,
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  offerPriceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 12,
  },
  offerPrice: {
    fontSize: 34,
    fontWeight: "900",
    color: "#fff",
    marginRight: 8,
  },
  offerPriceCaption: {
    fontSize: 14,
    color: "rgba(255,255,255,0.82)",
    marginBottom: 6,
  },
  offerClose: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  offerBody: {
    padding: 18,
    backgroundColor: "#ffffff",
  },
  offerListItem: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  offerListText: {
    marginLeft: 10,
    fontSize: 15,
    color: theme.bodyText,
    fontWeight: "600",
  },
  offerButton: {
    marginTop: 18,
    borderRadius: 16,
    overflow: "hidden",
  },
  offerButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  offerButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  offerLater: {
    marginTop: 12,
    alignItems: "center",
  },
  offerLaterText: {
    color: theme.helperText,
    fontSize: 14,
    fontWeight: "600",
  },
  restoreButton: {
    marginTop: 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  restoreIcon: {
    marginRight: 8,
  },
  restoreText: {
    color: theme.bodyText,
    fontSize: 14,
    fontWeight: "700",
  },
  divider: {
    marginTop: 14,
    marginBottom: 4,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  linkText: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
    fontSize: 12,
    fontWeight: "700",
    color: theme.helperText,
  },
});
