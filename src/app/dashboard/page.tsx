'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const TOPIC_COLORS: Record<string, string> = {
  paid_ads: '#f87171',
  content_organic: '#fb923c',
  lead_gen_funnels: '#facc15',
  email_outreach: '#4ade80',
  ai_tools: '#60a5fa',
  sales_offers: '#a78bfa',
  tracking_analytics: '#f472b6',
  scaling_strategy: '#2dd4bf',
  hiring: '#e879f9',
  operations: '#94a3b8',
  conversational: '#6b7280',
};

const ROLE_COLORS: Record<string, string> = {
  seeker: '#f87171',
  giver: '#4ade80',
  neutral: '#94a3b8',
};

interface DashboardData {
  headlines: {
    totalPosts: number;
    totalComments: number;
    uniqueMembers: number;
    postsThisWeek: number;
    postsThisMonth: number;
    dau: number;
    wau: number;
    mau: number;
  };
  postsPerWeek: { week: string; count: number }[];
  activeUsersPerWeek: { week: string; count: number }[];
  topicsByWeek: Record<string, unknown>[];
  rolesByWeek: Record<string, unknown>[];
  topicDistribution: { topic: string; count: number }[];
  seekerResponseRate: { week: string; rate: number }[];
  timeToResponse: { week: string; medianHours: number }[];
  topGivers: { name: string; count: number; primaryTopic: string }[];
}

function formatWeek(label: unknown) {
  const d = new Date(String(label));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#1a1d27] rounded-lg p-4">
      <div className="text-sm text-gray-400">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value.toLocaleString()}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1d27] rounded-lg p-5">
      <h3 className="text-sm font-medium text-gray-400 mb-4">{title}</h3>
      {children}
    </div>
  );
}

