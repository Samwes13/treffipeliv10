const sanitize = (value) => {
  if (value == null) {
    return "player";
  }
  const asString =
    typeof value === "string" ? value : value.toString ? value.toString() : "";
  const trimmed = asString.trim();
  const fallback = trimmed.length > 0 ? trimmed : asString || "player";
  return fallback.replace(/[.#$/\[\]]/g, "_");
};

export const toUserKey = (value) => sanitize(value);
