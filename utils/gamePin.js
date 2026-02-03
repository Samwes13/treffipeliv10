import { get, ref } from "firebase/database";
import { database } from "../firebaseConfig";

const DEFAULT_PIN_LENGTH = 6;
const DEFAULT_MAX_ATTEMPTS = 12;

const buildCandidate = (length) => {
  let value = "";
  while (value.length < length) {
    value += Math.random().toString(36).substring(2);
  }
  return value.substring(0, length).toUpperCase();
};

export const generateUniqueGamePin = async ({
  length = DEFAULT_PIN_LENGTH,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
} = {}) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = buildCandidate(length);
    if (!candidate || candidate.length < length) {
      continue;
    }
    const snapshot = await get(ref(database, `games/${candidate}`));
    if (!snapshot.exists()) {
      return candidate;
    }
  }

  throw new Error("unique-pin-failed");
};
