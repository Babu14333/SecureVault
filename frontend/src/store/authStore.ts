import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isVerified: boolean;
  isTwoFactorEnabled?: boolean;
  securityScore: number;
  storageUsed: number;
  storageLimit: number;
  avatar?: string;
  phone?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  sessionId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (data: {
    user: User;
    accessToken: string;
    refreshToken: string;
    sessionId: string;
  }) => void;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  sessionId: null,
  isAuthenticated: false,
  isLoading: true,
  setAuth: (data) =>
    set({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      sessionId: data.sessionId,
      isAuthenticated: true,
      isLoading: false,
    }),
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () =>
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      sessionId: null,
      isAuthenticated: false,
      isLoading: false,
    }),
}));
