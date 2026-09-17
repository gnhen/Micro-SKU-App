// Remote availability of the app.
//
// A single canonical probe is shared by every caller (update checks, layout
// gating, ...) via a short-lived in-flight cache, so concurrent callers result
// in one network request rather than several.
//
// The probe returns a coarse state instead of raw transport details:
//   - "active"  -> the remote target answered and is reachable
//   - "gone"    -> the remote target explicitly reported not-found (HTTP 404)
//   - "offline" -> the request could not complete (network / transport error)
//   - "unknown" -> any other HTTP status (rate-limited, forbidden, ...)

const REMOTE_STATE_URL =
  'https://api.github.com/repos/gnhen/Micro-SKU-App/releases/latest';

const CACHE_TTL_MS = 30_000;

let inflight = null;
let cached = null; // { value, at }

async function probeRemoteState() {
  const response = await fetch(REMOTE_STATE_URL, {
    method: 'GET',
    cache: 'no-store',
  });

  if (response.status === 404) {
    return { state: 'gone', release: null };
  }

  if (response.ok) {
    let release = null;
    try {
      release = await response.json();
    } catch (_parseError) {
      // A reachable endpoint that returns a non-JSON body is still "active".
    }
    return { state: 'active', release };
  }

  return { state: 'unknown', release: null };
}

export function getRemoteState({ force = false } = {}) {
  const now = Date.now();

  if (!force && cached && now - cached.at < CACHE_TTL_MS) {
    return Promise.resolve(cached.value);
  }

  if (!inflight) {
    inflight = probeRemoteState()
      .then((value) => {
        cached = { value, at: Date.now() };
        return value;
      })
      .catch(() => {
        const value = { state: 'offline', release: null };
        cached = { value, at: Date.now() };
        return value;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}
