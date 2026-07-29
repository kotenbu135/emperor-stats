// next/link and next/image read `process.env.__NEXT_*` in their module bodies.
// Outside Node there is no `process`, so the IIFE bundle threw
// "ReferenceError: process is not defined" at eval time and
// window.EmperorStatsDS was never assigned — every preview rendered blank.
//
// Imported FIRST from ds-entry.tsx so this body runs before any next/* module
// body. An empty env is the correct value here: every __NEXT_* flag these
// modules read is a build-time toggle whose "unset" branch is the plain
// behaviour we want (no basePath rewriting, no dev-server hooks).
const g = globalThis as unknown as {
  process?: { env: Record<string, string | undefined> };
};
g.process ??= { env: {} };

export {};
