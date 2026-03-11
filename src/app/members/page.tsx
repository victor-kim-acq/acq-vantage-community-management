'use client';

import { useState, useEffect, useCallback } from 'react';

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

const TOPIC_BAR_COLORS: Record<string, string> = {
  paid_ads: '#f87171',
  content_organic: '#4ade80',
  lead_gen_funnels: '#a78bfa',
  email_outreach: '#60a5fa',
  ai_tools: '#22d3ee',
  sales_offers: '#facc15',
  tracking_analytics: '#fb923c',
  scaling_strategy: '#f472b6',
  hiring: '#818cf8',
  operations: '#2dd4bf',
  conversational: '#6b7280',
};

const SEGMENT_COLORS: Record<string, string> = {
  'Power Giver': 'bg-green-900/50 text-green-300 border-green-700',
  'Active Seeker': 'bg-blue-900/50 text-blue-300 border-blue-700',
  'Topic Specialist': 'bg-purple-900/50 text-purple-300 border-purple-700',
  'Social Connector': 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  'Lurker': 'bg-gray-800/50 text-gray-400 border-gray-700',
  'General': 'bg-gray-700/50 text-gray-300 border-gray-600',
};

const ROLE_COLORS: Record<string, string> = {
  giver: 'text-green-400',
  seeker: 'text-blue-400',
  neutral: 'text-gray-400',
};

interface Member {
  authorId: string;
  authorName: string;
  authorBio: string;
  postCount: number;
  commentCount: number;
  totalActivity: number;
  firstActive: string;
  lastActive: string;
  primaryTopic: string | null;
  primaryRole: string | null;
  giverCount: number;
  seekerCount: number;
  neutralCount: number;
  topicSpread: { topic: string; count: number }[];
  engagementScore: number;
  segment: string;
  selfReplyCount: number;
  threadCount: number;
  conversationalPct: number;
  recentPosts: { id: string; title: string; createdAt: string; topic: string | null }[];
}

interface Summary {
  totalMembers: number;
  powerGivers: number;
  activeSeekers: number;
  topicSpecialists: number;
  avgEngagement: number;
}

const SEGMENTS = [
  { value: '', label: 'All Segments' },
  { value: 'power_giver', label: 'Power Givers' },
  { value: 'active_seeker', label: 'Active Seekers' },
  { value: 'topic_specialist', label: 'Topic Specialists' },
  { value: 'social_connector', label: 'Social Connectors' },
  { value: 'lurker', label: 'Lurkers' },
  { value: 'general', label: 'General' },
];

const TOPICS = [
  '', 'paid_ads', 'content_organic', 'lead_gen_funnels', 'email_outreach',
  'ai_tools', 'sales_offers', 'tracking_analytics', 'scaling_strategy',
  'hiring', 'operations', 'conversational',
];

const SORTS = [
  { value: 'engagement', label: 'Engagement Score' },
  { value: 'activity', label: 'Total Activity' },
  { value: 'recent', label: 'Recently Active' },
  { value: 'name', label: 'Name (A-Z)' },
];

