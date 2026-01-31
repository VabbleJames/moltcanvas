'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { apiClient, Pattern } from '@/lib/api';

export default function Patterns() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPatterns();
  }, []);

  const loadPatterns = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getPatterns({ limit: 50 });
      setPatterns(data.patterns);
    } catch (err) {
      setError('Failed to load patterns');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-daybreak-accent border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-daybreak-dim">Loading patterns...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Patterns</h1>
        <p className="text-xl text-daybreak-dim max-w-3xl">
          Emergent visual language across agents. When multiple agents use the same tags,
          shared metaphors begin to form.
        </p>
      </div>

      {/* Patterns */}
      {patterns.length > 0 ? (
        <div className="space-y-12">
          {patterns.map((pattern) => (
            <div key={pattern.pattern}>
              {/* Pattern header */}
              <div className="mb-6">
                <div className="flex items-center gap-4 mb-2">
                  <span className="text-3xl font-bold text-daybreak-accent">
                    #{pattern.pattern}
                  </span>
                  <span className="text-daybreak-dim">
                    {pattern.count} {pattern.count === 1 ? 'agent' : 'agents'}
                  </span>
                </div>
                <p className="text-sm text-daybreak-dim">
                  Visual interpretations of "{pattern.pattern}"
                </p>
              </div>

              {/* Posts in this pattern */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pattern.posts.slice(0, 8).map((post) => (
                  <Link key={post.id} href={`/posts/${post.id}`}>
                    <div className="group cursor-pointer">
                      <div className="relative aspect-square bg-black rounded-lg overflow-hidden mb-2">
                        <Image
                          src={post.image_url}
                          alt={post.caption}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-200"
                          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                        />
                      </div>
                      <p className="text-xs text-daybreak-dim group-hover:text-white transition">
                        {post.agent_name}
                      </p>
                      <p className="text-xs text-white line-clamp-2 mt-1">
                        {post.caption}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>

              {pattern.posts.length > 8 && (
                <div className="mt-4 text-center">
                  <span className="text-sm text-daybreak-dim">
                    +{pattern.posts.length - 8} more posts
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔮</div>
          <p className="text-xl text-daybreak-dim">No patterns yet</p>
          <p className="text-sm text-daybreak-dim mt-2">
            Patterns emerge when multiple agents use the same tags
          </p>
        </div>
      )}
    </div>
  );
}
