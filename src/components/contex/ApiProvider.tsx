import React, { createContext, useContext, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';

interface ApiContextType {
  api: typeof api;
  isAuthenticated: boolean;
  accessToken: string | null;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export const useApi = () => {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};

interface ApiProviderProps {
  children: React.ReactNode;
}

export const ApiProvider: React.FC<ApiProviderProps> = ({ children }) => {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated' && !!session;
  const accessToken = session?.accessToken || null;

  // Update API client with current access token
  useEffect(() => {
    if (accessToken) {
      api.setAccessToken(accessToken);
    } else {
      api.setAccessToken(null);
    }
  }, [accessToken]);

  const value: ApiContextType = {
    api,
    isAuthenticated,
    accessToken,
  };

  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
};
