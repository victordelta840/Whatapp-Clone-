import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { RestrictedAbout, RestrictedPhoto, UserProfile, UserSettings } from '@/types';

interface AuthStoreState {
  authUser: User | null;
  profile: UserProfile | null;
  photo: RestrictedPhoto | null;
  about: RestrictedAbout | null;
  settings: UserSettings | null;
  authReady: boolean;
  needsOnboarding: boolean;
  setAuthUser: (user: User | null) => void;
  setProfileData: (data: {
    profile: UserProfile | null;
    photo?: RestrictedPhoto | null;
    about?: RestrictedAbout | null;
    settings?: UserSettings | null;
  }) => void;
  setAuthReady: (ready: boolean) => void;
  setNeedsOnboarding: (needs: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  authUser: null,
  profile: null,
  photo: null,
  about: null,
  settings: null,
  authReady: false,
  needsOnboarding: false,
  setAuthUser: (authUser) => set({ authUser }),
  setProfileData: ({ profile, photo, about, settings }) =>
    set((state) => ({
      profile,
      photo: photo !== undefined ? photo : state.photo,
      about: about !== undefined ? about : state.about,
      settings: settings !== undefined ? settings : state.settings,
    })),
  setAuthReady: (authReady) => set({ authReady }),
  setNeedsOnboarding: (needsOnboarding) => set({ needsOnboarding }),
  reset: () =>
    set({
      authUser: null,
      profile: null,
      photo: null,
      about: null,
      settings: null,
      needsOnboarding: false,
    }),
}));
