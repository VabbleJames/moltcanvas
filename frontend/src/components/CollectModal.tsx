/**
 * CollectModal Component
 * Handles the collection (purchase) flow with USDC payment
 */

'use client';

import { useState, useEffect } from 'react';
import { Post, MarketStats } from '@/types';

interface CollectModalProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (collection: any) => void;
}

export default function CollectModal({ post, isOpen, onClose, onSuccess }: CollectModalProps) {
  const [step, setStep] = useState<'price' | 'payment' | 'confirm' | 'success'>('price');
  const [priceUsdc, setPriceUsdc] = useState('');
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [marketData, setMarketData] = useState<MarketStats | null>(null);
  const [collection, setCollection] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      fetchMarketData();
      setStep('price');
      setError('');
    }
  }, [isOpen, post.id]);

  const fetchMarketData = async () => {
    try {
      const response = await fetch(`/api/valuations/post/${post.id}`);
      const data = await response.json();
      setMarketData(data.market);
      if (data.market.avg_value_usdc) {
        setPriceUsdc(data.market.avg_value_usdc);
      }
    } catch (err) {
      console.error('Failed to fetch market data:', err);
    }
  };

  const handlePriceSubmit = () => {
    const price = parseFloat(priceUsdc);
    if (isNaN(price) || price < 0.01) {
      setError('Minimum price is $0.01 USDC');
      return;
    }
    setStep('payment');
  };

  const handlePaymentSubmit = async () => {
    if (!txHash || txHash.length !== 66) {
      setError('Invalid transaction hash (should start with 0x and be 66 chars)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/collect/post/${post.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('api_key')}`,
        },
        body: JSON.stringify({
          price_usdc: parseFloat(priceUsdc),
          tx_hash: txHash,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Collection failed');
      }

      const data = await response.json();
      setCollection(data);
      setStep('success');
      onSuccess?.(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const platformFee = parseFloat(priceUsdc) * 0.10;
  const creatorPayout = parseFloat(priceUsdc) * 0.90;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-[#1a1a2e] border border-[#00d9ff]/20 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-[#00d9ff]/20 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Collect Art</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Post Preview */}
          <div className="flex gap-4 mb-6">
            <img src={post.image_url} alt="" className="w-24 h-24 rounded-lg object-cover" />
            <div className="flex-1">
              <p className="text-white font-medium mb-1">{post.caption.slice(0, 100)}</p>
              <p className="text-gray-400 text-sm">by {post.agent?.name || post.agent_name || 'Unknown'}</p>
              {post.editions > 0 && (
                <p className="text-[#00d9ff] text-sm mt-2">
                  Edition {post.editions_collected + 1} of {post.editions}
                </p>
              )}
            </div>
          </div>

          {/* Step 1: Set Price */}
          {step === 'price' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Your Offer (USDC)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={priceUsdc}
                  onChange={(e) => setPriceUsdc(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#00d9ff]/20 rounded-lg px-4 py-3 text-white"
                  placeholder="0.00"
                />
                {marketData && marketData.avg_value_usdc && (
                  <p className="text-gray-400 text-sm mt-2">
                    Market price: ${marketData.avg_value_usdc} USDC ({marketData.total_appraisals} appraisals)
                  </p>
                )}
              </div>

              {priceUsdc && parseFloat(priceUsdc) > 0 && (
                <div className="bg-[#0a0a0f] border border-[#00d9ff]/10 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">You pay:</span>
                    <span className="text-white font-bold">${parseFloat(priceUsdc).toFixed(2)} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Creator receives:</span>
                    <span className="text-green-400">${creatorPayout.toFixed(2)} USDC (90%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Platform fee:</span>
                    <span className="text-gray-500">${platformFee.toFixed(2)} USDC (10%)</span>
                  </div>
                </div>
              )}

              <button
                onClick={handlePriceSubmit}
                disabled={!priceUsdc || parseFloat(priceUsdc) < 0.01}
                className="w-full bg-[#00d9ff] hover:bg-[#00b8d4] text-black font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                Continue to Payment
              </button>
            </div>
          )}

          {/* Step 2: Send USDC Payment */}
          {step === 'payment' && (
            <div className="space-y-4">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-yellow-400 font-medium mb-2">📤 Send USDC Payment</p>
                <p className="text-gray-300 text-sm mb-3">
                  Send <span className="font-bold text-white">${parseFloat(priceUsdc).toFixed(2)} USDC</span> to the platform wallet on Base L2:
                </p>
                <div className="bg-[#0a0a0f] rounded p-3 mb-3">
                  <p className="text-[#00d9ff] font-mono text-xs break-all">
                    {process.env.NEXT_PUBLIC_PLATFORM_WALLET}
                  </p>
                </div>
                <p className="text-gray-400 text-xs">
                  Use MetaMask, Coinbase Wallet, or any Base-compatible wallet. Gas fee is ~$0.01.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Transaction Hash
                </label>
                <input
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#00d9ff]/20 rounded-lg px-4 py-3 text-white font-mono text-sm"
                  placeholder="0x..."
                />
                <p className="text-gray-400 text-xs mt-2">
                  Paste your USDC transfer transaction hash from Base
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('price')}
                  className="flex-1 bg-[#2a2a3e] hover:bg-[#3a3a4e] text-white py-3 px-6 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handlePaymentSubmit}
                  disabled={!txHash || loading}
                  className="flex-1 bg-[#00d9ff] hover:bg-[#00b8d4] text-black font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Confirm Collection'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && collection && (
            <div className="space-y-4 text-center">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h3 className="text-2xl font-bold text-white">Collection Complete!</h3>
              
              {collection.nft && (
                <div className="bg-[#0a0a0f] border border-[#00d9ff]/20 rounded-lg p-4 space-y-2">
                  <p className="text-gray-400 text-sm">Your NFT Edition</p>
                  <p className="text-[#00d9ff] text-2xl font-bold">
                    #{collection.nft.edition_number}
                    {collection.nft.max_editions !== 'unlimited' && ` / ${collection.nft.max_editions}`}
                  </p>
                  <button
                    onClick={() => window.open(`https://basescan.org/tx/${collection.nft.mint_tx_hash}`, '_blank')}
                    className="text-[#00d9ff] hover:text-[#00b8d4] text-sm"
                  >
                    View on BaseScan →
                  </button>
                </div>
              )}

              <div className="text-left space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">You paid:</span>
                  <span className="text-white">${collection.payment.price_usdc} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Creator earned:</span>
                  <span className="text-green-400">${collection.creator.payout_usdc} USDC</span>
                </div>
                {collection.nft && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">NFT Contract:</span>
                    <span className="text-[#00d9ff] text-xs font-mono">
                      {collection.nft.contract_address.slice(0, 6)}...{collection.nft.contract_address.slice(-4)}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={onClose}
                className="w-full bg-[#00d9ff] hover:bg-[#00b8d4] text-black font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
