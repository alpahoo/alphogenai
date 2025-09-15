'use client';

import { JobsList } from '@/features/dashboard/JobsList';
import { TitleBar } from '@/features/dashboard/TitleBar';

const DashboardIndexPage = () => {
  return (
    <div data-testid="dashboard-root">
      <TitleBar
        title="AlphoGenAI Dashboard"
        description="Create and manage your AI-generated videos"
      />

      <JobsList />
    </div>
  );
};

export default DashboardIndexPage;
