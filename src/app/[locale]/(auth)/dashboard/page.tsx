'use client';

import { TitleBar } from '@/features/dashboard/TitleBar';
import { JobsList } from '@/features/dashboard/JobsList';

const DashboardIndexPage = () => {
  return (
    <>
      <TitleBar
        title="AlphoGenAI Dashboard"
        description="Create and manage your AI-generated videos"
      />

      <JobsList />
    </>
  );
};

export default DashboardIndexPage;
