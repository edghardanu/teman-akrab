export type ApiPayload = { error?: string; [key: string]: unknown };

export async function safeJson<T extends object = ApiPayload>(response: Response | null): Promise<T> {
  if (!response) return {} as T;
  return await response.json().catch(() => ({})) as T;
}