function relativeDate(dateStr: string) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  if (diff < 365) return `${Math.floor(diff / 30)}mo ago`;
  return `${Math.floor(diff / 365)}y ago`;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [segment, setSegment] = useState('');
  const [topic, setTopic] = useState('');
  const [sort, setSort] = useState('engagement');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('sort', sort);
    if (segment) params.set('segment', segment);
    if (topic) params.set('topic', topic);
    if (searchDebounced) params.set('search', searchDebounced);

    try {
      const res = await fetch(`/api/members?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMembers(json.members || []);
      setSummary(json.summary || null);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  }, [sort, segment, topic, searchDebounced]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Members</h1>
          <p className="text-gray-400 text-sm mt-1">Community member profiles and engagement data</p>
        </div>
        <div className="flex gap-3">
          <a href="/" className="text-sm text-[#6c8cff] hover:text-white transition-colors">&larr; Posts</a>
          <a href="/dashboard" className="text-sm text-[#6c8cff] hover:text-white transition-colors">Dashboard</a>
        </div>
      </header>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <div className="bg-[#1a1d27] rounded-lg p-4">
            <div className="text-sm text-gray-400">Total Members</div>
            <div className="text-2xl font-bold text-white mt-1">{summary.totalMembers.toLocaleString()}</div>
          </div>
          <div className="bg-[#1a1d27] rounded-lg p-4">
            <div className="text-sm text-gray-400">Power Givers</div>
            <div className="text-2xl font-bold text-green-400 mt-1">{summary.powerGivers}</div>
          </div>
          <div className="bg-[#1a1d27] rounded-lg p-4">
            <div className="text-sm text-gray-400">Active Seekers</div>
            <div className="text-2xl font-bold text-blue-400 mt-1">{summary.activeSeekers}</div>
          </div>
          <div className="bg-[#1a1d27] rounded-lg p-4">
            <div className="text-sm text-gray-400">Topic Specialists</div>
            <div className="text-2xl font-bold text-purple-400 mt-1">{summary.topicSpecialists}</div>
          </div>
          <div className="bg-[#1a1d27] rounded-lg p-4">
            <div className="text-sm text-gray-400">Avg Engagement</div>
            <div className="text-2xl font-bold text-white mt-1">{summary.avgEngagement.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <select value={segment} onChange={e => setSegment(e.target.value)}
          className="bg-[#1a1d27] text-white border border-gray-700 rounded px-3 py-2 text-sm">
          {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <select value={topic} onChange={e => setTopic(e.target.value)}
          className="bg-[#1a1d27] text-white border border-gray-700 rounded px-3 py-2 text-sm">
          <option value="">All Topics</option>
          {TOPICS.filter(Boolean).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>

        <select value={sort} onChange={e => setSort(e.target.value)}
          className="bg-[#1a1d27] text-white border border-gray-700 rounded px-3 py-2 text-sm">
          {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-[#1a1d27] text-white border border-gray-700 rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
        />

        <span className="text-sm text-gray-500 ml-auto">
          {loading ? 'Loading...' : `${members.length} members`}
        </span>
      </div>

      {/* Member list */}
      <div className="space-y-2">
        {members.map(m => (
          <MemberCard
            key={m.authorId}
            member={m}
            expanded={expandedId === m.authorId}
            onToggle={() => setExpandedId(expandedId === m.authorId ? null : m.authorId)}
          />
        ))}
        {!loading && members.length === 0 && (
          <div className="text-gray-500 text-center py-12">No members found.</div>
        )}
      </div>
    </div>
  );
}

function MemberCard({ member: m, expanded, onToggle }: { member: Member; expanded: boolean; onToggle: () => void }) {
  const totalRoles = m.giverCount + m.seekerCount + m.neutralCount;
  const giverPct = totalRoles > 0 ? Math.round((m.giverCount / totalRoles) * 100) : 0;
  const seekerPct = totalRoles > 0 ? Math.round((m.seekerCount / totalRoles) * 100) : 0;

  return (
    <div
      className={`bg-[#1a1d27] rounded-lg border transition-colors cursor-pointer ${
        expanded ? 'border-[#6c8cff]' : 'border-transparent hover:border-gray-600'
      }`}
      onClick={onToggle}
    >
      {/* Collapsed view */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-white font-medium truncate">{m.authorName}</h3>
              <span className={`px-2 py-0.5 rounded text-xs border ${SEGMENT_COLORS[m.segment] || SEGMENT_COLORS['General']}`}>
                {m.segment}
              </span>
            </div>
            {m.authorBio && (
              <p className="text-gray-500 text-sm mt-1 truncate">{m.authorBio}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
              <span>{m.postCount} posts</span>
              <span>{m.commentCount} comments</span>
              <span className="text-gray-600">|</span>
              <span>Score: {m.engagementScore.toLocaleString()}</span>
              <span className="text-gray-600">|</span>
              <span>Active {relativeDate(m.lastActive)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {m.primaryTopic && (
              <span className={`px-2 py-0.5 rounded text-xs ${TOPIC_COLORS[m.primaryTopic] || 'bg-gray-700 text-gray-300'}`}>
                {m.primaryTopic.replace(/_/g, ' ')}
              </span>
            )}
            {m.primaryRole && (
              <span className={`text-xs font-medium ${ROLE_COLORS[m.primaryRole] || 'text-gray-400'}`}>
                {m.primaryRole}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded view */}
      {expanded && (
        <div className="border-t border-gray-800 p-4 space-y-4" onClick={e => e.stopPropagation()}>
          {/* Bio */}
          {m.authorBio && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Bio</div>
              <p className="text-gray-300 text-sm">{m.authorBio}</p>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <div className="text-xs text-gray-500">First Active</div>
              <div className="text-sm text-white">{m.firstActive ? new Date(m.firstActive).toLocaleDateString() : 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Last Active</div>
              <div className="text-sm text-white">{m.lastActive ? new Date(m.lastActive).toLocaleDateString() : 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Threads Engaged</div>
              <div className="text-sm text-white">{m.threadCount}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Self-Replies</div>
              <div className="text-sm text-white">{m.selfReplyCount}</div>
            </div>
          </div>

          {/* Giver / Seeker split */}
          {totalRoles > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Role Split</div>
              <div className="flex h-3 rounded-full overflow-hidden bg-gray-800">
                {giverPct > 0 && (
                  <div className="bg-green-500" style={{ width: `${giverPct}%` }} title={`Giver ${giverPct}%`} />
                )}
                {seekerPct > 0 && (
                  <div className="bg-blue-500" style={{ width: `${seekerPct}%` }} title={`Seeker ${seekerPct}%`} />
                )}
                <div className="bg-gray-600 flex-1" title={`Neutral ${100 - giverPct - seekerPct}%`} />
              </div>
              <div className="flex gap-4 mt-1 text-xs text-gray-400">
                <span className="text-green-400">Giver {giverPct}%</span>
                <span className="text-blue-400">Seeker {seekerPct}%</span>
                <span className="text-gray-400">Neutral {100 - giverPct - seekerPct}%</span>
              </div>
            </div>
          )}

          {/* Topic breakdown */}
          {m.topicSpread.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Topic Breakdown</div>
              <div className="space-y-1">
                {m.topicSpread.map(t => {
                  const maxCount = m.topicSpread[0].count;
                  const pct = maxCount > 0 ? (t.count / maxCount) * 100 : 0;
                  return (
                    <div key={t.topic} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-28 shrink-0 truncate">{t.topic.replace(/_/g, ' ')}</span>
                      <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: TOPIC_BAR_COLORS[t.topic] || '#6b7280' }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-6 text-right">{t.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent posts */}
          {m.recentPosts.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Recent Posts</div>
              <div className="space-y-1">
                {m.recentPosts.map(p => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 text-xs shrink-0">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                    {p.topic && (
                      <span className={`px-1.5 py-0 rounded text-[10px] ${TOPIC_COLORS[p.topic] || 'bg-gray-700 text-gray-300'}`}>
                        {p.topic.replace(/_/g, ' ')}
                      </span>
                    )}
                    <span className="text-gray-300 truncate">{p.title || '(no title)'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
