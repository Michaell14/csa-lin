/**
 * Deployment switches. Each reads a NEXT_PUBLIC_ variable literally so Next.js
 * inlines it at build time; changing one on Vercel takes effect on the next deploy.
 */

/** Lin memories, timeline and uploads alike. On unless a deployment sets it to "false", so the storage quota can be protected without a code change. */
export function memoriesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MEMORIES_ENABLED !== 'false'
}
