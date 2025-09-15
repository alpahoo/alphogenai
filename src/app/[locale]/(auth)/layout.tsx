import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';

export default function AuthLayout(props: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        {props.children}
      </AuthProvider>
    </ErrorBoundary>
  );
}
