// Build-time settings. VITE_API_URL is the only one: the backend's base URL.
const raw = import.meta.env.VITE_API_URL;

if (!raw || !raw.trim()) {
  throw new Error(
    'VITE_API_URL is not set. Copy app/.env.example to app/.env (or set it in the host) and restart.',
  );
}

/** Backend base URL without a trailing slash, e.g. `http://localhost:3000`. */
export const API_URL = raw.trim().replace(/\/+$/, '');
