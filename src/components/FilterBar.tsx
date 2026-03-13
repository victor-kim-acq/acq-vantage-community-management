'use client';

interface FilterBarProps {
  filters: {
    topic: string;
    role: string;
    replier: string;
    status: string;
    search: string;
    dateFrom: string;
    dateTo: string;
    author: string;
  };
  onChange: (filters: FilterBarProps['filters']) => void;
  onScrape: () => void;
  onClassify: () => void;
  loading: { scraping: boolean; classifying: boolean };
  authors?: string[];
}

const TOPICS = [
  '', 'paid_ads', 'content_organic', 'lead_gen_funnels', 'email_outreach',
  'ai_tools', 'sales_offers', 'tracking_analytics', 'scaling_strategy',
  'hiring', 'operations', 'conversational',
];

const ROLES = ['', 'giver', 'seeker', 'neutral'];
const REPLIERS = ['', 'Saulo', 'Caio', 'Victor', 'Samaria'];
const STATUSES = ['', 'pending', 'drafted', 'replied', 'skipped'];

export default function FilterBar({ filters, onChange, onScrape, onClassify, loading, authors = [] }: FilterBarProps) {
  const update = (key: string, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex flex-wrap gap-3 mb-6 items-center">
      <select
        value={filters.topic}
        onChange={e => update('topic', e.target.value)}
        className="bg-[#1a1d27] text-white border border-gray-700 rounded px-3 py-2 text-sm"
      >
        <option value="">All Topics</option>
        {TOPICS.filter(Boolean).map(t => (
          <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
        ))}
      </select>

      <select
        value={filters.role}
        onChange={e => update('role', e.target.value)}
        className="bg-[#1a1d27] text-white border border-gray-700 rounded px-3 py-2 text-sm"
      >
        <option value="">All Roles</option>
        {ROLES.filter(Boolean).map(r => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

      <select
        value={filters.replier}
        onChange={e => update('replier', e.target.value)}
        className="bg-[#1a1d27] text-white border border-gray-700 rounded px-3 py-2 text-sm"
      >
        <option value="">All Repliers</option>
        {REPLIERS.filter(Boolean).map(r => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

      <select
        value={filters.status}
        onChange={e => update('status', e.target.value)}
        className="bg-[#1a1d27] text-white border border-gray-700 rounded px-3 py-2 text-sm"
      >
        <option value="">All Statuses</option>
        {STATUSES.filter(Boolean).map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <select
        value={filters.author}
        onChange={e => update('author', e.target.value)}
        className="bg-[#1a1d27] text-white border border-gray-700 rounded px-3 py-2 text-sm"
      >
        <option value="">All Authors</option>
        {authors.map(a => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Search posts..."
        value={filters.search}
        onChange={e => update('search', e.target.value)}
        className="bg-[#1a1d27] text-white border border-gray-700 rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
      />

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={filters.dateFrom}
          onChange={e => update('dateFrom', e.target.value)}
          className="bg-[#1a1d27] text-white border border-gray-700 rounded px-2 py-2 text-sm"
          title="From date"
        />
        <span className="text-gray-500 text-sm">to</span>
        <input
          type="date"
          value={filters.dateTo}
          onChange={e => update('dateTo', e.target.value)}
          className="bg-[#1a1d27] text-white border border-gray-700 rounded px-2 py-2 text-sm"
          title="To date"
        />
      </div>

      <div className="flex gap-2 ml-auto">
        <button
          onClick={onScrape}
          disabled={loading.scraping}
          className="bg-[#6c8cff] hover:bg-[#5a7af0] disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
        >
          {loading.scraping ? 'Scraping...' : 'Scrape Now'}
        </button>
        <button
          onClick={onClassify}
          disabled={loading.classifying}
          className="bg-[#4a5568] hover:bg-[#5a6578] disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
        >
          {loading.classifying ? 'Classifying...' : 'Classify Untagged'}
        </button>
      </div>
    </div>
  );
}
