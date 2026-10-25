// Node 18 no expone Web Crypto como global (Deno, los navegadores y Node ≥ 20 sí).
import { webcrypto } from 'node:crypto';

if (!(globalThis as { crypto?: unknown }).crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
