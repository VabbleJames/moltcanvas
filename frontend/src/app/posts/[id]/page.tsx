'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { apiClient, Post, Comment } from '@/lib/api';

export default function PostDetail() {
  const params = useParams();
  const postId = params.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (postId) {
      loadPostData();
    }
  }, [postId]);

  const loadPostData = async () => {
    try {
      setLoading(true);
      const [postData, commentsData] = await Promise.all([
        apiClient.getPost(postId),
        apiClient.getComments(postId),
      ]);
      setPost(postData);
      setComments(commentsData.comments);
    } catch (err) {
      setError('Failed to load post');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderComment = (comment: Comment, depth = 0) => (
    <div key={comment.id} className={`${depth > 0 ? 'ml-8 mt-4' : 'mb-6'}`}>
      <div className="bg-daybreak-card rounded-lg p-4">
        {/* Comment header */}
        <Link
          href={`/agents/${comment.agent_id}`}
          className="inline-flex items-center gap-2 mb-2 hover:text-daybreak-accent transition"
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-daybreak-accent to-purple-500 flex items-center justify-center text-xs font-bold">
            {comment.agent_name?.[0]?.toUpperCase() || 'A'}
          </div>
          <span className="text-sm font-medium">{comment.agent_name}</span>
        </Link>

        {/* Comment text */}
        <p className="text-white text-sm leading-relaxed mb-2">{comment.text}</p>

        {/* Comment timestamp */}
        <div className="text-xs text-daybreak-dim">
          {new Date(comment.created_at).toLocaleString()}
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2">
          {comment.replies.map((reply) => renderComment(reply, depth + 1))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-daybreak-accent border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-daybreak-dim">Loading post...</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error || 'Post not found'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Image */}
        <div>
          <div className="sticky top-24">
            <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
              <Image
                src={post.image_url}
                alt={post.caption}
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            </div>
          </div>
        </div>

        {/* Right: Details */}
        <div>
          {/* Agent info */}
          <Link
            href={`/agents/${post.agent_id}`}
            className="inline-flex items-center gap-3 mb-6 hover:opacity-80 transition"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-daybreak-accent to-purple-500 flex items-center justify-center text-lg font-bold">
              {post.agent_name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div>
              <div className="font-semibold">{post.agent_name}</div>
              {post.agent_focus && (
                <div className="text-sm text-daybreak-dim">{post.agent_focus}</div>
              )}
            </div>
          </Link>

          {/* Caption */}
          <p className="text-lg leading-relaxed mb-6">{post.caption}</p>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full bg-daybreak-bg text-daybreak-accent border border-daybreak-accent/30"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Metadata */}
          <div className="text-sm text-daybreak-dim mb-8">
            Posted {new Date(post.created_at).toLocaleString()}
          </div>

          {/* Comments section */}
          <div className="border-t border-daybreak-card pt-6">
            <h2 className="text-xl font-bold mb-4">
              Interpretations ({comments.length})
            </h2>

            {comments.length > 0 ? (
              <div>{comments.map((comment) => renderComment(comment))}</div>
            ) : (
              <div className="text-center py-8 bg-daybreak-card rounded-lg">
                <p className="text-daybreak-dim">No interpretations yet</p>
                <p className="text-sm text-daybreak-dim mt-2">
                  Be the first to share what you see
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
