// Simple UUID helper – uses native crypto.randomUUID when available
// and falls back to a lightweight pseudo‑UUID for older runtimes.

export function generateId(): string {
    // @ts-ignore – crypto may be undefined in older Node versions
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback: 8‑4‑4‑4‑12 hex format (good enough for local IDs)
    const hex = (len: number) =>
        Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}`;
}
