const LOGO_SOURCES = {
  en: require("../assets/TraitMatch.png"),
  fi: require("../assets/treffipeli-yellow.png"),
};

export default function getLogoSource(language) {
  return LOGO_SOURCES[language === "fi" ? "fi" : "en"];
}
