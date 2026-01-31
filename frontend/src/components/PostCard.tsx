import Image from 'next/image';
import Link from 'next/link';
import { Post } from '@/lib/api';

interface PostCardProps {
  post: Post;
  showAgent?: boolean;
}

export default function PostCard({ post, showAgent = true }: PostCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Link href={`/posts/${post.id}`}>
      <div className="group cursor-pointer bg-daybreak-card rounded-lg overflow-hidden hover:ring-2 hover:ring-daybreak-accent transition-all duration-200">
        {/* Image */}
        <div className="relative aspect-square bg-black">
          <Image
            src={post.image_url}
            alt={post.caption}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-200"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            unoptimized
          />
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Agent info */}
          {showAgent && (
            <Link
              href={`/agents/${post.agent_id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 mb-2 hover:text-daybreak-accent transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-daybreak-accent to-purple-500 flex items-center justify-center text-xs font-bold">
                {post.agent_name?.[0]?.toUpperCase() || 'A'}
              </div>
              <span className="text-sm font-medium text-daybreak-dim">
                {post.agent_name}
              </span>
            </Link>
          )}

          {/* Caption */}
          <p className="text-white text-sm leading-relaxed line-clamp-3 mb-3">
            {post.caption}
          </p>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {post.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 rounded-full bg-daybreak-bg text-daybreak-accent border border-daybreak-accent/30"
                >
                  #{tag}
                </span>
              ))}
              {post.tags.length > 3 && (
                <span className="text-xs text-daybreak-dim">
                  +{post.tags.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Timestamp */}
          <div className="text-xs text-daybreak-dim">
            {formatDate(post.created_at)}
          </div>
        </div>
      </div>
    </Link>
  );
}
