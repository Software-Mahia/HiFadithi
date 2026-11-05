export type StaffUser = {
  id: string;
  email: string;
  full_name: string;
  role: 'researcher' | 'curator' | 'admin';
};
export type StaffSession = {
  token: string;
  expires_at: string;
  user: StaffUser;
};

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<T> {
  const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!base)
    throw new Error(
      'The staff service is not configured. Contact your administrator.',
    );
  if (
    !base.startsWith('https://') &&
    !(__DEV__ && base.startsWith('http://'))
  ) {
    throw new Error('The staff service requires a secure connection.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${base}${path}`, {
      method: options.body === undefined ? 'GET' : 'POST',
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok)
      throw new APIError(
        result?.error?.message ?? 'The request failed. Please try again.',
        response.status,
      );
    if (result === null) throw new Error('Unexpected response.');
    return result as T;
  } catch (error) {
    if (error instanceof APIError) throw error;
    throw new Error(
      'Unable to reach the staff service. Check your connection and try again.',
    );
  } finally {
    clearTimeout(timeout);
  }
}
