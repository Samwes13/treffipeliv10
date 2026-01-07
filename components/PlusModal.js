import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../contexts/LanguageContext";
import { usePlus } from "../contexts/PlusContext";
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
  const { refreshPlusStatus, restorePurchases } = usePlus();
  const [displayPrice, setDisplayPrice] = useState("");
  const [displayCaption, setDisplayCaption] = useState("");
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [restoreInProgress, setRestoreInProgress] = useState(false);

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

  const purchaseDisabled = purchaseInProgress || loadingPrice || !selectedPackage;

  const getHasPlus = (info) => {
    const activeEntitlements = info?.entitlements?.active || {};
    const entitlementKeys = Object.keys(activeEntitlements);
    if (
      !!activeEntitlements.plus ||
      !!activeEntitlements.Plus ||
      !!activeEntitlements.Premium ||
      entitlementKeys.length > 0
    ) {
      return true;
    }
    const activeSubscriptions = info?.activeSubscriptions || [];
    return Array.isArray(activeSubscriptions) && activeSubscriptions.length > 0;
  };

  const applyCustomerInfo = async (info) => {
    if (info) {
      await refreshPlusStatus(info);
      return info;
    }
    try {
      const latestInfo = await Purchases.getCustomerInfo();
      await refreshPlusStatus(latestInfo);
      return latestInfo;
    } catch (infoError) {
      console.warn("Failed to refresh customer info", infoError?.message || infoError);
      return null;
    }
  };

  const handleRestore = async () => {
    if (restoreInProgress) {
      return;
    }
    setRestoreInProgress(true);
    try {
      let restoreInfo = null;
      if (onRestorePurchases) {
        restoreInfo = await onRestorePurchases();
      } else {
        restoreInfo = await restorePurchases();
      }
      let latestInfo = await applyCustomerInfo(restoreInfo);
      if (!getHasPlus(latestInfo)) {
        try {
          const syncInfo = await Purchases.syncPurchases();
          latestInfo = await applyCustomerInfo(syncInfo);
        } catch (syncError) {
          console.warn("Failed to sync purchases", syncError?.message || syncError);
        }
      }
      const hasPlus = getHasPlus(latestInfo);
      Alert.alert(
        t("Notice"),
        hasPlus ? t("Plus activated") : t("No active subscription found"),
      );
      if (hasPlus) {
        onClose && onClose();
      }
    } catch (error) {
      console.warn("Restore purchases failed", error?.message || error);
      Alert.alert(
        t("Notice"),
        t("Something went wrong. Please try again shortly."),
      );
    } finally {
      setRestoreInProgress(false);
    }
  };

  const handlePurchase = async () => {
    if (purchaseDisabled) {
      return;
    }
    if (!selectedPackage) {
      Alert.alert(
        t("Notice"),
        t("Something went wrong. Please try again shortly."),
      );
      return;
    }
    try {
      setPurchaseInProgress(true);
      const result = await Purchases.purchasePackage(selectedPackage);
      const info = result?.customerInfo || result;
      await applyCustomerInfo(info);
      try {
        await Purchases.syncPurchases();
      } catch (syncError) {
        console.warn("Failed to sync purchases", syncError?.message || syncError);
      }
      const latestInfo = await applyCustomerInfo();
      if (latestInfo) {
        console.log("customerInfo after purchase", JSON.stringify(latestInfo, null, 2));
      }
      onClose && onClose();
    } catch (error) {
      const errorCode = error?.code;
      const readableCode =
        error?.userInfo?.readableErrorCode || error?.readableErrorCode;
      const isAlreadyPurchased =
        errorCode === Purchases.PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR ||
        readableCode === "PRODUCT_ALREADY_PURCHASED_ERROR";
      if (isAlreadyPurchased) {
        try {
          const syncInfo = await Purchases.syncPurchases();
          const latestInfo = await applyCustomerInfo(syncInfo);
          const hasPlus = getHasPlus(latestInfo);
          Alert.alert(
            t("Notice"),
            hasPlus ? t("Plus activated") : t("No active subscription found"),
          );
          if (hasPlus) {
            onClose && onClose();
          }
        } catch (syncError) {
          console.warn("Failed to sync purchases", syncError?.message || syncError);
          Alert.alert(
            t("Notice"),
            t("Something went wrong. Please try again shortly."),
          );
        }
        return;
      }
      if (!error?.userCancelled) {
        console.warn("Purchase failed", error?.message || error);
        Alert.alert(
          t("Notice"),
          t("Something went wrong. Please try again shortly."),
        );
      }
    } finally {
      setPurchaseInProgress(false);
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
        if (mounted) {
          setDisplayPrice("");
          setDisplayCaption("");
          setSelectedPackage(null);
        }
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
          setSelectedPackage(pkg || null);
          setDisplayPrice(priceString);
          setDisplayCaption(caption);
        }
      } catch (error) {
        if (mounted) {
          setDisplayPrice("");
          setDisplayCaption("");
          setSelectedPackage(null);
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
                  : displayPrice || t("Price unavailable")}
              </Text>
              {displayPrice ? (
                <Text style={styles.offerPriceCaption}>{displayCaption}</Text>
              ) : null}
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
              style={[
                styles.offerButton,
                purchaseDisabled && styles.offerButtonDisabled,
              ]}
              activeOpacity={0.9}
              onPress={handlePurchase}
              disabled={purchaseDisabled}
            >
              <LinearGradient
                colors={theme.primaryButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.offerButtonGradient}
              >
                <Text style={styles.offerButtonText}>
                  {purchaseInProgress ? t("Starting...") : `Start ${planName}`}
                </Text>
                {purchaseInProgress ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                )}
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
                disabled={restoreInProgress}
              >
                <Ionicons
                  name="refresh-circle"
                  size={18}
                  color={theme.bodyText}
                  style={styles.restoreIcon}
                />
                <Text style={styles.restoreText}>{t("Restore purchases")}</Text>
                {restoreInProgress && (
                  <ActivityIndicator
                    size="small"
                    color={theme.bodyText}
                    style={styles.restoreSpinner}
                  />
                )}
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
  offerButtonDisabled: {
    opacity: 0.7,
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
  restoreSpinner: {
    marginLeft: 8,
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
