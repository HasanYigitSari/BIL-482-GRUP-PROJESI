import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';

import { api, ApiError } from './api';

export type User = { id: number; username: string };
type AccountResponse = { user: User };
type Ceremony<T> = { ceremony_id: string; options: T };

export function passkeysAvailable(): boolean {
  return window.isSecureContext && browserSupportsWebAuthn();
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) {
    if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
      return 'The passkey prompt was cancelled or timed out. You can try again.';
    }
    if (error.name === 'InvalidStateError') {
      return 'This passkey already exists. Try signing in or choose another passkey.';
    }
    if (error.name === 'NotSupportedError') return 'Your device could not create this passkey. Try another passkey provider or a security key.';
    if (error.name === 'SecurityError') return 'Passkeys are unavailable at this address. Open http://localhost:5173.';
  }
  return 'The passkey request could not be completed. Please try again.';
}

export async function currentUser(): Promise<User | null> {
  try {
    return (await api<AccountResponse>('auth/me/')).user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function signup(username: string): Promise<User> {
  const pending = await api<Ceremony<PublicKeyCredentialCreationOptionsJSON>>('auth/signup/begin/', { username });
  const credential = await startRegistration({ optionsJSON: pending.options });
  return (await api<AccountResponse>('auth/signup/complete/', { ceremony_id: pending.ceremony_id, credential })).user;
}

export async function signin(): Promise<User> {
  const pending = await api<Ceremony<PublicKeyCredentialRequestOptionsJSON>>('auth/signin/begin/', {});
  const credential = await startAuthentication({ optionsJSON: pending.options });
  return (await api<AccountResponse>('auth/signin/complete/', { ceremony_id: pending.ceremony_id, credential })).user;
}

export async function signout(): Promise<void> {
  await api<void>('auth/logout/', {});
}
