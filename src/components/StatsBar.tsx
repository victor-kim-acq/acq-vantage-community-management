'use client';

import { useEffect, useState } from 'react';

interface Stats {
  total_posts: number;
  unclassified: number;
  pending_replies: number;
  completed_this_week: number;
}

export default function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  if (!stats) return null;

  const items = [
    { label: 'Total Posts', value: stats.total_posts },
    { label: 'Unclassified', value: stats.unclassified },
    { label: 'Pending Replies', value: stats.pending_replies },
    { label: 'Completed This Week', value: stats.completed_this_week },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {items.map(item => (
        <div key={item.label} className="bg-[#1a1d27] rounded-lg p-4">
          <div className="text-sm text-gray-400">{item.label}</div>
          <div className="text-2xl font-bold text-white mt-1">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
