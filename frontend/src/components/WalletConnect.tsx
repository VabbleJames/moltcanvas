/**
 * WalletConnect Component
 * Handles Base wallet connection and registration
 */

'use client';

import { useState, useEffect } from 'react';
import { useSDK } from '@metamask/sdk-react';

interface WalletConnectProps {
  onConnected?: (address: string) => void;
}

export default function WalletConnect({ onConnected }: WalletConnectProps) {
  const { sdk, connected, connecting, account } = useSDK();
  const [registering, setRegistering] = useState(false);
  const [wallet, setWallet] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (connected && account) {
      fetchWalletInfo();
    }
  }, [connected, account]);

  const fetchWalletInfo = async () => {
    try {
      const response = await fetch('/api/wallet/me', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('api_key')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setWallet(data.wallet);
      }
    } catch (err) {
      // Wallet not registered yet
    }
  };

  const connectWallet = async () => {
    try {
      await sdk?.connect();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const registerWallet = async () => {
    if (!account) return;
    
    setRegistering(true);
    setError('');
    
    try {
      const response = await fetch('/api/wallet/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('api_key')}`,
        },
        body: JSON.stringify({ wallet_address: account }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      const data = await response.json();
      setWallet(data.wallet);
      onConnected?.(account);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRegistering(false);
    }
  };

  if (!connected) {
    return (
      <div className="bg-[#1a1a2e] border border-[#00d9ff]/20 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-2">Connect Base Wallet</h3>
        <p className="text-gray-400 mb-4">
          Connect your Base wallet to collect art and earn USDC
        </p>
        <button
          onClick={connectWallet}
          disabled={connecting}
          className="w-full bg-[#00d9ff] hover:bg-[#00b8d4] text-black font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
        >
          {connecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
        {error && (
          <p className="text-red-400 text-sm mt-2">{error}</p>
        )}
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="bg-[#1a1a2e] border border-[#00d9ff]/20 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-2">Register Wallet</h3>
        <p className="text-gray-400 mb-2">Connected: {account?.slice(0, 6)}...{account?.slice(-4)}</p>
        <p className="text-gray-300 mb-4">
          Register your wallet to start collecting
        </p>
        <button
          onClick={registerWallet}
          disabled={registering}
          className="w-full bg-[#00d9ff] hover:bg-[#00b8d4] text-black font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
        >
          {registering ? 'Registering...' : 'Register Wallet'}
        </button>
        {error && (
          <p className="text-red-400 text-sm mt-2">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a2e] border border-[#00d9ff]/20 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white">Wallet Connected</h3>
        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Address:</span>
          <span className="text-white font-mono">
            {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">USDC Balance:</span>
          <span className="text-[#00d9ff] font-bold">
            ${wallet.usdc_balance.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Network:</span>
          <span className="text-white">Base L2</span>
        </div>
      </div>

      <button
        onClick={() => window.open(`https://basescan.org/address/${wallet.address}`, '_blank')}
        className="w-full mt-4 bg-[#2a2a3e] hover:bg-[#3a3a4e] text-white py-2 px-4 rounded-lg transition-colors text-sm"
      >
        View on BaseScan →
      </button>
    </div>
  );
}
