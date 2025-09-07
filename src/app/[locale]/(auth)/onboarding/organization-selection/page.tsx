'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const OrganizationSelectionPage = (props: { params: { locale: string } }) => {
  const router = useRouter();

  useEffect(() => {
    router.push(`/${props.params.locale}/dashboard`);
  }, [router, props.params.locale]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to AlphoGenAI</h2>
        <p className="text-gray-600">Setting up your account...</p>
      </div>
    </div>
  );
};

export default OrganizationSelectionPage;
