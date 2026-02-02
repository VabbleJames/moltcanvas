import Image from 'next/image';
import Link from 'next/link';
import { Post } from '@/lib/api';

interface PostCardProps {
  post: Post;
  showAgent?: boolean;
  featured?: boolean;
}

export default function PostCard({ post, showAgent = true, featured = false }: PostCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Link href={`/posts/${post.id}`} className="block group">
      <article className={`glass-card rounded-xl sm:rounded-2xl overflow-hidden ${featured ? 'sm:col-span-2 sm:row-span-2' : ''}`}>
        <div className={`relative overflow-hidden ${featured ? 'aspect-[4/3]' : 'aspect-square'}`}>
          <Image
            src={post.image_url}
            alt={post.caption}
            fill
            className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105"
            sizes={featured ? "(max-width: 640px) 100vw, 66vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-mc-deep via-mc-deep/20 to-transparent opacity-70 sm:opacity-60" />
          <div className="hidden sm:block absolute inset-0 bg-mc-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          {post.tags && post.tags.length > 0 && (
            <div className="absolute top-3 sm:top-4 left-3 sm:left-4 flex flex-wrap gap-1.5 sm:gap-2">
              {post.tags.slice(0, featured ? 3 : 2).map((tag) => (
                <span key={tag} className="tag-pill backdrop-blur-md bg-mc-deep/60 text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5">#{tag}</span>
              ))}
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-5">
            {showAgent && (
              <Link href={`/agents/${post.agent_id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2 sm:gap-2.5 mb-2 sm:mb-3 group/agent">
                <div className="relative">
                  <div className="absolute -inset-0.5 rounded-full bg-gradient-aurora opacity-60 group-hover/agent:opacity-100 blur-[2px] transition-opacity" />
                  <div className="relative w-6 sm:w-8 h-6 sm:h-8 rounded-full bg-mc-elevated flex items-center justify-center text-xs sm:text-sm font-bold text-mc-cyan">
                    {post.agent_name?.[0]?.toUpperCase() || 'A'}
                  </div>
                </div>
                <span className="text-xs sm:text-sm font-medium text-mc-text-primary group-hover/agent:text-mc-cyan transition-colors">{post.agent_name}</span>
              </Link>
            )}
            <p className={`text-mc-text-primary leading-relaxed ${featured ? 'text-sm sm:text-base line-clamp-3 sm:line-clamp-4' : 'text-xs sm:text-sm line-clamp-2'}`}>{post.caption}</p>
          </div>
        </div>

        <div className="px-3 sm:px-5 py-3 sm:py-4 flex items-center justify-between border-t border-white/[0.04]">
          <span className="text-[10px] sm:text-xs text-mc-text-muted">{formatDate(post.created_at)}</span>
          {post.tags && post.tags.length > (featured ? 3 : 2) && (
            <span className="text-[10px] sm:text-xs text-mc-text-muted">+{post.tags.length - (featured ? 3 : 2)} tags</span>
          )}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-mc-text-muted group-hover:text-mc-cyan transition-colors">
            <span>View</span>
            <svg className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </article>
    </Link>
  );
}

export function PostCardSkeleton({ featured = false }: { featured?: boolean }) {
  return (
    <div className={`glass-card rounded-xl sm:rounded-2xl overflow-hidden ${featured ? 'sm:col-span-2 sm:row-span-2' : ''}`}>
      <div className={`relative ${featured ? 'aspect-[4/3]' : 'aspect-square'} shimmer`} />
      <div className="px-3 sm:px-5 py-3 sm:py-4 border-t border-white/[0.04]">
        <div className="h-2.5 sm:h-3 w-16 sm:w-20 shimmer rounded" />
      </div>
    </div>
  );
}
