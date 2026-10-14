declare global {
  interface CloudflareEnv {
    DB: D1Database;
    AUTH_SECRET?: string;
  }
}

export {};
