# xChat - Professional Chat Platform for the Precious Metals Industry

[![Build Status](https://github.com/marcopersi/xchat/actions/workflows/docker-build.yml/badge.svg)](https://github.com/marcopersi/xchat/actions/workflows/docker-build.yml)

xChat is a specialized messaging platform designed for professionals in the precious metals industry, enabling secure and efficient communication.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or newer)
- npm (comes with Node.js) or [yarn](https://yarnpkg.com/)

### Installation

1. Clone the repository to your local machine:

```sh
git clone <your-repository-url>
cd xchat
```

2. Install project dependencies:

```sh
npm install
# or
yarn install
```

3. Start the development server:

```sh
npm run dev
# or
yarn dev
```

4. Open your browser and navigate to:

```
http://localhost:8080
```

## Docker Support

### Building the Docker Image

To build the Docker image locally:

```sh
docker build -t xchat:latest .
```

### Running the Docker Container

To run the container locally:

```sh
docker run -p 8080:8080 xchat:latest
```

Then access the application at `http://localhost:8080` in your browser.

### Pulling the Demo Image from GHCR

Pushes to `main` now publish a Linux AMD64 image to GitHub Container Registry:

```sh
docker pull ghcr.io/marcopersi/xchat:latest
```

Example VM deployment with runtime configuration:

```sh
docker run -d --name xchat \
   -p 8080:8080 \
   -e XCHAT_VENDOR_ADMIN_EMAIL=admin@vendor.local \
   -e XCHAT_VENDOR_ADMIN_PASSWORD='change-this-password' \
   -e XCHAT_BIL_ENABLED=true \
   -e XCHAT_BIL_BASE_URL=https://bil.example.com/api \
   -e XCHAT_BIL_NETWORK=production \
   -e XCHAT_BIL_PARTICIPANT_ID=vendor-desk-001 \
   ghcr.io/marcopersi/xchat:latest
```

Or with Docker Compose on the VM:

```sh
docker compose -f docker-compose.ghcr.yml up -d
```

### Windows VM Deployment Bundle

If you want to deploy on a Windows VM without a full repository checkout, copy only these files to the VM:

- `docker-compose.windows.yml`
- `.env.windows.example`
- `scripts/windows/install.ps1`
- `scripts/windows/update.ps1`

The bundle supports two runtime modes:

- Local demo mode without Supabase
- External Supabase mode with runtime environment variables only

Fastest one-off start with `docker run`:

```powershell
docker pull ghcr.io/marcopersi/xchat:latest
docker run -d --name xchat -p 8080:8080 ghcr.io/marcopersi/xchat:latest
```

Repeatable Windows VM setup with `docker compose`:

```powershell
./scripts/windows/install.ps1 -Template mock
```

For external Supabase mode, start from the dedicated template instead:

```powershell
./scripts/windows/install.ps1 -Template supabase
```

The installer only creates `.env.windows` automatically when it does not exist yet. Once the file exists, your local edits are preserved across repeated runs.

The compose bundle now supports `XCHAT_IMAGE_TAG`, which defaults to `latest` and can be pinned to a release tag such as `v1.2.3`.

If you want a ready-to-copy ZIP instead of manually collecting the files, build it locally with:

```sh
sh ./scripts/package-windows-deploy-bundle.sh
```

This creates `dist/xchat-deploy.zip`.

To build a versioned ZIP locally, pass a bundle version:

```sh
BUNDLE_VERSION=v1.2.3 sh ./scripts/package-windows-deploy-bundle.sh
```

This creates `dist/xchat-deploy-v1.2.3.zip`.

The ZIP now contains `install-instructions.txt`, `.env.windows.example`, and `.env.windows.supabase.example` for VM admins.

The default `.env.windows.example` starts the app in mock/local mode, so no Supabase instance is required.

If you prefer to create the file manually, external Supabase mode requires:

```env
XCHAT_IMAGE_TAG=v1.2.3
XCHAT_API_MODE=real
XCHAT_PERSISTENCE_PROVIDER=supabase
XCHAT_REALTIME_CARRIER=supabase
XCHAT_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
XCHAT_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
XCHAT_SUPABASE_AUTH_REDIRECT_URL=http://YOUR_VM_HOST:8080
```

To update the Windows VM later without touching the configuration file:

```powershell
./scripts/windows/update.ps1
```

GitHub Actions also publishes the same ZIP as the `xchat-deploy` artifact via the `Windows Deploy Bundle` workflow.

When you publish a GitHub Release, the same workflow also attaches the ZIP directly to the Release assets.

The release flow also publishes a matching GHCR image tag, so a Release `v1.2.3` yields both `ghcr.io/marcopersi/xchat:v1.2.3` and a bundle ZIP with the same version suffix.

Runtime notes:

- The container writes a `runtime-config.js` file at startup so the pulled image can be configured without rebuilding.
- The vendor admin account is intended for demo and test operations only.
- BIL settings can be seeded through container environment variables and then adjusted in the Admin Console.
- A ready-to-use compose file is available in `docker-compose.ghcr.yml`.
  The GHCR push uses the repository-scoped `GITHUB_TOKEN`, so no extra DockerHub secrets are required for the default image publication path.

## CI/CD Pipeline

This repository includes one GitHub Actions workflow with one job that runs the full gate in a single pass:

1. ESLint
2. Production build
3. JSCPD duplicate detection with a hard limit below 5%
4. Semgrep architecture rules
5. Semgrep OWASP Top 10 ruleset
6. Playwright E2E tests
7. Docker image build
8. OWASP ZAP baseline scan against the built container

The workflow runs automatically when code is pushed to the main branch or when a pull request is created.

On pushes to `main`, the workflow also publishes the Docker image to `ghcr.io/marcopersi/xchat` with the tags `latest` and the full commit SHA.

Generated artifacts such as `reports/`, `semgrep.sarif`, Playwright reports, build output, and Supabase temp files are intentionally ignored via `.gitignore` and uploaded by CI instead of being committed.

## Local Quality Gates

The repository installs a `pre-commit` hook through Husky.

Hook stack:

- Prettier on staged files via `lint-staged`
- JSCPD with a repository cap below 5%
- Semgrep architecture rules

Playwright E2E tests run in CI only so local commits stay fast enough.

Additional local prerequisite for the Semgrep hook:

```sh
npm run semgrep:setup
```

Useful commands:

```sh
npm run format:write
npm run ci:verify
npm run test:e2e
npm run semgrep:owasp
npm run docker:build:ci
```

To enable automatic pushing to a Docker registry:

1. Add your Docker registry credentials to your GitHub repository secrets:
   - Go to your GitHub repository → Settings → Secrets and Variables → Actions
   - Add the following secrets:
     - `DOCKERHUB_USERNAME`: Your Docker Hub username
     - `DOCKERHUB_TOKEN`: Your Docker Hub access token

2. Uncomment the "push" job in the `.github/workflows/docker-build.yml` file and update the image name in the tags.

### Deploying to Kubernetes

1. Ensure you have kubectl configured to connect to your Kubernetes cluster.

2. Create a simple deployment and service:

```sh
# Create deployment
kubectl create deployment xchat --image=<your-registry>/xchat:latest

# Expose the deployment
kubectl expose deployment xchat --type=LoadBalancer --port=80
```

Or apply a Kubernetes configuration file:

```sh
kubectl apply -f kubernetes-manifest.yml
```

## Connecting to the Backend

xChat can connect to either a custom WebSocket backend or Supabase Realtime for message distribution.

### Supabase Realtime + Persistence (Recommended)

The app now supports provider-based realtime and persistence with Supabase-first defaults and local fallback.

1. Create your env file from the template:

```sh
cp .env.example .env.development
```

2. Fill these required values in `.env.development`:

```sh
VITE_REALTIME_CARRIER=supabase
VITE_PERSISTENCE_PROVIDER=supabase
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
VITE_SUPABASE_AUTH_REDIRECT_URL=http://127.0.0.1:4173
```

Recommended file layout:

```text
.env.example        # committed template only
.env.development    # local development values, not committed
.env.local          # optional local override, not committed
```

Key choice:

- Use the Supabase publishable key for this Vite frontend.
- Do not use the Supabase secret key in this app, because any `VITE_*` value is exposed to the browser bundle.
- `VITE_SUPABASE_ANON_KEY` is still accepted as a legacy fallback, but new setup should use `VITE_SUPABASE_PUBLISHABLE_KEY`.

Commit policy:

- Do not commit `.env`, `.env.development`, `.env.local`, or other real env files.
- Keep only `.env.example` in the repository as the reference template.

3. Authenticate and link the local workspace to your Supabase project:

```sh
npm run supabase:login
export SUPABASE_PROJECT_REF=<your-project-ref>
npm run supabase:link
```

4. Apply the SQL migrations:

```sh
npm run supabase:push
```

This pushes both migrations:

```text
supabase/migrations/20260320010000_xchat_realtime_persistence.sql
supabase/migrations/20260320011000_xchat_security_hardening.sql
```

5. In Supabase Auth, enable either email/password or magic-link authentication for your users.

For shared admin system settings, use a Supabase-authenticated admin session. The Admin Console stores BIL settings in `public.system_settings` when a signed-in Supabase user is present, and falls back to browser-local storage when Supabase auth is not available.

6. Start the app:

```sh
npm run dev -- --host 127.0.0.1 --port 4173
```

7. Log in with either:

- the existing demo credentials, which keep using local fallback storage
- a real Supabase user, which unlocks authenticated RLS-backed Supabase persistence

Security notes:

- The hardening migration replaces the initial dev-allow-all policies with `authenticated` RLS policies scoped to `auth.uid()`.
- Each persisted row now carries an `owner_id`, so a signed-in Supabase user can only read and mutate their own rows.
- If Supabase auth is not active, persistence automatically falls back to local browser storage instead of failing hard.

Manual fallback if you prefer SQL Editor:

```sql
-- Apply both files in order:
-- 1) supabase/migrations/20260320010000_xchat_realtime_persistence.sql
-- 2) supabase/migrations/20260320011000_xchat_security_hardening.sql
```

Notes:

- If Supabase env values are missing, xChat automatically falls back to local browser-based transport/storage.
- Realtime carrier options: `local`, `websocket`, `supabase`.
- Persistence provider options: `local`, `supabase`.
- Magic-link auth requires the redirect URL in your local env file, usually `.env.development`, to match the URL configured in Supabase Auth.

### Custom WebSocket Backend

To connect to a custom WebSocket backend:

1. Set the WebSocket URL environment variable when building or running the application:

```sh
# For development
VITE_WS_URL=ws://your-backend-url/ws npm run dev

# For Docker
docker run -p 8080:8080 -e VITE_WS_URL=ws://your-backend-url/ws xchat:latest
```

2. The frontend will automatically attempt to connect to the specified WebSocket endpoint.

3. Your backend should implement the following message types:
   - `message`: New chat messages
   - `typing`: Typing indicators
   - `read`: Message read receipts
   - `delivered`: Message delivery confirmations

### Backend API Integration

If you're implementing your own backend, it should expose these endpoints:

- WebSocket connection for real-time messaging
- REST API for chat history, user management, etc.

## Demo Login Credentials

Use these credentials to log in to the demo version:

- **Email**: demo@axedras.com
- **Password**: password

The container also exposes a default vendor admin account unless overridden via runtime environment variables:

- **Email**: admin@xchat.local
- **Password**: change-me-demo-admin

Use the vendor admin account to open the Admin Console and maintain browser-local system settings such as BIL connectivity in demo deployments.

If Supabase auth is configured and the admin user signs in with a Supabase-backed account, the same Admin Console writes shared settings into `public.system_settings` instead of browser-local storage.

- **Password**: password

## Project Structure

```
src/
├── components/     # UI components
├── config/         # Configuration files
├── data/           # Mock data and constants
├── hooks/          # Custom React hooks
├── lib/            # Utility libraries
├── pages/          # Page components
├── services/       # API services
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

## Features

- **User Authentication:** Secure login system
- **Real-time Messaging:** Send and receive messages instantly
- **Company Directory:** Browse and connect with companies in the precious metals sector
- **Message Archive:** Archive and restore conversations
- **Profile Management:** Update user profile and preferences
- **Responsive Design:** Works on desktop and mobile devices

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the app for production
- `npm run preview` - Preview the production build locally
- `npm run test:e2e:install` - Install Playwright Chromium browser
- `npm run test:e2e` - Run end-to-end tests in headless mode
- `npm run test:e2e:headed` - Run end-to-end tests with visible browser
- `npm run test:e2e:ui` - Open Playwright interactive test UI

## End-to-End Tests

The repository includes Playwright tests for RFQ and deal workflows under `e2e/`.

Run once after cloning:

```sh
npm run test:e2e:install
```

Run the suite:

```sh
npm run test:e2e
```

Current scenarios cover:

- Login and dashboard access
- Deal history visibility for counterparty context
- Quote submission and conversion to booked deal
- Counter and reject quote lifecycle
- Reload persistence for messages and quote/deal workflow state

## Technology Stack

- **React** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - UI component library
- **React Router** - Client-side routing
- **React Query** - Data fetching and state management

## Extending the Application

### Adding Real Backend Integration

The application supports connecting to a real backend through:

1. WebSockets for real-time messaging
2. REST API for data operations
3. Environment configuration for different deployment scenarios

### Adding New Features

1. Create new components in the `components/` directory
2. Add new pages in the `pages/` directory
3. Configure routes in `App.tsx`
4. Add necessary hooks and services

## License

[MIT License](LICENSE)

## Contact

For questions or support, please contact [your-email@example.com](mailto:your-email@example.com).
