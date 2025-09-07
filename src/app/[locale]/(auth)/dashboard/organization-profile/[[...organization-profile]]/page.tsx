'use client';

import { useRouter } from 'next/navigation';

import { TitleBar } from '@/features/dashboard/TitleBar';

const OrganizationProfilePage = (props: { params: { locale: string } }) => {
  const router = useRouter();

  router.push(`/${props.params.locale}/dashboard/user-profile`);

  return (
    <>
      <TitleBar
        title="Organization Profile"
        description="Redirecting to user profile..."
      />

      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gray-600">AlphoGenAI uses individual accounts.</p>
          <p className="text-gray-600">Redirecting to your user profile...</p>
        </div>
      </div>
    </>
  );
};

export default OrganizationProfilePage;
