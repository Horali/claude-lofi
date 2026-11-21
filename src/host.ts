// What the audio and title code may do on the host, as plain functions.
// (A mod passes the engine handle to no other function; hooks/register.tsx
// builds one of these from it.)
export type Host = {
  run(argv: readonly string[], timeoutMs: number): Promise<{ exitCode: number; stdout: string }>
  spawn(argv: readonly string[]): AsyncIterable<unknown>
  platform(): Promise<string | undefined>
  after(ms: number, fn: () => void): void
  playEngine(url: string, signal: AbortSignal): Promise<unknown>
}
