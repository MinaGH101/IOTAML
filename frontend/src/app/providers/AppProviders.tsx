import type { ReactNode } from 'react';
import { AppErrorBoundary } from '../error-boundary/AppErrorBoundary';
import { AuthProvider } from './AuthProvider';
import { ThemeProvider } from './ThemeProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
