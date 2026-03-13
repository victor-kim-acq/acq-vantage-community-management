'use client';

import { useState, useEffect } from 'react';
import { Post, Comment, Draft } from '@/types';

interface PostDetailProps {
  postId: string;
  onStatusChange: () => void;
}

export default function PostDetail({ postId, onStatusChange }: PostDetailProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [generating, setGenerating] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [editedDraft, setEditedDraft] = useState<Record<number, string>>({});
  const [draftView, setDraftView] = useState<'short' | 'long'>('short');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/posts?postId=${postId}`)
      .then(res => res.json())
      .then(data => {
        setPost(data.post);
        setComments(data.comments || []);
        setDrafts(data.drafts || []);
      })
      .catch(console.error);
  }, [postId]);

  const generateDraft = async () => {
    setGenerating(true);
    setDraftError(null);
    try {
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setDraftError(data.error || `Request failed (${res.status})`);
        return;
      }
      if (data.drafts) {
        setDrafts(prev => [...data.drafts, ...prev]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate draft';
      setDraftError(message.includes('timeout') || message.includes('aborted')
        ? 'Request timed out — this post may have too many comments. Try again.'
        : message);
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (status: string) => {
    try {
      await fetch('/api/posts/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, status }),
      });
      setPost(prev => prev ? { ...prev, replyStatus: status as Post['replyStatus'] } : null);
      onStatusChange();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!post) {
    return <div className="text-gray-500 p-4">Loading...</div>;
  }

  const currentDraft = drafts.find(d => d.draftType === draftView) || drafts[0];
  const hasShort = drafts.some(d => d.draftType === 'short');
  const hasLong = drafts.some(d => d.draftType === 'long');

  return (
    <div className="bg-[#1a1d27] rounded-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{post.title || '(no title)'}</h2>
          <div className="text-sm text-gray-400 mt-1">
            By {post.authorName} · {new Date(post.createdAt).toLocaleDateString()}
            {post.topic && (
              <span className="ml-2 px-2 py-0.5 bg-[#2a2d37] rounded text-xs">
                {post.topic.replace(/_/g, ' ')}
              </span>
            )}
            {post.role && (
              <span className="ml-2 text-xs text-gray-500">{post.role}</span>
            )}
          </div>
        </div>
        <a
          href={post.skoolUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#6c8cff] text-sm hover:underline shrink-0"
        >
          View on Skool
        </a>
      </div>

      {/* Post content */}
      <div className="text-gray-300 text-sm whitespace-pre-wrap border-l-2 border-gray-700 pl-4">
        {post.content}
      </div>

      {/* Comments */}
      {comments.length > 0 && (
        <div>
          <h3 className="text-white font-medium mb-3">
            Comments ({comments.length})
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {comments.map(comment => (
              <div key={comment.id} className="bg-[#0f1117] rounded p-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-medium">{comment.authorName}</span>
                  <span className="text-gray-500 text-xs">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                  {comment.upvotes > 0 && (
                    <span className="text-gray-500 text-xs">{comment.upvotes} upvotes</span>
                  )}
                </div>
                <div className="text-gray-400 whitespace-pre-wrap">{comment.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Draft area */}
      <div className="border-t border-gray-700 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-medium">Draft Reply</h3>
          <div className="flex items-center gap-2">
            {post.voiceProfile && (
              <span className="text-xs text-gray-500">
                Voice Profile {post.voiceProfile}
              </span>
            )}
            <button
              onClick={generateDraft}
              disabled={generating}
              className="bg-[#6c8cff] hover:bg-[#5a7af0] disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm"
            >
              {generating ? 'Generating...' : 'Generate Draft'}
            </button>
          </div>
        </div>

        {drafts.length > 0 && (
          <>
            {/* Draft type toggle */}
            {hasShort && hasLong && (
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setDraftView('short')}
                  className={`px-3 py-1 rounded text-sm ${
                    draftView === 'short'
                      ? 'bg-[#6c8cff] text-white'
                      : 'bg-[#2a2d37] text-gray-400 hover:text-white'
                  }`}
                >
                  Short
                </button>
                <button
                  onClick={() => setDraftView('long')}
                  className={`px-3 py-1 rounded text-sm ${
                    draftView === 'long'
                      ? 'bg-[#6c8cff] text-white'
                      : 'bg-[#2a2d37] text-gray-400 hover:text-white'
                  }`}
                >
                  Long
                </button>
              </div>
            )}

            {currentDraft && (
              <div className="space-y-3">
                <textarea
                  value={editedDraft[currentDraft.id] ?? currentDraft.content}
                  onChange={e =>
                    setEditedDraft(prev => ({
                      ...prev,
                      [currentDraft.id]: e.target.value,
                    }))
                  }
                  className="w-full bg-[#0f1117] text-gray-300 border border-gray-700 rounded p-3 text-sm min-h-[150px] resize-y"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      copyToClipboard(
                        editedDraft[currentDraft.id] ?? currentDraft.content
                      )
                    }
                    className="bg-[#2a2d37] hover:bg-[#3a3d47] text-white px-3 py-1.5 rounded text-sm"
                  >
                    {copied ? 'Copied!' : 'Copy to Clipboard'}
                  </button>
                  <button
                    onClick={() => updateStatus('replied')}
                    className="bg-green-900/50 hover:bg-green-800/50 text-green-300 px-3 py-1.5 rounded text-sm"
                  >
                    Mark as Replied
                  </button>
                  <button
                    onClick={() => updateStatus('skipped')}
                    className="bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 px-3 py-1.5 rounded text-sm"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {draftError && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded p-3 text-sm mb-3">
            <span className="font-medium">Draft generation failed:</span> {draftError}
          </div>
        )}

        {drafts.length === 0 && !generating && !draftError && (
          <div className="text-gray-500 text-sm">
            No drafts yet. Click &quot;Generate Draft&quot; to create one.
          </div>
        )}
      </div>
    </div>
  );
}
