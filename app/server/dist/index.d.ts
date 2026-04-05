/**
 * agent-os server
 *
 * A thin server that:
 * 1. Reads files from an ops directory and serves them to the UI
 * 2. Manages context and action registries from the filesystem
 * 3. Starts agent runs and streams output to the browser via SSE
 *
 * The filesystem IS the database. This server just observes it.
 */
export {};
