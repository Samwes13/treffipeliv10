export const GAME_INACTIVITY_LIMIT_MS = 2 * 60 * 60 * 1000;

export const isGameInactive = (lastActivityAt, now = Date.now()) => {
  const last = Number(lastActivityAt);
  if (!Number.isFinite(last) || last <= 0) {
    return false;
  }
  return now - last >= GAME_INACTIVITY_LIMIT_MS;
};
