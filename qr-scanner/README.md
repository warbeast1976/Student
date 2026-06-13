# Student Absence Report System QR Scanner (Expo)

Expo app for **student** QR check-in, **teacher** attendance sessions (live QR + close), and **class announcements** (read/mark read). Admins can sign in but are directed to the web portal for full tools.

## Requirements

- Node.js 18+
- npm
- Expo Go app (or Android/iOS emulator)

## Install and run

```bash
npm install
npm run start
```

Useful commands:

```bash
npm run android
npm run ios
npm run web
npm run lint
npm run typecheck
npm run check
```

## Project structure

- `app/` - Expo Router screens
- `components/` - shared UI components
- `hooks/` - reusable hooks
- `constants/` - app constants and theme tokens

## Configuration

Copy `.env.example` to `.env` and set:

- `EXPO_PUBLIC_API_BASE_URL` — API origin without trailing slash (e.g. `http://192.168.1.10:8000` on a phone).
- `EXPO_PUBLIC_SARS_API_KEY` — must match Laravel `FRONTEND_API_KEY` when the API gate is enabled.
- `EXPO_PUBLIC_ENFORCE_HTTPS` — set `true` to block non-HTTPS API URLs (except localhost/emulator); recommended for production.

If unset, the app falls back to Expo LAN detection or emulator defaults (`10.0.2.2` on Android).

## Backend integration

Run the Laravel API (`BE`) and ensure the device can reach it (same Wi‑Fi, firewall allows the port). Production APIs must use HTTPS and a valid certificate for real devices.

## UX / behavior

- Pull-to-refresh on the scanner and announcements tabs
- Tablet-friendly max content width (centered column)
- Safe-area padding on scroll areas; stat tiles wrap on very narrow screens
- Laravel validation errors (`errors` object) surface as readable messages
- Haptic feedback on check-in and session actions (where supported)
- Network requests use a timeout and normalized error handling for clearer failures
- Query retries avoid retrying most 4xx responses to reduce noisy repeated requests
- Centralized `401` handling signs out stale sessions automatically
- Session expiry is enforced from JWT `exp` when available

## Production notes

- Build signed app binaries with EAS or platform-native tooling
- Point scanner network calls to production API endpoints
- Validate backend auth and role behavior before release
