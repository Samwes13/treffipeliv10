import { ref, set, push } from 'firebase/database';
import { database } from '../firebaseConfig';

const INVALID_KEY_CHARS = /[.#$/\\[\\]]/g;

export const sanitizeKey = (value = '') => value.replace(INVALID_KEY_CHARS, '_');

/**
 * Seed a debug game with a list of usernames. Generates players and their traits.
 * @param {Object} options
 * @param {string} options.gamepin - Game pin to seed under `games/{gamepin}`
 * @param {string[]} options.usernames - List of player usernames to create (sanitized automatically)
 * @param {number} [options.traitsPerPlayer=6] - How many traits each player gets
 * @param {number} [options.hostIndex=0] - Index within usernames array that should be marked as host
 * @param {(info: { username: string, playerIndex: number, traitIndex: number, traitsPerPlayer: number }) => string} [options.traitFactory]
 *        Callback to generate trait text. Defaults to `Debug trait {n} ({username})`.
 * @param {(username: string, event: { stage: string, current?: number, total?: number }) => void} [options.onPlayerStatus]
 *        Progress callback invoked at key stages (player-created, traits-start, trait-progress, traits-complete)
 * @returns {Promise<{ hostName: string }>}
 */
export async function seedPlayersWithTraits({
  gamepin,
  usernames,
  traitsPerPlayer = 6,
  hostIndex = 0,
  traitFactory,
  onPlayerStatus,
}) {
  if (!gamepin) throw new Error('gamepin is required');
  if (!Array.isArray(usernames) || usernames.length === 0) {
    throw new Error('usernames must be a non-empty array');
  }

  const safeUsernames = usernames.map((name) => ({
    original: name,
    key: sanitizeKey(name),
  }));

  const hostName = usernames[hostIndex] ?? usernames[0];

  const playersPayload = safeUsernames.reduce((acc, { original, key }, idx) => {
    acc[key] = {
      username: original,
      isHost: idx === hostIndex,
      traitsCompleted: true,
      acceptedTraits: [],
    };
    return acc;
  }, {});

  const gameRef = ref(database, `games/${gamepin}`);

  await set(gameRef, {
    host: hostName,
    gamepin,
    isGameStarted: false,
    currentTrait: null,
    currentRound: 1,
    currentPlayerIndex: 0,
    usedTraits: [],
    animation: null,
    players: playersPayload,
  });

  safeUsernames.forEach(({ original }, idx) => {
    onPlayerStatus?.(original, { stage: 'player-created', total: traitsPerPlayer, current: 0, playerIndex: idx });
  });

  for (let pIndex = 0; pIndex < safeUsernames.length; pIndex += 1) {
    const { original, key } = safeUsernames[pIndex];
    const traitsRef = ref(database, `games/${gamepin}/traits/${key}`);

    onPlayerStatus?.(original, { stage: 'traits-start', total: traitsPerPlayer, current: 0, playerIndex: pIndex });
    await set(traitsRef, null);

    for (let tIndex = 0; tIndex < traitsPerPlayer; tIndex += 1) {
      onPlayerStatus?.(original, {
        stage: 'trait-progress',
        total: traitsPerPlayer,
        current: tIndex + 1,
        playerIndex: pIndex,
      });
      const traitRef = push(traitsRef);
      const text = traitFactory
        ? traitFactory({ username: original, playerIndex: pIndex, traitIndex: tIndex, traitsPerPlayer })
        : `Debug trait ${tIndex + 1} (${original})`;
      await set(traitRef, {
        traitId: traitRef.key,
        text,
        order: tIndex,
      });
    }

    onPlayerStatus?.(original, {
      stage: 'traits-complete',
      total: traitsPerPlayer,
      current: traitsPerPlayer,
      playerIndex: pIndex,
    });
  }

  return { hostName };
}
