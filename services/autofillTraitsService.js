import {
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from "firebase/database";
import { database } from "../firebaseConfig";

const buildCategoryRef = () =>
  ref(database, "autofillTraits/categories");

const buildTraitsRef = (categoryId) =>
  ref(database, `autofillTraits/traits/${categoryId}`);

const normalizeList = (snapshot) => {
  const data = snapshot.val() || {};
  return Object.entries(data).map(([id, value]) => ({
    id,
    ...(value || {}),
  }));
};

const normalizeOrder = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getCategoryLabel = (item) =>
  String(item?.name || item?.nameEn || item?.nameFi || "");

const getTraitLabel = (item) =>
  String(item?.text || item?.textEn || item?.textFi || "");

const sortByOrderThenName = (a, b) => {
  const orderA = normalizeOrder(a.order);
  const orderB = normalizeOrder(b.order);
  if (orderA !== orderB) {
    return orderA - orderB;
  }
  return getCategoryLabel(a).localeCompare(getCategoryLabel(b));
};

const sortByCreatedThenText = (a, b) => {
  const createdA = normalizeOrder(a.createdAt);
  const createdB = normalizeOrder(b.createdAt);
  if (createdA !== createdB) {
    return createdA - createdB;
  }
  return getTraitLabel(a).localeCompare(getTraitLabel(b));
};

const filterEnabled = (item) => item?.enabled !== false;

export const listenCategories = (_mode, callback, options = {}) => {
  const includeDisabled = options.includeDisabled === true;
  const categoriesRef = buildCategoryRef();
  return onValue(categoriesRef, (snapshot) => {
    let items = normalizeList(snapshot);
    if (!includeDisabled) {
      items = items.filter(filterEnabled);
    }
    items.sort(sortByOrderThenName);
    callback(items);
  });
};

export const listenTraits = (mode, categoryId, callback, options = {}) => {
  if (!categoryId) {
    callback([]);
    return () => {};
  }
  const includeDisabled = options.includeDisabled === true;
  const traitsRef = buildTraitsRef(categoryId);
  return onValue(traitsRef, (snapshot) => {
    let items = normalizeList(snapshot);
    if (!includeDisabled) {
      items = items.filter(filterEnabled);
    }
    if (mode) {
      items = items.filter((item) => {
        const kind = item?.kind || item?.type;
        if (!kind) {
          return true;
        }
        return kind === mode;
      });
    }
    items.sort(sortByCreatedThenText);
    callback(items);
  });
};

export const addCategory = async (_mode, name, order = 0, extra = {}) => {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    throw new Error("Category name is required.");
  }
  const categoryRef = push(buildCategoryRef());
  await set(categoryRef, {
    name: trimmedName,
    order,
    enabled: true,
    ...extra,
  });
  return categoryRef.key;
};

export const updateCategory = (_mode, categoryId, data) =>
  update(ref(database, `autofillTraits/categories/${categoryId}`), data);

export const deleteCategory = async (_mode, categoryId) => {
  const updates = {};
  updates[`autofillTraits/categories/${categoryId}`] = null;
  updates[`autofillTraits/traits/${categoryId}`] = null;
  await update(ref(database), updates);
};

export const addTrait = async (_mode, categoryId, text, extra = {}) => {
  const trimmedText = String(text || "").trim();
  if (!trimmedText) {
    throw new Error("Trait text is required.");
  }
  const traitRef = push(buildTraitsRef(categoryId));
  await set(traitRef, {
    text: trimmedText,
    enabled: true,
    createdAt: serverTimestamp(),
    ...extra,
  });
  return traitRef.key;
};

export const updateTrait = (_mode, categoryId, traitId, data) =>
  update(
    ref(database, `autofillTraits/traits/${categoryId}/${traitId}`),
    data,
  );

export const deleteTrait = (_mode, categoryId, traitId) =>
  remove(ref(database, `autofillTraits/traits/${categoryId}/${traitId}`));
