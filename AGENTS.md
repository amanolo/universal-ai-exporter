# Universal AI Exporter - Workspace Rules

## Execution & Code Modification Guardrails
- **No Unsolicited Changes**: Never perform code edits, file modifications, or git commits unless explicitly asked by the user or after explicit user approval.
- **Preview & Investigation**: When asked to preview, explain, or investigate, keep operations strictly read-only and conversational. Propose any potential fixes as recommendations rather than applying them autonomously.

## Autonomous Quality Assurance & Health Check Standard
- **Mandatory Post-Execution Health Check**: Whenever any code modification, feature addition, or refactoring is performed (upon user approval), the agent MUST ALWAYS automatically execute a complete health audit and report the results before concluding the turn:
  1. **Automated Tests**: Run `npm test` and `npm run test:license` to verify CSV escaping, Markdown frontmatter, and Ed25519 Web Crypto signatures.
  2. **Type Safety & Build**: Run `npx tsc --noEmit` (0 errors required) and `npm run package`.
  3. **Code Cleanliness**: Audit for bugs, unhandled exceptions, unused variables/imports, and redundant logic.
  4. **Manifest V3 & Security**: Enforce CSP compliance (no `eval` or inline scripts), scoped `host_permissions`, and real icon file existence.
  5. **Privacy & Memory**: Verify 0 outbound network requests, local-only processing, and proper `URL.revokeObjectURL` lifecycle cleanup.
  6. **Multi-Browser & Package Hygiene**: Ensure dual Chromium/Firefox MV3 compatibility and verify that release `.zip` files exclude `.git/`, `node_modules/`, and private keys.
