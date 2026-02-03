import { useEffect, useState } from "react";
import { listenCategories } from "../services/autofillTraitsService";

export default function useAutoFillTraits(mode, options = {}) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = listenCategories(mode, (items) => {
      setCategories(items);
      setLoading(false);
    }, options);
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [mode, options.includeDisabled]);

  return { categories, loading };
}
