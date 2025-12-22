'use client';

import { ConnectButton, useActiveAccount } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { defineChain } from 'thirdweb/chains';
import { lightTheme } from 'thirdweb/react';
import { LogIn, User } from 'lucide-react';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';

// Define Flare chain manually since it may not be in the default exports
const flareChain = defineChain({
  id: 14,
  name: 'Flare',
  nativeCurrency: {
    name: 'Flare',
    symbol: 'FLR',
    decimals: 18,
  },
  blockExplorers: [
    {
      name: 'Flare Explorer',
      url: 'https://flare-explorer.flare.network',
    },
  ],
});

// Create client - in production, use NEXT_PUBLIC_THIRDWEB_CLIENT_ID env var
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || 'demo-client-id',
});

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

export function WalletButton() {
  return (
    <ConnectButton
      client={client}
      chain={flareChain}
      connectButton={{
        label: 'Log In',
        className: 'interactive-login-button',
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
          color: '#374151',
        },
      }}
      theme={customTheme}
      connectModal={{
        title: 'Welcome to WeatherB',
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
export function CustomWalletButton() {
  const account = useActiveAccount();
  
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
      client={client}
      chain={flareChain}
      connectButton={{
        label: 'Log In',
        className: 'interactive-login-button',
      }}
      theme={customTheme}
      connectModal={{
        title: 'Welcome to WeatherB',
        titleIcon: '',
        size: 'compact',
      }}
    />
  );
}
