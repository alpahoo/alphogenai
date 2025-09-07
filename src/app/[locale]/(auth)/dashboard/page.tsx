'use client';

import { JobsList } from '@/features/dashboard/JobsList';
import { TitleBar } from '@/features/dashboard/TitleBar';

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
