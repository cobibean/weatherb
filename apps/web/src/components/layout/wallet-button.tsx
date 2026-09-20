'use client';
import { arcConnectOptions, appChain } from '@/lib/arc-wallet';

import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { User } from 'lucide-react';
import { createThirdwebClient } from 'thirdweb';
import { ConnectButton, darkTheme, lightTheme, useActiveAccount } from 'thirdweb/react';

// Client is created lazily to avoid build-time errors
const getClient = () => {
  if (!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID) {
    return null;
  }
  return createThirdwebClient({
    clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
  });
};

// Custom theme matching our design system
const customTheme = lightTheme({
  colors: {
    primaryButtonBg: '#FF9AB3',
    primaryButtonText: '#FFFFFF',
    connectedButtonBg: 'rgba(255, 255, 255, 0.1)',
    connectedButtonBgHover: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    accentText: '#FF9AB3',
    modalBg: '#F8FBFF',
    secondaryButtonBg: 'transparent',
    secondaryButtonText: '#374151',
  },
  fontFamily: 'var(--font-jakarta), system-ui, sans-serif',
});

export function WalletButton({
  afterglow = false,
}: { afterglow?: boolean } = {}): React.ReactElement {
  const client = getClient();

  if (!client) {
    return (
      <button
        disabled
        className="px-4 py-2 rounded-full bg-gray-200 text-gray-400 cursor-not-allowed text-sm font-medium"
      >
        Wallet Unavailable
      </button>
    );
  }

  return (
    <ConnectButton
      {...arcConnectOptions}
      client={client}
      chain={appChain}
      connectButton={{
        label: 'Log In',
        className: afterglow ? 'wb-wallet-login' : 'interactive-login-button',
      }}
      detailsButton={{
        style: {
          padding: '8px 16px',
          borderRadius: '9999px',
          fontWeight: 600,
          fontSize: '14px',
          fontFamily: 'var(--font-jakarta), system-ui, sans-serif',
          background: 'transparent',
          border: '1.5px solid rgba(55, 65, 81, 0.2)',
          color: afterglow ? '#f4f7fb' : '#374151',
        },
      }}
      theme={
        afterglow
          ? darkTheme({
              colors: {
                modalBg: '#0c2134',
                primaryButtonBg: '#2864ad',
                primaryButtonText: '#ffffff',
                accentText: '#c7e5f5',
              },
            })
          : customTheme
      }
      connectModal={{
        title: 'Welcome to weatherB',
        titleIcon: '',
        size: 'compact',
      }}
    />
  );
}

/**
 * Alternative wallet button using our InteractiveHoverButton
 * Use this when you need full control over the button appearance
 */
export function CustomWalletButton(): React.ReactElement {
  const account = useActiveAccount();
  const client = getClient();

  if (!client) {
    return (
      <button
        disabled
        className="px-4 py-2 rounded-full bg-gray-200 text-gray-400 cursor-not-allowed text-sm font-medium"
      >
        Wallet Unavailable
      </button>
    );
  }

  if (account) {
    // Show connected state with truncated address
    const truncatedAddress = `${account.address.slice(0, 6)}...${account.address.slice(-4)}`;
    return (
      <InteractiveHoverButton
        text={truncatedAddress}
        variant="outline"
        size="sm"
        icon={User}
        className="rounded-full"
      />
    );
  }

  // For disconnected state, we still need ConnectButton to handle the modal
  // But we wrap it to get our styling
  return (
    <ConnectButton
      {...arcConnectOptions}
      client={client}
      chain={appChain}
      connectButton={{
        label: 'Log In',
        className: 'interactive-login-button',
      }}
      theme={customTheme}
      connectModal={{
        title: 'Welcome to weatherB',
        titleIcon: '',
        size: 'compact',
      }}
    />
  );
}
