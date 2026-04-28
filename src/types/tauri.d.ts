/**
 * Type declarations for Tauri API
 * 
 * These types provide TypeScript support for the Tauri invoke API.
 * The actual types come from @tauri-apps/api when running in Tauri.
 */

declare module '@tauri-apps/api/tauri' {
  /**
   * Invoke a Tauri command
   * @param cmd - The command name to invoke
   * @param args - Optional arguments to pass to the command
   * @returns A promise resolving to the command result
   */
  export function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}