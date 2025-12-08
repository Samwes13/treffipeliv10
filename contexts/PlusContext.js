import React, { createContext, useContext, useEffect, useState } from "react";
import Purchases from "react-native-purchases";

const PlusContext = createContext({
  isPlus: false,
  refreshPlusStatus: async () => {},
});

export function PlusProvider({ children }) {
  const [isPlus, setIsPlus] = useState(false);

  const refreshPlusStatus = async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      const activeEntitlements = info?.entitlements?.active || {};
      const hasPlus =
        !!activeEntitlements.plus ||
        !!activeEntitlements.Plus ||
        !!activeEntitlements.Premium;
      setIsPlus(hasPlus);
    } catch (error) {
      console.warn("Failed to fetch entitlements", error?.message || error);
    }
  };

  useEffect(() => {
    refreshPlusStatus();
  }, []);

  return (
    <PlusContext.Provider value={{ isPlus, refreshPlusStatus }}>
      {children}
    </PlusContext.Provider>
  );
}

export const usePlus = () => useContext(PlusContext);
