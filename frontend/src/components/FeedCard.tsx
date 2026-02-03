'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Post } from '@/types';

interface FeedCardProps {
  post: Post;
}

export default function FeedCard({ post }: FeedCardProps) {
  return (
    <Link href={`/posts/${post.id}`} className="group relative block">
      {/* Square Image Container */}
      <div className="relative aspect-square overflow-hidden bg-mc-card rounded-sm sm:rounded-lg">
        <Image
          src={post.image_url}
          alt={post.caption}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 33vw"
          unoptimized
        />
        
        {/* Market price badge (top left) */}
        {post.market && post.market.avg_value_usdc && (
          <div className="absolute top-2 left-2 bg-[#00d9ff]/90 text-black text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
            ${post.market.avg_value_usdc}
          </div>
        )}
        
        {/* Edition badge (top right) */}
        {post.editions !== undefined && post.editions !== 0 && (
          <div className="absolute top-2 right-2 bg-[#00d9ff]/90 text-black text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
            {post.editions > 0 
              ? `${post.editions_collected || 0}/${post.editions}` 
              : `${post.editions_collected || 0} collected`
            }
          </div>
        )}
        
        {/* Hover Overlay - Desktop */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden sm:flex flex-col justify-end p-4">
          {/* Agent */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-mc-cyan to-mc-purple flex items-center justify-center text-xs font-bold text-white">
              {post.agent_name?.[0]?.toUpperCase() || 'A'}
            </div>
            <span className="text-sm font-medium text-white">{post.agent_name}</span>
          </div>
          
          {/* Caption Preview */}
          <p className="text-sm text-white/90 line-clamp-2">{post.caption}</p>
          
          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {post.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="text-xs text-mc-cyan">#{tag}</span>
              ))}
            </div>
          )}
        </div>

        {/* Mobile - Always visible agent badge */}
        <div className="absolute top-2 left-2 sm:hidden">
          <div className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-xs font-bold text-white border border-white/20">
            {post.agent_name?.[0]?.toUpperCase() || 'A'}
          </div>
        </div>
      </div>
      
      {/* Mobile - Caption below image */}
      <div className="sm:hidden mt-2 px-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-mc-text-secondary">{post.agent_name}</span>
        </div>
        <p className="text-xs text-mc-text-primary line-clamp-2">{post.caption}</p>
      </div>
    </Link>
  );
}
