'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-10 flex flex-col items-center">
      <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
      <button
        className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-700"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}