# npm workspace and Node 26 design

## Goal

Make WeatherB runnable from the repository root with npm on exactly Node 26.7.0.

## Decision

Use npm workspaces as the single package-management path. Pin the project to
Node 26.7.0 and npm 11.19.0. Do not retain a parallel pnpm installation path.

## Scope

- Add the existing workspace folders to root `package.json`.
- Replace pnpm-rooted scripts with npm workspace scripts.
- Replace `pnpm-lock.yaml` and `pnpm-workspace.yaml` with a committed npm
  `package-lock.json` generated under Node 26.7.0.
- Update GitHub Actions, Vercel settings, the root README, and active script
  usage notes to use npm.
- Leave historical planning and handoff documents unchanged.

## Expected developer flow

```bash
nvm use
npm ci
npm run dev
```

`npm run dev` starts the Next.js web workspace. npm resolves linked internal
package dependencies and installs web-only packages such as `dotenv`.

## Failure handling

If npm cannot construct the workspace lockfile or a Node 26 incompatibility
appears, capture the exact package and error before making the narrowest
compatible dependency adjustment. Do not silently fall back to pnpm.

## Compatibility note

npm 11.19.0 rejects the pnpm-specific `workspace:*` protocol in this project.
The two internal dependencies use local `file:` links instead, while npm
workspaces still manage installation and script execution.

Coinbase's SDK marks its `@x402/*` imports as optional peers, but Thirdweb
loads them during homepage compilation. The web workspace declares those four
packages explicitly so a clean npm install can render the app.

## Verification

1. Confirm `node --version` is `v26.7.0`.
2. Confirm `npm ci` creates the web workspace dependencies.
3. Run `npm run dev` and verify an HTTP response from the local server.
4. Run focused package-manager checks, then report any unrelated pre-existing
   application test failures separately.
