'use client';

import { Post } from '@/types';

interface PostListProps {
  posts: Post[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const TOPIC_COLORS: Record<string, string> = {
  paid_ads: 'bg-red-900/50 text-red-300',
  content_organic: 'bg-green-900/50 text-green-300',
  lead_gen_funnels: 'bg-purple-900/50 text-purple-300',
  email_outreach: 'bg-blue-900/50 text-blue-300',
  ai_tools: 'bg-cyan-900/50 text-cyan-300',
  sales_offers: 'bg-yellow-900/50 text-yellow-300',
  tracking_analytics: 'bg-orange-900/50 text-orange-300',
  scaling_strategy: 'bg-pink-900/50 text-pink-300',
  hiring: 'bg-indigo-900/50 text-indigo-300',
  operations: 'bg-teal-900/50 text-teal-300',
  conversational: 'bg-gray-700/50 text-gray-300',
};

const ROLE_COLORS: Record<string, string> = {
  giver: 'text-green-400',
  seeker: 'text-blue-400',
  neutral: 'text-gray-400',
};

const STATUS_BADGES: Record<string, string> = {
  pending: 'bg-yellow-900/50 text-yellow-300',
  drafted: 'bg-blue-900/50 text-blue-300',
  replied: 'bg-green-900/50 text-green-300',
  skipped: 'bg-gray-700/50 text-gray-400',
};

export default function PostList({ posts, selectedId, onSelect }: PostListProps) {
  if (posts.length === 0) {
    return (
      <div className="text-gray-500 text-center py-12">
        No posts found. Try scraping or adjusting filters.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {posts.map(post => (
        <div
          key={post.id}
          onClick={() => onSelect(post.id)}
          className={`bg-[#1a1d27] rounded-lg p-4 cursor-pointer border transition-colors ${
            selectedId === post.id
              ? 'border-[#6c8cff]'
              : 'border-transparent hover:border-gray-600'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-medium truncate">{post.title || '(no title)'}</h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                <span>{post.authorName}</span>
                <span>·</span>
                <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                <span>·</span>
                <span>{post.commentCount} comments</span>
                <span>·</span>
                <span>{post.upvotes} upvotes</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {post.topic && (
                <span className={`px-2 py-0.5 rounded text-xs ${TOPIC_COLORS[post.topic] || 'bg-gray-700 text-gray-300'}`}>
                  {post.topic.replace(/_/g, ' ')}
                </span>
              )}
              {post.role && (
                <span className={`text-xs ${ROLE_COLORS[post.role] || 'text-gray-400'}`}>
                  {post.role}
                </span>
              )}
              <span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGES[post.replyStatus] || ''}`}>
                {post.replyStatus}
              </span>
            </div>
          </div>
          {post.suggestedRepliers && post.suggestedRepliers.length > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              Assigned: {post.suggestedRepliers.join(', ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
