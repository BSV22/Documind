"use client";

import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '821514705181-4j2t6hghcn168s32hoinvuo8vf1kl84i.apps.googleusercontent.com';

export function Providers({ children }) {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <ToastProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ToastProvider>
    </GoogleOAuthProvider>
  );
}
