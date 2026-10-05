// Replacement for TanStack's useServerFn: our server calls are plain async functions.
export function useServerFn<T extends (...args: any[]) => any>(fn: T): T {
  return fn;
}
