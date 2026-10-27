# Project Instructions

## Ground Rules
1. Create a branch named `feature/hardening-and-payments`. Commit at the end of each phase with a clear message. Never commit `.env` files, keys, or secrets.
2. Preserve the API response envelope everywhere: `{ success, message, data }`. Keep existing route paths working unless a change is explicitly stated.
3. Keep the existing stack. Do not migrate to TypeScript, replace Mongoose, or add a UI framework. Small, well-known libraries are acceptable when required.
4. After each phase, run `npm test` in `backend` and `npm run build` in `frontend`; fix regressions. If a test cannot run, report that accurately and do not claim it passed.
5. After each phase, write a short report describing changes, files touched, verification, and remaining work. For ambiguous or risky requirements, choose the safest option, note the decision, and continue.
6. Add every new environment variable to the appropriate `.env.example` with a placeholder, and document it in the README.
7. Never invent results. Clearly state failures and anything that could not be tested, including live payment calls that require credentials.

## API Convention
All API responses use `{ success, message, data }`. Preserve this envelope for success and error responses, and maintain existing route compatibility unless a requirement explicitly changes it.

## Privacy and Sensitive Data
Protect personal data, credentials, and payment information. Collect and retain only what is needed; never commit secrets or expose them in logs, error responses, reports, or client-visible code. Redact sensitive values when reporting or debugging. The referenced Phase 9 item 6 privacy wording was not present in the supplied task prompt; replace this section with its exact rule when provided.
