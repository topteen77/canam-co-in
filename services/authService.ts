/**
 * Auth via backend API (JWT). No Firebase.
 */
import apiClient from './apiClient';

const CRM_USER = 'crmUser';
const CRM_TOKEN = 'crmToken';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
}

export async function login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
  const res = await apiClient.post<{ success: boolean; token: string; user: AuthUser }>('/auth/login', {
    email: email.trim().toLowerCase(),
    password,
  });
  if (!res.data?.token || !res.data?.user) throw new Error('Invalid response from server');
  const { token, user } = res.data;
  localStorage.setItem(CRM_TOKEN, token);
  localStorage.setItem(CRM_USER, JSON.stringify(user));
  setAuthHeader(token);
  return { user, token };
}

export async function register(email: string, password: string, name: string): Promise<void> {
  await apiClient.post('/auth/register', {
    email: email.trim().toLowerCase(),
    password,
    name: name || email.split('@')[0],
  });
}

export function logout(): void {
  localStorage.removeItem(CRM_USER);
  localStorage.removeItem(CRM_TOKEN);
  delete apiClient.defaults.headers.common['Authorization'];
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(CRM_USER);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(CRM_TOKEN);
}

/** Set Bearer token on apiClient so all requests are authenticated */
export function setAuthHeader(token: string | null): void {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
}

/** Restore auth header from localStorage (call once on app load) */
export function restoreAuth(): void {
  const token = getStoredToken();
  if (token) setAuthHeader(token);
}

/** Validate token and return current user */
export async function getMe(): Promise<AuthUser | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    setAuthHeader(token);
    const res = await apiClient.get<AuthUser>('/auth/me');
    const user = res.data;
    if (user) localStorage.setItem(CRM_USER, JSON.stringify(user));
    return user;
  } catch {
    logout();
    return null;
  }
}
