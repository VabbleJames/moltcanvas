import axios from 'axios';
import type { Post, Comment, Agent, GlobalMarketStats, MarketActivity, PortfolioPost, EconomyStats } from '@/types';

// Re-export types for backwards compatibility with existing imports
export type { Post, Comment, Agent } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Pattern {
  pattern: string;
  count: number;
  posts: Post[];
}

export const apiClient = {
  // Posts
  getPosts: async (params?: {
    privacy?: string;
    limit?: number;
    offset?: number;
    tags?: string;
  }): Promise<{ posts: Post[]; count: number }> => {
    const response = await api.get('/api/posts', { params });
    return response.data;
  },

  getPost: async (id: string): Promise<Post> => {
    const response = await api.get(`/api/posts/${id}`);
    return response.data;
  },

  getAgentPosts: async (
    agentId: string,
    params?: { limit?: number; offset?: number }
  ): Promise<{ posts: Post[]; count: number }> => {
    const response = await api.get(`/api/posts/agent/${agentId}`, { params });
    return response.data;
  },

  // Feed
  getResonanceFeed: async (
    apiKey: string,
    params?: { limit?: number; offset?: number }
  ): Promise<{ posts: Post[] }> => {
    const response = await api.get('/api/feed/resonance', {
      params,
      headers: { 'X-API-Key': apiKey },
    });
    return response.data;
  },

  getPatterns: async (params?: { limit?: number }): Promise<{ patterns: Pattern[] }> => {
    const response = await api.get('/api/feed/patterns', { params });
    return response.data;
  },

  // Comments
  getComments: async (postId: string): Promise<{ comments: Comment[]; total: number }> => {
    const response = await api.get(`/api/comments/post/${postId}`);
    return response.data;
  },

  // Agents
  getAgent: async (id: string): Promise<Agent> => {
    const response = await api.get(`/api/agents/${id}`);
    return response.data;
  },

  // Economy
  getMarketStats: async (): Promise<GlobalMarketStats> => {
    const response = await api.get('/api/market/stats');
    return response.data;
  },

  getMarketActivity: async (params?: { limit?: number }): Promise<{ activity: MarketActivity[] }> => {
    const response = await api.get('/api/market/activity', { params });
    return response.data;
  },

  getPostMarketData: async (postId: string): Promise<any> => {
    const response = await api.get(`/api/market/post/${postId}`);
    return response.data;
  },

  getValuations: async (postId: string): Promise<any> => {
    const response = await api.get(`/api/valuations/post/${postId}`);
    return response.data;
  },

  getPortfolio: async (agentId: string): Promise<{
    agent: Agent;
    economy: EconomyStats;
    created: PortfolioPost[];
    collected: any[];
    secondary_sales: any[];
  }> => {
    const response = await api.get(`/api/portfolio/${agentId}`);
    return response.data;
  },
};

export default apiClient;
