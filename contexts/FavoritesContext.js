import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebaseConfig";
import {
  addFavorite as addFavoriteService,
  normalizeFavoriteText,
  removeFavorite as removeFavoriteService,
  subscribeFavorites,
} from "../services/favoritesService";

const FavoritesContext = createContext({
  favorites: [],
  favoritesLoading: true,
  userId: null,
  addFavorite: async () => ({ status: "no-user" }),
  removeFavorite: async () => {},
  isFavorite: () => false,
  normalizeFavoriteText,
});

export function FavoritesProvider({ children }) {
  const [userId, setUserId] = useState(auth?.currentUser?.uid || null);
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setFavorites([]);
      setFavoritesLoading(false);
      return () => {};
    }
    setFavoritesLoading(true);
    const unsubscribe = subscribeFavorites(userId, (items) => {
      setFavorites(items);
      setFavoritesLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [userId]);

  const favoriteSet = useMemo(() => {
    const set = new Set();
    favorites.forEach((item) => {
      const normalized = normalizeFavoriteText(item?.text);
      if (normalized) {
        set.add(normalized);
      }
    });
    return set;
  }, [favorites]);

  const addFavorite = useCallback(
    async (payload) => addFavoriteService(userId, payload),
    [userId],
  );

  const removeFavorite = useCallback(
    async (traitId) => removeFavoriteService(userId, traitId),
    [userId],
  );

  const isFavorite = useCallback(
    (text) => {
      const normalized = normalizeFavoriteText(text);
      return normalized ? favoriteSet.has(normalized) : false;
    },
    [favoriteSet],
  );

  const value = useMemo(
    () => ({
      favorites,
      favoritesLoading,
      userId,
      addFavorite,
      removeFavorite,
      isFavorite,
      normalizeFavoriteText,
    }),
    [
      favorites,
      favoritesLoading,
      userId,
      addFavorite,
      removeFavorite,
      isFavorite,
    ],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export const useFavorites = () => useContext(FavoritesContext);
