# Mobile (Expo)

Expo SDK 58 app shell, shared UI components, sign-in and invitation screens.
Run all Expo and npm commands from this directory:

```powershell
cd mobile
npm.cmd ci
# Copy only if .env does not already exist.
Copy-Item .env.example .env
npm.cmd start
```

Set `EXPO_PUBLIC_API_URL` to the development API address. Android emulators use
`http://10.0.2.2:8000`; phones need the computer's LAN IP. Release builds require
HTTPS. Only public client configuration belongs in this file.

**Authentication integration is pending.** These preserved local screens expect
email sign-in, opaque bearer sessions and invitation endpoints under `/api/auth/`.
The shared `backend/` currently provides username-based JWT sign-in at
`/api/auth/token/` and refresh at `/api/auth/token/refresh/`. The mobile sign-in,
session restoration and invitations will not work with that backend until the
contracts are reconciled. Transport tests do not prove backend compatibility.

Routes are in `src/app/`, shared UI in `src/components/ui/`, and auth/API utilities
in `src/lib/`. The existing screens remain split between A, B, C and D.

Checks:

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run test:auth
npx.cmd expo export --platform android
```

Device testing of SecureStore and the screens remains pending. Legacy Supabase
database scripts are not part of this mobile package; use the shared Django
backend's migration and test commands.
