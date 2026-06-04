/**
 * Minimal type declarations for `hellosign-embedded` v2 (the package ships no
 * types). Covers only the surface we use: construct with a clientId, open a
 * signing URL (optionally into a container), and listen for events ('sign',
 * 'close', 'cancel', 'error', …).
 */
declare module 'hellosign-embedded' {
  export interface HelloSignOpenOptions {
    testMode?: boolean;
    skipDomainVerification?: boolean;
    container?: HTMLElement;
    allowCancel?: boolean;
    redirectTo?: string;
    [key: string]: unknown;
  }

  export default class HelloSign {
    constructor(options?: { clientId?: string; [key: string]: unknown });
    open(url: string, options?: HelloSignOpenOptions): void;
    close(): void;
    on(event: string, callback: (data?: unknown) => void): void;
    off(event: string, callback?: (data?: unknown) => void): void;
    static events: Record<string, string>;
  }
}
