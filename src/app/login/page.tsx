'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError('Wrong password');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
      <form
        onSubmit={handleSubmit}
        className="bg-[#1a1d27] rounded-lg p-8 w-full max-w-sm space-y-4"
      >
        <h1 className="text-xl font-bold text-white text-center">
          ACQ Vantage Community Manager
        </h1>
        <p className="text-gray-400 text-sm text-center">Enter password to continue</p>

        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full bg-[#0f1117] text-white border border-gray-700 rounded px-4 py-2.5 text-sm focus:outline-none focus:border-[#6c8cff]"
        />

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full bg-[#6c8cff] hover:bg-[#5a7af0] disabled:opacity-50 text-white py-2.5 rounded text-sm font-medium"
        >
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>
    </div>
  );
}
