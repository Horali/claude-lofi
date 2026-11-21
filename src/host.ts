// What the audio and song code may do on the host, as plain functions.
// (A mod passes the engine handle to no other function; hooks/register.tsx
// builds one of these from it.)
export type Host = {
  run(argv: readonly string[], timeoutMs: number): Promise<{ exitCode: number; stdout: string }>
  spawn(argv: readonly string[]): AsyncIterable<unknown>
  fetch(url: string, headers?: Record<string, string>): Promise<{ ok: boolean; status: number; text: string }>
  platform(): Promise<string | undefined>
  after(ms: number, fn: () => void): void
  playEngine(url: string, signal: AbortSignal): Promise<unknown>
}
