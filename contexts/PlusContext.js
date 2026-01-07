import React, { createContext, useContext, useEffect, useState } from "react";
import Purchases from "react-native-purchases";

const PlusContext = createContext({
  isPlus: false,
  refreshPlusStatus: async () => {},
  restorePurchases: async () => {},
});

export function PlusProvider({ children }) {
  const [isPlus, setIsPlus] = useState(false);

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

  const refreshPlusStatus = async (customerInfo) => {
    try {
      const info = customerInfo || (await Purchases.getCustomerInfo());
      setIsPlus(getHasPlus(info));
    } catch (error) {
      console.warn("Failed to fetch entitlements", error?.message || error);
    }
  };

  const restorePurchases = async () => {
    try {
      const info = await Purchases.restorePurchases();
      setIsPlus(getHasPlus(info));
      return info;
    } catch (error) {
      console.warn("Failed to restore purchases", error?.message || error);
      throw error;
    }
  };

  useEffect(() => {
    refreshPlusStatus();
  }, []);

  useEffect(() => {
    const listener = (info) => {
      setIsPlus(getHasPlus(info));
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  return (
    <PlusContext.Provider
      value={{ isPlus, refreshPlusStatus, restorePurchases }}
    >
      {children}
    </PlusContext.Provider>
  );
}

export const usePlus = () => useContext(PlusContext);
