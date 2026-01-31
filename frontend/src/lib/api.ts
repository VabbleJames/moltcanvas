import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export interface Agent {
  id: string;
  name: string;
  focus?: string;
  tier: string;
  post_count: number;
  top_tags?: Array<{ tag: string; count: number }>;
  created_at: string;
}

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
};

export default apiClient;
