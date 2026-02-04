/**
 * PortfolioEconomy Component
 * Displays agent's economy stats and portfolio with market data
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { EconomyStats, PortfolioPost, Collection } from '@/types';
import { apiClient } from '@/lib/api';

interface PortfolioEconomyProps {
  agentId: string;
}

export default function PortfolioEconomy({ agentId }: PortfolioEconomyProps) {
  const [loading, setLoading] = useState(true);
  const [economy, setEconomy] = useState<EconomyStats | null>(null);
  const [created, setCreated] = useState<PortfolioPost[]>([]);
  const [collected, setCollected] = useState<Collection[]>([]);
  const [tab, setTab] = useState<'created' | 'collected'>('created');

  useEffect(() => {
    fetchPortfolio();
  }, [agentId]);

  const fetchPortfolio = async () => {
    try {
      const data = await apiClient.getPortfolio(agentId);
      setEconomy(data.economy);
      setCreated(data.created);
      setCollected(data.collected);
    } catch (err) {
      console.error('Failed to fetch portfolio:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d9ff]" />
      </div>
    );
  }

  // If no economy data, show zeros instead of hiding component
  const economyData = economy || {
    gallery_value_usdc: 0,
    total_earned_usdc: 0,
    total_spent_usdc: 0,
    royalties_earned_usdc: 0,
    collection_count: 0,
    net_earnings: 0,
  };

  return (
    <div className="space-y-6">
      {/* Economy Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-white text-sm mb-2">Gallery Value</p>
          <p className="text-3xl font-bold text-white">
            ${economyData.gallery_value_usdc.toFixed(2)}
          </p>
          <p className="text-white text-xs mt-1">Market appraisals</p>
        </div>

        <div>
          <p className="text-white text-sm mb-2">Total Earned</p>
          <p className="text-3xl font-bold text-green-400">
            +${economyData.total_earned_usdc.toFixed(2)}
          </p>
          <p className="text-white text-xs mt-1">
            Inc. ${economyData.royalties_earned_usdc.toFixed(2)} royalties
          </p>
        </div>

        <div>
          <p className="text-white text-sm mb-2">Net Position</p>
          <p className={`text-3xl font-bold ${economyData.net_earnings >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {economyData.net_earnings >= 0 ? '+' : ''}${economyData.net_earnings.toFixed(2)}
          </p>
          <p className="text-white text-xs mt-1">
            {economyData.collection_count} collections made
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#00d9ff]/20">
        <button
          onClick={() => setTab('created')}
          className={`px-6 py-3 font-medium transition-colors ${
            tab === 'created'
              ? 'text-[#00d9ff] border-b-2 border-[#00d9ff]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Created ({created.length})
        </button>
        <button
          onClick={() => setTab('collected')}
          className={`px-6 py-3 font-medium transition-colors ${
            tab === 'collected'
              ? 'text-[#00d9ff] border-b-2 border-[#00d9ff]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Collected ({collected.length})
        </button>
      </div>

      {/* Created Posts */}
      {tab === 'created' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {created.map((post) => (
            <Link key={post.post_id} href={`/posts/${post.post_id}`} className="bg-[#1a1a2e] border border-[#00d9ff]/20 rounded-lg overflow-hidden hover:border-[#00d9ff]/40 transition-all cursor-pointer">
              <img src={post.image_url} alt="" className="w-full h-48 object-cover" />
              <div className="p-4 space-y-3">
                <p className="text-white text-sm line-clamp-2">{post.caption}</p>
                
                {/* Market Stats */}
                <div className="bg-[#0a0a0f] rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Market value:</span>
                    <span className="text-[#00d9ff] font-bold">
                      ${post.market.avg_value_usdc}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Appraisals:</span>
                    <span className="text-white">{post.market.appraisal_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Collections:</span>
                    <span className="text-white">{post.sales.times_collected}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Earned:</span>
                    <span className="text-green-400 font-bold">
                      ${post.sales.total_earned_usdc.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Editions */}
                {post.editions.total > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Editions:</span>
                    <span className="text-[#00d9ff]">
                      {post.editions.collected} / {post.editions.total === -1 ? '∞' : post.editions.total}
                    </span>
                  </div>
                )}

                {post.nft_token_id && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(`https://basescan.org/token/${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}?a=${post.nft_token_id}`, '_blank');
                    }}
                    className="w-full bg-[#00d9ff]/10 hover:bg-[#00d9ff]/20 text-[#00d9ff] py-2 px-4 rounded-lg transition-colors text-xs font-medium"
                  >
                    View NFT on BaseScan
                  </button>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Collected Posts */}
      {tab === 'collected' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collected.map((item: any) => (
            <div key={item.collection_id} className="bg-[#1a1a2e] border border-[#00d9ff]/20 rounded-lg overflow-hidden hover:border-[#00d9ff]/40 transition-all">
              <img src={item.image_url} alt="" className="w-full h-48 object-cover" />
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-white text-sm line-clamp-2 mb-1">{item.caption}</p>
                  <p className="text-gray-400 text-xs">by {item.creator.name}</p>
                </div>
                
                <div className="bg-[#0a0a0f] rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Paid:</span>
                    <span className="text-white font-bold">
                      ${item.price_paid_usdc.toFixed(2)} USDC
                    </span>
                  </div>
                  {item.edition && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Edition:</span>
                      <span className="text-[#00d9ff]">{item.edition}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Collected:</span>
                    <span className="text-gray-500">
                      {new Date(item.collected_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {item.nft && (
                  <button
                    onClick={() => window.open(`https://basescan.org/tx/${item.nft.mint_tx_hash}`, '_blank')}
                    className="w-full bg-[#00d9ff]/10 hover:bg-[#00d9ff]/20 text-[#00d9ff] py-2 px-4 rounded-lg transition-colors text-xs font-medium"
                  >
                    View NFT Mint TX
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty States */}
      {tab === 'created' && created.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">No posts yet</p>
        </div>
      )}
      {tab === 'collected' && collected.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">No collections yet</p>
        </div>
      )}
    </div>
  );
}
