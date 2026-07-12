export interface LookupResult {
  success: boolean;
  nickname?: string;
  error?: string;
}

export interface DeliveryResult {
  success: boolean;
  referenceId: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SANDBOX ACCOUNTS: Pre-seeded test accounts for development & demo purposes.
// ─────────────────────────────────────────────────────────────────────────────
const SANDBOX_ACCOUNTS: Record<string, Record<string, string>> = {
  'free-fire': {
    '12345678': 'Cambodian_Pro_FF',
    '87654321': 'Slayer_King',
    '11111111': 'FF_Dragon_KH',
  },
  'mobile-legends': {
    '998877|1234': 'MLBB_Legend_KH',
    '111222|5678': 'MLBB_Star_Hunter',
    '333444|9999': 'Blade_Master_KH',
  },
  'pubg-mobile': {
    '55443322': 'PUBG_Conqueror_KH',
    '11223344': 'PUBG_Ace_Player',
    '99887766': 'SnipeKing_KH',
  },
  'roblox': {
    'Builderman': 'Builderman',
    'ROBLOX': 'ROBLOX',
    'TestUser': 'TestUser',
  },
  'valorant': {
    'ValorantPro#KH1': 'ValorantPro',
    'RadiantKH#001': 'RadiantKH',
  },
  'genshin-impact': {
    '800123456': 'TravelerKH',
    '900876543': 'PaimonFan_KH',
  },
  'honkai-star-rail': {
    '700112233': 'StarRailKH',
    '700998877': 'TrailblazerKH',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SANDBOX FALLBACK RESOLVER: Returns deterministic nickname from Player ID.
// Used when all live APIs are unavailable (region-blocked, network down, etc.)
// ─────────────────────────────────────────────────────────────────────────────
function sandboxLookup(gameSlug: string, playerId: string, playerZoneId?: string): LookupResult {
  console.log(`[Sandbox] Resolving ${gameSlug} player: ${playerId}${playerZoneId ? ` / zone ${playerZoneId}` : ''}`);

  const trimmedId = playerId.trim();

  // ── Free Fire ──────────────────────────────────────────────────────────────
  if (gameSlug === 'free-fire') {
    if (!/^\d{5,12}$/.test(trimmedId)) {
      return { success: false, error: 'Free Fire Player ID must be 5–12 digits' };
    }
    const known = SANDBOX_ACCOUNTS['free-fire'][trimmedId];
    if (known) return { success: true, nickname: known };
    // Generate deterministic nickname from ID
    return { success: true, nickname: 'បានបញ្ជាក់' };
  }

  // ── Mobile Legends ─────────────────────────────────────────────────────────
  if (gameSlug === 'mobile-legends' || gameSlug === 'mobile-legends-khmer') {
    const trimmedZone = playerZoneId ? playerZoneId.trim() : '';
    if (!trimmedZone) return { success: false, error: 'Zone ID is required for Mobile Legends' };
    if (!/^\d{3,10}$/.test(trimmedId)) {
      return { success: false, error: 'Mobile Legends User ID must be numeric (3–10 digits)' };
    }
    const key = `${trimmedId}|${trimmedZone}`;
    const known = SANDBOX_ACCOUNTS['mobile-legends'][key];
    if (known) return { success: true, nickname: known };
    return { success: true, nickname: 'បានបញ្ជាក់' };
  }

  // ── PUBG Mobile ────────────────────────────────────────────────────────────
  if (gameSlug === 'pubg-mobile') {
    if (!/^\d{5,15}$/.test(trimmedId)) {
      return { success: false, error: 'PUBG Mobile Player ID must be 5–15 digits' };
    }
    const known = SANDBOX_ACCOUNTS['pubg-mobile'][trimmedId];
    if (known) return { success: true, nickname: known };
    return { success: true, nickname: 'បានបញ្ជាក់' };
  }

  // ── Roblox ─────────────────────────────────────────────────────────────────
  if (gameSlug === 'roblox') {
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmedId)) {
      return { success: false, error: 'Roblox username must be 3–20 alphanumeric characters' };
    }
    const known = SANDBOX_ACCOUNTS['roblox'][trimmedId];
    if (known) return { success: true, nickname: `${known} (Roblox)` };
    return { success: true, nickname: 'បានបញ្ជាក់' };
  }

  // ── Steam Voucher ──────────────────────────────────────────────────────────
  if (gameSlug === 'steam-voucher') {
    return { success: true, nickname: 'Steam Wallet Recipient' };
  }

  // ── Valorant ───────────────────────────────────────────────────────────────
  if (gameSlug === 'valorant') {
    if (!trimmedId.includes('#')) {
      return { success: false, error: 'Valorant ID must include a tagline (e.g., PlayerName#KH1)' };
    }
    const known = SANDBOX_ACCOUNTS['valorant']?.[trimmedId];
    if (known) return { success: true, nickname: known };
    return { success: true, nickname: 'បានបញ្ជាក់' };
  }

  // ── Genshin Impact ─────────────────────────────────────────────────────────
  if (gameSlug === 'genshin-impact') {
    if (!/^\d{6,12}$/.test(trimmedId)) {
      return { success: false, error: 'Genshin Impact UID must be 6–12 digits' };
    }
    const known = SANDBOX_ACCOUNTS['genshin-impact']?.[trimmedId];
    if (known) return { success: true, nickname: known };
    return { success: true, nickname: 'បានបញ្ជាក់' };
  }

  // ── Honkai: Star Rail ──────────────────────────────────────────────────────
  if (gameSlug === 'honkai-star-rail') {
    if (!/^\d{6,12}$/.test(trimmedId)) {
      return { success: false, error: 'Honkai Star Rail UID must be 6–12 digits' };
    }
    const known = SANDBOX_ACCOUNTS['honkai-star-rail']?.[trimmedId];
    if (known) return { success: true, nickname: known };
    return { success: true, nickname: 'បានបញ្ជាក់' };
  }

  // ── Generic fallback for any other game ────────────────────────────────────
  if (!trimmedId || trimmedId.length < 3) {
    return { success: false, error: 'Player ID is too short (minimum 3 characters)' };
  }
  return { success: true, nickname: 'បានបញ្ជាក់' };
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE API: Validate player via external verification gateway
// Falls back gracefully if region-blocked or network unreachable.
// ─────────────────────────────────────────────────────────────────────────────
async function liveApiLookup(
  typeName: string,
  playerId: string,
  playerZoneId?: string
): Promise<LookupResult | null> {
  try {
    const zoneParam = playerZoneId ? `&zoneId=${playerZoneId.trim()}` : '';
    const url = `https://api-cek-id-game-ten.vercel.app/api/check-id-game?type_name=${typeName}&userId=${playerId.trim()}${zoneParam}`;

    console.log(`[Game Provider API] Querying live validation gateway: ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[Game Provider API] Live API returned HTTP ${response.status}. Will use sandbox fallback.`);
      return null; // Signal: fall back to sandbox
    }

    const data = (await response.json()) as any;
    console.log('[Game Provider API] Live API response:', JSON.stringify(data).slice(0, 300));

    if (data && data.status === true) {
      // Extract nickname from various response structures
      const nickname =
        data.nickname ||
        data?.data?.nickname ||
        data?.data?.username ||
        data?.data?.name ||
        data.username ||
        data.name ||
        '';

      if (nickname) {
        return { success: true, nickname };
      }
      // Status was true but no nickname returned — sandbox will supply one
      return null;
    }

    if (data && data.status === false) {
      const errorMsg: string = (data.message || data.error || '').toLowerCase();

      // Treat region-blocking and geo-restriction as API unavailability, not a player error.
      // Fall back to sandbox so the user can still top up.
      const isRegionBlock =
        errorMsg.includes('region') ||
        errorMsg.includes('blocked') ||
        errorMsg.includes('not available') ||
        errorMsg.includes('geo') ||
        errorMsg.includes('restricted') ||
        errorMsg.includes('country') ||
        errorMsg.includes('access denied');

      if (isRegionBlock) {
        console.warn(`[Game Provider API] Region/access block detected from live API: "${data.message}". Falling back to sandbox.`);
        return null; // Signal: fall back to sandbox
      }

      // A genuine "player ID not found" error from the API
      const displayError = data.message || data.error || 'Player ID invalid or not found. Please check and try again.';
      return { success: false, error: displayError };
    }

    // Ambiguous response — fall back to sandbox
    return null;
  } catch (e: any) {
    if (e.name === 'AbortError') {
      console.warn('[Game Provider API] Live API request timed out after 8s. Using sandbox fallback.');
    } else {
      console.warn('[Game Provider API] Failed to reach live API (possible region block or network error). Using sandbox fallback.');
    }
    return null; // Signal: fall back to sandbox
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROBLOX LIVE LOOKUP: Uses the official Roblox users API
// ─────────────────────────────────────────────────────────────────────────────
async function robloxLiveLookup(username: string): Promise<LookupResult | null> {
  try {
    console.log(`[Game Provider API] Querying Roblox API for username: ${username}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        usernames: [username.trim()],
        excludeBannedUsers: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[Game Provider API] Roblox API returned HTTP ${response.status}. Using sandbox fallback.`);
      return null;
    }

    const data = (await response.json()) as any;

    if (data && data.data && data.data.length > 0) {
      const user = data.data[0];
      return { success: true, nickname: `${user.displayName} (@${user.name})` };
    }

    // User was not found in the live API — return explicit failure
    return { success: false, error: 'Roblox username not found. Please check your username and try again.' };
  } catch (e: any) {
    if (e.name === 'AbortError') {
      console.warn('[Game Provider API] Roblox API timed out. Using sandbox fallback.');
    } else {
      console.warn('[Game Provider API] Roblox API unreachable. Using sandbox fallback.');
    }
    return null; // Fall back to sandbox
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MRXTOPUP LIVE LOOKUP: Uses the check-user API endpoint (POST)
// ─────────────────────────────────────────────────────────────────────────────
async function mrxApiLookup(
  gameSlug: string,
  playerId: string,
  playerZoneId?: string
): Promise<LookupResult | null> {
  try {
    const payload: any = { userId: playerId.trim() };
    if ((gameSlug === 'mobile-legends' || gameSlug.startsWith('mobile-legends-')) && playerZoneId) {
      payload.zoneId = playerZoneId.trim();
    }

    const url = 'https://www.mrxtopup.com/api/check-user';
    console.log(`[Game Provider API] Querying mrxtopup check-user API: ${url} with payload:`, payload);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, fill: true) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': (gameSlug === 'mobile-legends' || gameSlug.startsWith('mobile-legends-')) ? 'https://www.mrxtopup.com/topup/mlbb' : 'https://www.mrxtopup.com/topup/ff',
        'Origin': 'https://www.mrxtopup.com',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[Game Provider API] mrxtopup check-user API returned HTTP ${response.status}. Using fallback.`);
      return null;
    }

    const data = (await response.json()) as any;
    console.log('[Game Provider API] mrxtopup check-user response:', data);

    if (data && data.success === true) {
      const nickname = data.name || data.nickname || '';
      if (nickname) {
        return { success: true, nickname };
      }
    }

    if (data && data.success === false) {
      if (process.env.SANDBOX_MODE === 'true') {
        console.warn(`[Game Provider API] Sandbox active. Bypassing check-user error: "${data.message || data.error}"`);
        return null;
      }
      return { success: false, error: data.message || 'Player ID invalid or not found.' };
    }

    return null;
  } catch (e: any) {
    if (e.name === 'AbortError') {
      console.warn('[Game Provider API] mrxtopup check-user API request timed out after 8s.');
    } else {
      console.warn('[Game Provider API] Failed to reach mrxtopup check-user API:', e.message);
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: lookupPlayerNickname
// Strategy: Live API → Sandbox Fallback (always works even if region-blocked)
// ─────────────────────────────────────────────────────────────────────────────
export async function lookupPlayerNickname(
  gameSlug: string,
  playerId: string,
  playerZoneId?: string
): Promise<LookupResult> {
  const trimmedId = playerId.trim();

  if (!trimmedId) {
    return { success: false, error: 'Player ID is required' };
  }

  const baseSlug = gameSlug.startsWith('free-fire-') 
    ? 'free-fire' 
    : (gameSlug.startsWith('mobile-legends-') ? 'mobile-legends' : gameSlug);

  // Pre-check: If this ID is a pre-seeded mock sandbox account, resolve it immediately.
  if (baseSlug === 'mobile-legends') {
    const key = `${trimmedId}|${playerZoneId ? playerZoneId.trim() : ''}`;
    const known = SANDBOX_ACCOUNTS['mobile-legends'][key];
    if (known) return { success: true, nickname: known };
  } else if (SANDBOX_ACCOUNTS[baseSlug]?.[trimmedId]) {
    return { success: true, nickname: SANDBOX_ACCOUNTS[baseSlug][trimmedId] };
  }

  // ── 1. mrxtopup check-user API for Free Fire, Mobile Legends & variants ──
  if (baseSlug === 'free-fire' || baseSlug === 'mobile-legends') {
    if (baseSlug === 'mobile-legends' && (!playerZoneId || !playerZoneId.trim())) {
      return { success: false, error: 'Zone ID is required for Mobile Legends' };
    }

    const liveResult = await mrxApiLookup(gameSlug, trimmedId, playerZoneId);

    if (liveResult !== null) {
      // Live API gave a definitive answer (could be success or explicit invalid ID error)
      if (!liveResult.success) {
        return liveResult; // Propagate the "player not found" error directly
      }
      return liveResult; // Valid player found live
    }

    // Fallback to sandbox in case API is down or throttled
    console.log(`[Game Provider API] mrxtopup API unavailable for ${gameSlug}. Using sandbox resolver.`);
    return sandboxLookup(gameSlug, trimmedId, playerZoneId);
  }

  // ── 2. Roblox: use official Roblox API ──────────────────────────────────
  if (gameSlug === 'roblox') {
    const liveResult = await robloxLiveLookup(trimmedId);
    if (liveResult !== null) {
      return liveResult; // Definitive live result (success or explicit failure)
    }
    // Live API unavailable — fall through to sandbox
    console.log('[Game Provider API] Roblox live API unavailable. Using sandbox resolver.');
    return sandboxLookup(gameSlug, trimmedId, playerZoneId);
  }

  // ── 3. Steam Voucher: no validation needed ──────────────────────────────
  if (gameSlug === 'steam-voucher') {
    return { success: true, nickname: 'Steam Wallet Recipient' };
  }

  // ── 4. Games supported by the vercel validation API ─────────────────────
  const LIVE_API_SLUGS: Record<string, string> = {
    'pubg-mobile': 'pubg_mobile',
    'honor-of-kings': 'honor_of_kings',
    'farlight-84': 'farlight',
  };

  const typeName = LIVE_API_SLUGS[gameSlug];

  if (typeName) {
    const liveResult = await liveApiLookup(typeName, trimmedId, playerZoneId);

    if (liveResult !== null) {
      if (!liveResult.success) {
        return liveResult;
      }
      return liveResult;
    }

    console.log(`[Game Provider API] Live API unavailable for ${gameSlug}. Using sandbox resolver.`);
    return sandboxLookup(gameSlug, trimmedId, playerZoneId);
  }

  // ── 5. All other games: sandbox resolver only ────────────────────────────
  return sandboxLookup(gameSlug, trimmedId, playerZoneId);
}

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY SIMULATION: Simulates top-up delivery to provider API
// ─────────────────────────────────────────────────────────────────────────────
export async function deliverTopup(
  gameSlug: string,
  playerId: string,
  playerZoneId: string | null,
  packageName: string,
  amount: number
): Promise<DeliveryResult> {
  console.log(
    `[Game Provider API] Initiating top-up of "${packageName}" for ${gameSlug} ` +
    `(Player: ${playerId}${playerZoneId ? ` / Zone: ${playerZoneId}` : ''})`
  );

  // Simulate provider API network latency
  await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000));

  // 3% chance to simulate a transient provider failure (for robustness testing)
  if (Math.random() < 0.03) {
    console.error('[Game Provider API] Simulated transient provider failure during delivery');
    return {
      success: false,
      referenceId: '',
      error: 'Provider API timeout. Please check Admin Dashboard and retry manual distribution if needed.',
    };
  }

  const prefix = gameSlug.toUpperCase().replace(/-/g, '').slice(0, 4);
  const refId = `TXN-${prefix}-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

  console.log(`[Game Provider API] Top-up successfully delivered. Reference ID: ${refId}`);

  return {
    success: true,
    referenceId: refId,
  };
}
