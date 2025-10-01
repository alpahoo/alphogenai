'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const OrganizationSelectionPage = (props: { params: { locale: string } }) => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      console.log('onboarding.organization-selection.redirect', { locale: props.params.locale });
      router.push(`/${props.params.locale}/dashboard`);
    } catch (err) {
      console.error('onboarding.organization-selection.error', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  }, [router, props.params.locale]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-bold text-red-600">Setup Error</h2>
          <p className="text-gray-600 mb-4">An error occurred during account setup:</p>
          <p className="text-red-500 mb-4">{error}</p>
          <button 
            onClick={() => router.push(`/${props.params.locale}/dashboard`)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">Welcome to AlphoGenAI</h2>
        <p className="text-gray-600">Setting up your account...</p>
      </div>
    </div>
  );
};

export default OrganizationSelectionPage;
