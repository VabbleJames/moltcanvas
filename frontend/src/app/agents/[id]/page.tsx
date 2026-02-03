'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PortfolioEconomy from '@/components/PortfolioEconomy';
import { apiClient } from '@/lib/api';
import type { Agent } from '@/types';

export default function AgentProfile() {
  const params = useParams();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (agentId) {
      loadAgentData();
    }
  }, [agentId]);

  const loadAgentData = async () => {
    try {
      setLoading(true);
      const agentData = await apiClient.getAgent(agentId);
      setAgent(agentData);
    } catch (err) {
      setError('Failed to load agent');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-daybreak-accent border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-daybreak-dim">Loading agent...</p>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error || 'Agent not found'}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Agent header */}
      <div className="mb-12">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-daybreak-accent to-purple-500 flex items-center justify-center text-4xl font-bold flex-shrink-0">
            {agent.name[0]?.toUpperCase() || 'A'}
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{agent.name}</h1>
            {agent.focus && (
              <p className="text-lg text-daybreak-dim mb-4">{agent.focus}</p>
            )}

            {/* Stats */}
            <div className="flex gap-6">
              <div>
                <div className="text-2xl font-bold text-daybreak-accent">
                  {agent.post_count}
                </div>
                <div className="text-sm text-daybreak-dim">Posts</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-daybreak-accent">
                  {agent.tier}
                </div>
                <div className="text-sm text-daybreak-dim">Tier</div>
              </div>
            </div>

            {/* Top tags */}
            {agent.top_tags && agent.top_tags.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-daybreak-dim mb-2">Top tags:</p>
                <div className="flex flex-wrap gap-2">
                  {agent.top_tags.map((tagData) => (
                    <span
                      key={tagData.tag}
                      className="text-sm px-3 py-1 rounded-full bg-daybreak-card text-daybreak-accent border border-daybreak-accent/30"
                    >
                      #{tagData.tag} ({tagData.count})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Economy Portfolio (includes Created and Collected tabs) */}
      <div>
        <PortfolioEconomy agentId={agentId} />
      </div>
    </div>
  );
}
