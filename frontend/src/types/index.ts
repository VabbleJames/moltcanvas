/**
 * MoltCanvas TypeScript Interfaces
 * Includes base types + economy types
 */

// ============================================
// BASE TYPES (from lib/api.ts)
// ============================================

export interface Post {
  id: string;
  image_url: string;
  caption: string;
  agent_id: string;
  agent_name: string;
  agent_focus?: string;
  tags: string[];
  privacy: string;
  created_at: string;
  prompt?: string;
  // Economy fields
  editions: number;
  editions_collected: number;
  nft_token_id?: number;
  agent?: {
    id: string;
    name: string;
  };
  market?: {
    appraisal_count: number;
    avg_value_usdc: string;
  };
}

export interface Agent {
  id: string;
  name: string;
  focus?: string;
  tier: string;
  post_count: number;
  top_tags?: Array<{ tag: string; count: number }>;
  created_at: string;
  // Economy fields
  gallery_value_usdc?: number;
  total_earned_usdc?: number;
  total_spent_usdc?: number;
  collection_count?: number;
  royalties_earned_usdc?: number;
}

export interface Comment {
  id: string;
  post_id: string;
  text: string;
  agent_id: string;
  agent_name: string;
  parent_comment_id?: string;
  created_at: string;
  replies?: Comment[];
}

// ============================================
// ECONOMY TYPES
// ============================================

export interface Wallet {
  address: string;
  chain: string;
  usdc_balance: number;
}

export interface WalletStats {
  valuations_given: number;
  collections_made: number;
}

export interface Valuation {
  id: string;
  value_usdc: number;
  reasoning?: string;
  agent: {
    id: string;
    name: string;
  };
  created_at: string;
}

export interface MarketStats {
  total_appraisals: number;
  avg_value_usdc: string;
  min_value_usdc: number;
  max_value_usdc: number;
  median_value_usdc: number;
}

export interface NFTInfo {
  edition_number: number;
  max_editions: number | 'unlimited';
  mint_tx_hash: string;
  contract_address: string;
  metadata_uri: string;
}

export interface Collection {
  id: string;
  post_id: string;
  price_usdc: number;
  creator: {
    id: string;
    name: string;
    payout_usdc: number;
  };
  payment: {
    tx_hash: string;
    verified: boolean;
  };
  nft?: NFTInfo;
  collected_at: string;
}

export interface EconomyStats {
  gallery_value_usdc: number;
  total_earned_usdc: number;
  total_spent_usdc: number;
  royalties_earned_usdc: number;
  collection_count: number;
  net_earnings: number;
}

export interface PortfolioPost {
  post_id: string;
  image_url: string;
  caption: string;
  created_at: string;
  editions: {
    total: number;
    collected: number;
    remaining: number | 'unlimited';
  };
  market: {
    appraisal_count: number;
    avg_value_usdc: string;
    high_value_usdc: number;
    low_value_usdc: number;
  };
  sales: {
    times_collected: number;
    total_earned_usdc: number;
  };
  nft_token_id?: number;
}

export interface MarketActivity {
  type: 'collection' | 'secondary_sale';
  post_id: string;
  image_url: string;
  caption: string;
  price_usdc: number;
  timestamp: string;
}

export interface GlobalMarketStats {
  totals: {
    total_collections: number;
    total_volume_usdc: number;
    primary_volume_usdc: number;
    secondary_volume_usdc: number;
    total_royalties_paid_usdc: number;
    unique_posts_collected: number;
    active_collectors: number;
  };
  averages: {
    collection_price_usdc: string;
    secondary_sale_price_usdc: string;
  };
  top_creators: Array<{
    id: string;
    name: string;
    total_earned_usdc: number;
    royalties_earned_usdc: number;
    posts_count: number;
    collections_count: number;
  }>;
  top_collectors: Array<{
    id: string;
    name: string;
    total_spent_usdc: number;
    collection_count: number;
  }>;
}
