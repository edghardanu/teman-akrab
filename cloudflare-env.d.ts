declare global {
  interface CloudflareEnv {
    TURSO_DATABASE_URL?: string;
    TURSO_AUTH_TOKEN?: string;
    AUTH_SECRET?: string;
  }
}

export {};
