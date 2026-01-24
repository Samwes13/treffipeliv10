import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import translationMap from "../localization/translations";
import {
  loadLanguagePreference,
  saveLanguagePreference,
} from "../utils/languagePreference";

const DEFAULT_LANGUAGE = "en";

const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (key, variables) => (variables ? formatTemplate(key, variables) : key),
});

const formatTemplate = (text, variables) => {
  if (typeof text !== "string" || !variables) {
    return text;
  }

  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, variable) => {
    if (Object.prototype.hasOwnProperty.call(variables, variable)) {
      const value = variables[variable];
      return value == null ? "" : String(value);
    }
    return match;
  });
};

const translateValue = (language, key, variables) => {
  if (!key) {
    return "";
  }

  if (language === DEFAULT_LANGUAGE) {
    return formatTemplate(key, variables);
  }

  const dictionary = translationMap[language] || {};
  const template = dictionary[key];
  if (typeof template === "string") {
    return formatTemplate(template, variables);
  }

  return formatTemplate(key, variables);
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const userOverrideRef = useRef(false);

  useEffect(() => {
    let isActive = true;
    const loadLanguage = async () => {
      const storedLanguage = await loadLanguagePreference();
      if (!isActive || userOverrideRef.current) {
        return;
      }
      if (storedLanguage === "fi") {
        setLanguage("fi");
      } else if (storedLanguage === DEFAULT_LANGUAGE) {
        setLanguage(DEFAULT_LANGUAGE);
      }
    };
    loadLanguage();
    return () => {
      isActive = false;
    };
  }, []);

  const safeSetLanguage = useCallback((nextLanguage) => {
    userOverrideRef.current = true;
    if (nextLanguage === "fi") {
      setLanguage("fi");
      saveLanguagePreference("fi");
      return;
    }
    setLanguage(DEFAULT_LANGUAGE);
    saveLanguagePreference(DEFAULT_LANGUAGE);
  }, []);

  const value = useMemo(
    () => ({
      language,
      setLanguage: safeSetLanguage,
      t: (key, variables) => translateValue(language, key, variables),
    }),
    [language, safeSetLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

export const LANGUAGE_OPTIONS = [
  { code: "en", label: "ENG" },
  { code: "fi", label: "FIN" },
];
