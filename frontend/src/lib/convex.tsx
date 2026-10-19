import React, { useMemo } from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';

/**
 * Convex Client Provider
 * 
 * Configures the Convex reactive client from VITE_CONVEX_URL.
 * If VITE_CONVEX_URL is not yet provisioned, gracefully passes through
 * children so the existing React application and mock flows continue functioning.
 */
interface ConvexClientProviderProps {
  children: React.ReactNode;
}

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  const convexUrl = import.meta.env.VITE_CONVEX_URL;

  const client = useMemo(() => {
    if (!convexUrl) {
      return null;
    }
    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  if (!client) {
    return <>{children}</>;
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}

export { api } from '../../convex/_generated/api';
