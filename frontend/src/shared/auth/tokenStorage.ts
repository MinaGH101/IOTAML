const AUTH_TOKEN_KEY = 'iota-auth-token';

export interface AuthTokenStorage {
  read(): string;
  write(token: string): void;
  clear(): void;
}

class LocalStorageAuthTokenStorage implements AuthTokenStorage {
  read() {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || '';
  }

  write(token: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  }

  clear() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export const authTokenStorage: AuthTokenStorage = new LocalStorageAuthTokenStorage();
export { AUTH_TOKEN_KEY };
