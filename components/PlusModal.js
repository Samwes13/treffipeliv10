import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Linking,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../contexts/LanguageContext";
import { usePlus } from "../contexts/PlusContext";
import theme from "../utils/theme";
import Purchases from "react-native-purchases";
import {
  loadPlusModalHidden,
  savePlusModalHidden,
} from "../utils/plusModalPreference";
import MotionPressable from "./MotionPressable";

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
  const iosTermsUrl =
    "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
  const effectiveTermsUrl = Platform.OS === "ios" ? iosTermsUrl : termsUrl;
  const [displayPrice, setDisplayPrice] = useState("");
  const [displayCaption, setDisplayCaption] = useState("");
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [packageOptions, setPackageOptions] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [hideNextTime, setHideNextTime] = useState(false);

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

  const packageLabel = (pkgType) => {
    const type = (pkgType || "").toUpperCase();
    if (type === "WEEKLY") {
      return t("per week");
    }
    if (type === "MONTHLY") {
      return t("per month");
    }
    return type || "";
  };

  const packageName = (pkgType) => {
    const type = (pkgType || "").toUpperCase();
    if (type === "WEEKLY") {
      return t("Weekly");
    }
    if (type === "MONTHLY") {
      return t("Monthly");
    }
    return type || t("Subscription");
  };

  const billingLabel = (pkgType) => {
    const type = (pkgType || "").toUpperCase();
    if (type === "WEEKLY") {
      return t("Billed weekly");
    }
    if (type === "MONTHLY") {
      return t("Billed monthly");
    }
    return "";
  };

  const selectedPlanName = selectedPackage
    ? packageName(selectedPackage.packageType)
    : "";
  const offerTypeText = selectedPlanName
    ? `${t("Subscription")} - ${selectedPlanName}`
    : t("Subscription");

  const selectPackage = (pkg) => {
    if (!pkg) {
      setSelectedPackage(null);
      setDisplayPrice("");
      setDisplayCaption("");
      return;
    }
    setSelectedPackage(pkg);
    setDisplayPrice(pkg?.product?.priceString || "");
    setDisplayCaption(packageLabel(pkg?.packageType));
  };

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

  const handlePurchase = async (pkgOverride) => {
    if (purchaseInProgress || loadingPrice) {
      return;
    }
    const overridePackage =
      pkgOverride &&
      (pkgOverride?.product || pkgOverride?.identifier || pkgOverride?.packageType)
        ? pkgOverride
        : null;
    const packageToBuy = overridePackage || selectedPackage;
    if (!packageToBuy) {
      Alert.alert(
        t("Notice"),
        t("Something went wrong. Please try again shortly."),
      );
      return;
    }
    try {
      setPurchaseInProgress(true);
      if (overridePackage) {
        selectPackage(overridePackage);
      }
      const result = await Purchases.purchasePackage(packageToBuy);
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

  const toggleHideNextTime = async () => {
    const nextValue = !hideNextTime;
    setHideNextTime(nextValue);
    await savePlusModalHidden(nextValue);
  };

  useEffect(() => {
    let mounted = true;
    const loadPreference = async () => {
      if (!visible) {
        return;
      }
      const hidden = await loadPlusModalHidden();
      if (mounted) {
        setHideNextTime(hidden);
      }
    };

    loadPreference();
    return () => {
      mounted = false;
    };
  }, [visible]);

  useEffect(() => {
    let mounted = true;

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
        const available = current?.availablePackages || [];
        const weekly =
          current?.weekly ||
          available.find((p) => p?.packageType?.toLowerCase?.() === "weekly");
        const monthly =
          current?.monthly ||
          available.find((p) => p?.packageType?.toLowerCase?.() === "monthly");
        const options = [weekly, monthly].filter(Boolean);
        const fallback = available[0] || null;
        const nextOptions = options.length ? options : fallback ? [fallback] : [];
        if (mounted) {
          setPackageOptions(nextOptions);
          const defaultPkg = monthly || weekly || fallback;
          selectPackage(defaultPkg);
        }
      } catch (error) {
        if (mounted) {
          setPackageOptions([]);
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
            <Text style={styles.offerType}>{offerTypeText}</Text>
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
            <MotionPressable style={styles.offerClose} onPress={onClose}>
              <Ionicons name="close" size={22} color="#ffffff" />
            </MotionPressable>
          </LinearGradient>

            <View style={styles.offerBody}>
              {packageOptions.length > 0 && (
                <View style={styles.planSwitcher}>
                  {packageOptions.map((pkg, index) => {
                    const isSelected = pkg === selectedPackage;
                    const optionDisabled =
                      purchaseInProgress || loadingPrice || !pkg;
                    const title = packageName(pkg?.packageType);
                    const price = pkg?.product?.priceString || "";
                    const caption = billingLabel(pkg?.packageType);
                    return (
                      <MotionPressable
                        key={pkg?.identifier || `${title}-${index}`}
                        style={[
                          styles.planOption,
                          index < packageOptions.length - 1 &&
                            styles.planOptionSpacer,
                          isSelected && styles.planOptionActive,
                          optionDisabled && styles.planOptionDisabled,
                        ]}
                        onPress={() => selectPackage(pkg)}
                        activeOpacity={0.9}
                        disabled={optionDisabled}
                      >
                        <View style={styles.planOptionHeader}>
                          <Text
                            style={[
                              styles.planOptionTitle,
                              isSelected && styles.planOptionTitleActive,
                            ]}
                          >
                            {title}
                          </Text>
                          {isSelected && (
                            <View style={styles.planOptionCheck}>
                              <Ionicons name="checkmark" size={12} color="#fff" />
                            </View>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.planOptionPrice,
                            isSelected && styles.planOptionPriceActive,
                          ]}
                        >
                          {price || t("Price unavailable")}
                        </Text>
                        <Text
                          style={[
                            styles.planOptionCaption,
                            isSelected && styles.planOptionCaptionActive,
                          ]}
                        >
                          {caption || packageLabel(pkg?.packageType)}
                        </Text>
                      </MotionPressable>
                    );
                  })}
                </View>
              )}
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

            <MotionPressable
              style={[
                styles.offerButton,
                purchaseDisabled && styles.offerButtonDisabled,
              ]}
              activeOpacity={0.9}
              onPress={() => handlePurchase()}
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
            </MotionPressable>

              <MotionPressable
                style={styles.offerLater}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.offerLaterText}>{t("Maybe later")}</Text>
              </MotionPressable>

              <MotionPressable
                style={styles.hideToggleRow}
                onPress={toggleHideNextTime}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: hideNextTime }}
              >
                <Ionicons
                  name={hideNextTime ? "checkbox" : "square-outline"}
                  size={20}
                  color={hideNextTime ? theme.accentPrimary : theme.helperText}
                />
                <Text style={styles.hideToggleText}>
                  {t("Don't show again")}
                </Text>
              </MotionPressable>

              <View style={styles.divider} />

              <MotionPressable
                style={styles.linkRow}
                onPress={() => openLink(effectiveTermsUrl)}
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
              </MotionPressable>
              <MotionPressable
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
              </MotionPressable>
              <MotionPressable
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
              </MotionPressable>
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
  planSwitcher: {
    flexDirection: "row",
    marginBottom: 12,
  },
  planOption: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(126, 80, 180, 0.2)",
    shadowColor: "#11022C",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  },
  planOptionDisabled: {
    opacity: 0.6,
  },
  planOptionSpacer: {
    marginRight: 10,
  },
  planOptionActive: {
    backgroundColor: "rgba(136, 86, 246, 0.12)",
    borderColor: "rgba(136, 86, 246, 0.55)",
  },
  planOptionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#40274A",
    letterSpacing: 0.4,
  },
  planOptionTitleActive: {
    color: "#5B2FB6",
  },
  planOptionPrice: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: "900",
    color: "#2D1837",
  },
  planOptionPriceActive: {
    color: "#4B1D8D",
  },
  planOptionCaption: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(64, 39, 74, 0.7)",
  },
  planOptionCaptionActive: {
    color: "rgba(91, 47, 182, 0.85)",
  },
  planOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planOptionCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#5B2FB6",
    alignItems: "center",
    justifyContent: "center",
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
  hideToggleRow: {
    marginTop: 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
  },
  hideToggleText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: "600",
    color: theme.helperText,
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
