import React, { createContext, useContext, useEffect, useState } from "react";
import Purchases from "react-native-purchases";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PlusContext = createContext({
  isPlus: false,
  refreshPlusStatus: async () => {},
  restorePurchases: async () => {},
  debugPlus: false,
  toggleDebugPlus: async () => {},
  resetRevenueCatUser: async () => {},
});

const DEBUG_PLUS_KEY = "debugPlusEnabled";

export function PlusProvider({ children }) {
  const [entitlementPlus, setEntitlementPlus] = useState(false);
  const [debugPlus, setDebugPlus] = useState(false);
  const isPlus = debugPlus || entitlementPlus;

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

  const setDebugPlusOverride = async (enabled) => {
    setDebugPlus(enabled);
    try {
      if (enabled) {
        await AsyncStorage.setItem(DEBUG_PLUS_KEY, "true");
      } else {
        await AsyncStorage.removeItem(DEBUG_PLUS_KEY);
      }
    } catch (error) {
      console.warn("Failed to persist debug plus flag", error?.message || error);
    }
  };

  const toggleDebugPlus = async () => {
    const next = !debugPlus;
    await setDebugPlusOverride(next);
  };

  const refreshPlusStatus = async (customerInfo) => {
    try {
      const info = customerInfo || (await Purchases.getCustomerInfo());
      setEntitlementPlus(getHasPlus(info));
    } catch (error) {
      console.warn("Failed to fetch entitlements", error?.message || error);
    }
  };

  const restorePurchases = async () => {
    try {
      const info = await Purchases.restorePurchases();
      setEntitlementPlus(getHasPlus(info));
      return info;
    } catch (error) {
      console.warn("Failed to restore purchases", error?.message || error);
      throw error;
    }
  };

  const resetRevenueCatUser = async () => {
    try {
      await setDebugPlusOverride(false);
      try {
        await Purchases.logOut();
      } catch (logoutError) {
        const message = String(logoutError?.message || "");
        const isAnonymousLogoutError =
          message.toLowerCase().includes("current user is anonymous");
        if (!isAnonymousLogoutError) {
          throw logoutError;
        }
        const tempUserId = `debug_reset_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        await Purchases.logIn(tempUserId);
        await Purchases.logOut();
      }
      const info = await Purchases.getCustomerInfo();
      setEntitlementPlus(getHasPlus(info));
      return info;
    } catch (error) {
      console.warn("Failed to reset RevenueCat user", error?.message || error);
      throw error;
    }
  };

  useEffect(() => {
    refreshPlusStatus();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadDebugPlus = async () => {
      try {
        const stored = await AsyncStorage.getItem(DEBUG_PLUS_KEY);
        if (isMounted) {
          setDebugPlus(stored === "true");
        }
      } catch (error) {
        console.warn("Failed to load debug plus flag", error?.message || error);
      }
    };

    loadDebugPlus();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const listener = (info) => {
      setEntitlementPlus(getHasPlus(info));
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  return (
    <PlusContext.Provider
      value={{
        isPlus,
        refreshPlusStatus,
        restorePurchases,
        debugPlus,
        toggleDebugPlus,
        resetRevenueCatUser,
      }}
    >
      {children}
    </PlusContext.Provider>
  );
}

export const usePlus = () => useContext(PlusContext);
