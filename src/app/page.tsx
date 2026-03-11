'use client';

import { useState, useEffect, useCallback } from 'react';
import { Post } from '@/types';
import StatsBar from '@/components/StatsBar';
import FilterBar from '@/components/FilterBar';
import PostList from '@/components/PostList';
import PostDetail from '@/components/PostDetail';

export default function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    topic: '',
    role: '',
    replier: '',
    status: '',
    search: '',
  });
  const [loading, setLoading] = useState({
    scraping: false,
    classifying: false,
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchPosts = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.topic) params.set('topic', filters.topic);
    if (filters.role) params.set('role', filters.role);
    if (filters.replier) params.set('replier', filters.replier);
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);

    try {
      const res = await fetch(`/api/posts?${params}`);
      const data = await res.json();
      setPosts(data.posts || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    }
  }, [filters]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts, refreshKey]);

  // Debounce search
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const handleFilterChange = (newFilters: typeof filters) => {
    if (newFilters.search !== filters.search) {
      if (searchTimeout) clearTimeout(searchTimeout);
      const timeout = setTimeout(() => {
        setFilters(newFilters);
      }, 300);
      setSearchTimeout(timeout);
    } else {
      setFilters(newFilters);
    }
  };

  const handleScrape = async () => {
    setLoading(prev => ({ ...prev, scraping: true }));
    try {
      const res = await fetch('/api/scrape?pages=3');
      const data = await res.json();
      if (data.error) {
        alert(`Scrape failed: ${data.error}`);
      } else {
        alert(`Scraped ${data.postsScraped} posts (${data.newPosts} new), ${data.commentsScraped} comments`);
        setRefreshKey(k => k + 1);
      }
    } catch (err) {
      alert(`Scrape failed: ${err}`);
    } finally {
      setLoading(prev => ({ ...prev, scraping: false }));
    }
  };

  const handleClassify = async () => {
    setLoading(prev => ({ ...prev, classifying: true }));
    try {
      const res = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) {
        alert(`Classification failed: ${data.error}`);
      } else {
        alert(`Classified ${data.classified} posts (${data.errors} errors)`);
        setRefreshKey(k => k + 1);
      }
    } catch (err) {
      alert(`Classification failed: ${err}`);
    } finally {
      setLoading(prev => ({ ...prev, classifying: false }));
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">ACQ Vantage Community Manager</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage replies for skool.com/acq · {total} posts
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/members"
            className="bg-[#1a1d27] text-[#6c8cff] hover:text-white px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            Members
          </a>
          <a
            href="/dashboard"
            className="bg-[#1a1d27] text-[#6c8cff] hover:text-white px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            Dashboard
          </a>
        </div>
      </header>

      <StatsBar key={refreshKey} />

      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        onScrape={handleScrape}
        onClassify={handleClassify}
        loading={loading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PostList
          posts={posts}
          selectedId={selectedPostId}
          onSelect={setSelectedPostId}
        />

        {selectedPostId && (
          <PostDetail
            postId={selectedPostId}
            onStatusChange={() => setRefreshKey(k => k + 1)}
          />
        )}
      </div>
    </div>
  );
}
