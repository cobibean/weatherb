'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useActiveAccount, ConnectButton } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { Shield, LogIn, AlertCircle, Loader2 } from 'lucide-react';

// Lazy client creation to avoid build-time errors
const getClient = () => {
  if (!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID) {
    return null;
  }
  return createThirdwebClient({
    clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
  });
};

type AuthState = 'idle' | 'requesting' | 'signing' | 'verifying' | 'success' | 'error';

export function LoginForm(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const account = useActiveAccount();
  const client = getClient();
  
  const [authState, setAuthState] = useState<AuthState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const redirectTo = searchParams.get('redirect') || '/admin';

  // Handle missing client configuration
  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-light via-cloud-off to-sunset-pink/20 p-4">
        <div className="card-hero text-center">
          <Shield className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
          <h1 className="font-display text-xl font-bold text-neutral-800 mb-2">
            Configuration Required
          </h1>
          <p className="font-body text-neutral-600">
            Wallet connection is not configured. Please contact the administrator.
          </p>
        </div>
      </div>
    );
  }

  // Reset state when account changes
  useEffect(() => {
    setAuthState('idle');
    setError(null);
    setMessage(null);
  }, [account?.address]);

  const handleLogin = async (): Promise<void> => {
    if (!account) {
      setError('Please connect your wallet first');
      return;
    }

    setAuthState('requesting');
    setError(null);

    try {
      // Step 1: Request a session with nonce
      const initRes = await fetch('/admin/api/auth/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: account.address }),
      });

      if (!initRes.ok) {
        const data = await initRes.json();
        throw new Error(data.error || 'Failed to initialize session');
      }

      const { nonce, sessionId } = await initRes.json();
      const signMessage = `Sign this message to authenticate as WeatherB admin.\n\nNonce: ${nonce}`;
      
      setMessage(signMessage);
      setAuthState('signing');

      // Step 2: Sign the message
      const signature = await account.signMessage({ message: signMessage });

      setAuthState('verifying');

      // Step 3: Verify the signature
      const verifyRes = await fetch('/admin/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          signature,
          wallet: account.address,
        }),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error || 'Failed to verify signature');
      }

      setAuthState('success');
      
      // Redirect after short delay for UX
      setTimeout(() => {
        router.push(redirectTo);
        router.refresh();
      }, 500);
    } catch (err) {
      setAuthState('error');
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  const getStatusMessage = (): string => {
    switch (authState) {
      case 'requesting':
        return 'Initializing session...';
      case 'signing':
        return 'Please sign the message in your wallet...';
      case 'verifying':
        return 'Verifying signature...';
      case 'success':
        return 'Authenticated! Redirecting...';
      default:
        return '';
    }
  };

  const isLoading = ['requesting', 'signing', 'verifying'].includes(authState);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-light via-cloud-off to-sunset-pink/20 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="card-hero text-center">
          {/* Logo / Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-medium to-sky-deep flex items-center justify-center mb-6">
            <Shield className="w-8 h-8 text-white" />
          </div>

          <h1 className="font-display text-2xl font-bold text-neutral-800 mb-2">
            Admin Access
          </h1>
          <p className="font-body text-neutral-600 mb-8">
            Connect your authorized wallet to access the admin panel.
          </p>

          {/* Wallet Connection */}
          {!account ? (
            <div className="flex justify-center mb-6">
              <ConnectButton
                client={client}
                connectButton={{
                  label: 'Connect Wallet',
                  className: 'btn-primary',
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Connected wallet display */}
              <div className="p-4 rounded-xl bg-cloud-soft border border-neutral-200">
                <p className="font-body text-sm text-neutral-500 mb-1">Connected as</p>
                <p className="font-mono text-sm text-neutral-800 truncate">
                  {account.address}
                </p>
              </div>

              {/* Login button */}
              <button
                onClick={handleLogin}
                disabled={isLoading || authState === 'success'}
                className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : authState === 'success' ? (
                  <Shield className="w-5 h-5" />
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
                {authState === 'success' ? 'Authenticated!' : 'Sign in to Admin'}
              </button>

              {/* Status message */}
              {isLoading && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-body text-sm text-sky-deep text-center"
                >
                  {getStatusMessage()}
                </motion.p>
              )}
            </div>
          )}

          {/* Error display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 rounded-xl bg-error-soft/30 border border-error-soft flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-error-soft flex-shrink-0 mt-0.5" />
              <p className="font-body text-sm text-neutral-800 text-left">{error}</p>
            </motion.div>
          )}

          {/* Info */}
          <p className="mt-8 font-body text-xs text-neutral-400">
            Only allowlisted wallet addresses can access the admin panel.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

