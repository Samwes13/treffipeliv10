import {
  get,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
} from "firebase/database";
import { database } from "../firebaseConfig";

export const normalizeFavoriteText = (value) =>
  String(value || "").trim().toLowerCase();

const buildFavoritesRef = (userId) =>
  ref(database, `users/${userId}/favoriteTraits`);

const normalizeList = (snapshot) => {
  const data = snapshot.val() || {};
  return Object.entries(data).map(([id, value]) => ({
    id,
    ...(value || {}),
  }));
};

const sortByCreatedDesc = (a, b) => {
  const createdA = Number(a.createdAt) || 0;
  const createdB = Number(b.createdAt) || 0;
  if (createdA !== createdB) {
    return createdB - createdA;
  }
  return String(a.text || "").localeCompare(String(b.text || ""));
};

export const subscribeFavorites = (userId, callback) => {
  if (!userId) {
    callback([]);
    return () => {};
  }
  const favoritesRef = buildFavoritesRef(userId);
  return onValue(favoritesRef, (snapshot) => {
    const items = normalizeList(snapshot).map((item) => ({
      ...item,
      normalizedText: normalizeFavoriteText(item.text),
    }));
    items.sort(sortByCreatedDesc);
    callback(items);
  });
};

export const addFavorite = async (userId, { text, lang = null, source } = {}) => {
  if (!userId) {
    return { status: "no-user" };
  }
  const trimmedText = String(text || "").trim();
  if (!trimmedText) {
    return { status: "invalid" };
  }
  const normalized = normalizeFavoriteText(trimmedText);
  const favoritesRef = buildFavoritesRef(userId);
  const snapshot = await get(favoritesRef);
  const data = snapshot.val() || {};
  const isDuplicate = Object.values(data).some(
    (item) => normalizeFavoriteText(item?.text) === normalized,
  );
  if (isDuplicate) {
    return { status: "duplicate" };
  }
  const newRef = push(favoritesRef);
  const payload = {
    text: trimmedText,
    lang: lang || null,
    createdAt: serverTimestamp(),
  };
  if (source) {
    payload.source = source;
  }
  await set(newRef, payload);
  return { status: "added", id: newRef.key };
};

export const removeFavorite = async (userId, traitId) => {
  if (!userId || !traitId) {
    return;
  }
  return remove(ref(database, `users/${userId}/favoriteTraits/${traitId}`));
};

export const getRandomFavorite = (list, filterLang = "ALL", options = {}) => {
  const items = Array.isArray(list) ? list : [];
  const langFilter =
    filterLang && filterLang !== "ALL" ? String(filterLang) : null;
  const excludeSet = options.excludeSet;
  const filterItems = (source, applyLang) =>
    source.filter((item) => {
      const text = String(item?.text || "").trim();
      if (!text) {
        return false;
      }
      if (applyLang && langFilter && item?.lang !== langFilter) {
        return false;
      }
      const normalized = normalizeFavoriteText(text);
      if (excludeSet && excludeSet.has(normalized)) {
        return false;
      }
      return true;
    });

  let filtered = filterItems(items, true);
  let usedFallback = false;
  if (!filtered.length && langFilter) {
    const fallback = filterItems(items, false);
    if (fallback.length) {
      filtered = fallback;
      usedFallback = true;
    }
  }
  if (!filtered.length) {
    return { favorite: null, usedFallback: false };
  }
  const favorite = filtered[Math.floor(Math.random() * filtered.length)];
  return { favorite, usedFallback };
};