const RANGES = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [range, setRange] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?range=${range}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="min-h-screen p-6 max-w-7xl mx-auto">
        <Header range={range} setRange={setRange} />
        <div className="flex items-center justify-center h-64 text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  if (!data) return null;

  const allTopics = data.topicDistribution.map(t => t.topic);

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      <Header range={range} setRange={setRange} />

      {/* Headline cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
        <Card label="Total Posts" value={data.headlines.totalPosts} />
        <Card label="Total Comments" value={data.headlines.totalComments} />
        <Card label="Unique Members" value={data.headlines.uniqueMembers} />
        <Card label="Posts This Week" value={data.headlines.postsThisWeek} />
        <Card label="Posts This Month" value={data.headlines.postsThisMonth} />
        <Card label="DAU" value={data.headlines.dau} />
        <Card label="WAU" value={data.headlines.wau} />
        <Card label="MAU" value={data.headlines.mau} />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Posts per week */}
        <ChartCard title="Posts per Week">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.postsPerWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d37" />
              <XAxis dataKey="week" tickFormatter={formatWeek} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #374151', borderRadius: 8 }} labelFormatter={formatWeek} />
              <Line type="monotone" dataKey="count" stroke="#6c8cff" strokeWidth={2} dot={false} name="Posts" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Active users per week */}
        <ChartCard title="Active Users per Week">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.activeUsersPerWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d37" />
              <XAxis dataKey="week" tickFormatter={formatWeek} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #374151', borderRadius: 8 }} labelFormatter={formatWeek} />
              <Line type="monotone" dataKey="count" stroke="#4ade80" strokeWidth={2} dot={false} name="Users" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Trending topics by week */}
        <ChartCard title="Trending Topics by Week">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.topicsByWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d37" />
              <XAxis dataKey="week" tickFormatter={formatWeek} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #374151', borderRadius: 8 }} labelFormatter={formatWeek} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {allTopics.map(topic => (
                <Area
                  key={topic}
                  type="monotone"
                  dataKey={topic}
                  stackId="1"
                  fill={TOPIC_COLORS[topic] || '#6b7280'}
                  stroke={TOPIC_COLORS[topic] || '#6b7280'}
                  fillOpacity={0.6}
                  name={topic.replace(/_/g, ' ')}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Role distribution by week */}
        <ChartCard title="Seeker vs Giver vs Neutral per Week">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.rolesByWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d37" />
              <XAxis dataKey="week" tickFormatter={formatWeek} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #374151', borderRadius: 8 }} labelFormatter={formatWeek} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {['seeker', 'giver', 'neutral'].map(role => (
                <Area
                  key={role}
                  type="monotone"
                  dataKey={role}
                  stackId="1"
                  fill={ROLE_COLORS[role]}
                  stroke={ROLE_COLORS[role]}
                  fillOpacity={0.6}
                  name={role.charAt(0).toUpperCase() + role.slice(1)}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Topic distribution */}
        <ChartCard title="Topic Distribution (Total Posts)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.topicDistribution} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d37" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis
                dataKey="topic"
                type="category"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                width={120}
                tickFormatter={(v: string) => v.replace(/_/g, ' ')}
              />
              <Tooltip contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #374151', borderRadius: 8 }} />
              <Bar dataKey="count" name="Posts" radius={[0, 4, 4, 0]}>
                {data.topicDistribution.map((entry) => (
                  <Cell key={entry.topic} fill={TOPIC_COLORS[entry.topic] || '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Seeker response rate */}
        <ChartCard title="Seeker Response Rate (% with Comments)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.seekerResponseRate}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d37" />
              <XAxis dataKey="week" tickFormatter={formatWeek} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #374151', borderRadius: 8 }} labelFormatter={formatWeek} formatter={(v: unknown) => [`${v}%`, 'Response Rate']} />
              <Line type="monotone" dataKey="rate" stroke="#facc15" strokeWidth={2} dot={false} name="Response Rate" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Time to first response */}
        <ChartCard title="Median Time to First Response (Hours)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.timeToResponse}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d37" />
              <XAxis dataKey="week" tickFormatter={formatWeek} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v: number) => `${v}h`} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #374151', borderRadius: 8 }} labelFormatter={formatWeek} formatter={(v: unknown) => [`${v}h`, 'Median']} />
              <Line type="monotone" dataKey="medianHours" stroke="#f472b6" strokeWidth={2} dot={false} name="Median Hours" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top givers table */}
        <ChartCard title="Top 20 Givers">
          <div className="overflow-auto max-h-[300px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#1a1d27]">
                <tr className="text-gray-400 text-left">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Member</th>
                  <th className="pb-2 font-medium">Posts</th>
                  <th className="pb-2 font-medium">Primary Topic</th>
                </tr>
              </thead>
              <tbody>
                {data.topGivers.map((g, i) => (
                  <tr key={g.name} className="border-t border-gray-800">
                    <td className="py-2 text-gray-500">{i + 1}</td>
                    <td className="py-2 text-white">{g.name}</td>
                    <td className="py-2 text-white font-medium">{g.count}</td>
                    <td className="py-2">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: (TOPIC_COLORS[g.primaryTopic] || '#6b7280') + '33', color: TOPIC_COLORS[g.primaryTopic] || '#9ca3af' }}
                      >
                        {g.primaryTopic?.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function Header({ range, setRange }: { range: string; setRange: (r: string) => void }) {
  return (
    <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
      <div>
        <div className="flex items-center gap-4 mb-1">
          <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
          <a href="/" className="text-sm text-[#6c8cff] hover:text-[#5a7af0]">&larr; Posts</a>
          <a href="/members" className="text-sm text-[#6c8cff] hover:text-[#5a7af0]">Members</a>
        </div>
        <p className="text-gray-400 text-sm">Community engagement metrics for skool.com/acq</p>
      </div>
      <div className="flex gap-2">
        {RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              range === r.value
                ? 'bg-[#6c8cff] text-white'
                : 'bg-[#1a1d27] text-gray-400 hover:text-white'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </header>
  );
}
