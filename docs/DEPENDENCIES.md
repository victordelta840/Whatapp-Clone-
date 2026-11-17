# Dependencies Justification

All runtime and dev dependencies follow Section 4 and Section 8.1 of the specification. Any companion adapter or tooling package not named explicitly is documented below.

| Package | Category | Justification |
| :--- | :--- | :--- |
| `firebase` | Runtime | Official Firebase modular v9+ SDK (Auth, Firestore, Storage, Functions, Messaging, App Check). |
| `react`, `react-dom` | Runtime | Core UI runtime specified in Section 4. |
| `react-router-dom` | Runtime | Client-side routing and deep links specified in Section 4. |
| `zustand` | Runtime | Lightweight feature-scoped client UI state stores specified in Section 4. |
| `react-hook-form` | Runtime | Performant accessible forms specified in Section 4. |
| `zod` | Runtime | Runtime schema validation for env, forms, callables, and Firestore read boundaries. |
| `@hookform/resolvers` | Runtime | Official `react-hook-form` adapter to connect `zod` schemas to form validation. |
| `idb` | Runtime | Typed IndexedDB wrapper for drafts, upload outbox, and local message search index. |
| `@tanstack/react-virtual` | Runtime | Virtualized chat, message, and member lists specified in Section 4. |
| `lucide-react` | Runtime | Functional UI icon library specified in Section 4. |
| `date-fns` | Runtime | Date arithmetic and formatting helpers specified in Section 4. |
| `emoji-picker-element` | Runtime | Lazily loaded Unicode emoji picker specified in Section 4. |
| `@radix-ui/react-*` | Runtime | Approved accessible UI primitives (`dialog`, `dropdown-menu`, `context-menu`, `tooltip`, `tabs`, `switch`, `popover`). |
| `motion` | Runtime | Preinstalled animation library used with `prefers-reduced-motion` support. |
| `vite-plugin-pwa`, `workbox-*` | Build/SW | `injectManifest` PWA and Workbox service-worker precaching/routing specified in Section 4. |
| `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` | Testing | Unit and component test runner and DOM assertions specified in Section 4. |
| `@firebase/rules-unit-testing` | Testing | Emulator-backed Firestore and Storage security rules test runner specified in Section 4. |
| `@playwright/test`, `@axe-core/playwright` | Testing | Cross-browser E2E and automated WCAG accessibility testing specified in Sections 4 and 9. |
| `eslint`, `prettier`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `@firebase/eslint-plugin-security-rules` | Quality | Linting, formatting, accessibility lint, and security rules static checks specified in Section 9. |
| `jszip` (in `functions/`) | Functions | Builds the downloadable ZIP archive inside `exportMyData` (`exports/{uid}/{exportId}.zip`). |
