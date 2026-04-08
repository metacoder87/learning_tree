import { useCallback, useEffect, useState } from "react";

import { fetchJson } from "../../../lib/api";


const PROFILE_STORAGE_KEY = "learning-tree-profile-id";
const DEFAULT_PROFILE_NAME = "Explorer";

interface ProfileSummary {
  id: number;
  display_name: string;
  avatar_seed: string | null;
  age_band: string | null;
}

interface CreatedProfile extends ProfileSummary {
  created_at?: string;
}

interface UseProfilesResult {
  profiles: ProfileSummary[];
  selectedProfileId: number | null;
  isLoading: boolean;
  error: string | null;
  selectProfile: (profileId: number) => void;
  createProfile: (displayName: string) => Promise<number | null>;
  refreshProfiles: () => Promise<void>;
}


async function listProfiles() {
  return fetchJson<ProfileSummary[]>("/api/profiles");
}


async function createProfileRequest(displayName: string) {
  return fetchJson<CreatedProfile>("/api/profiles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      display_name: displayName,
      age_band: "elementary",
    }),
  });
}


function getStoredProfileId() {
  const rawProfileId = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  const parsedProfileId = rawProfileId ? Number(rawProfileId) : NaN;
  return Number.isFinite(parsedProfileId) && parsedProfileId > 0 ? parsedProfileId : null;
}


export function useProfiles(): UseProfilesResult {
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectProfile = useCallback((profileId: number) => {
    setSelectedProfileId(profileId);
    window.localStorage.setItem(PROFILE_STORAGE_KEY, String(profileId));
  }, []);

  const refreshProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let nextProfiles = await listProfiles();
      if (nextProfiles.length === 0) {
        const defaultProfile = await createProfileRequest(DEFAULT_PROFILE_NAME);
        nextProfiles = [defaultProfile];
      }

      setProfiles(nextProfiles);

      const storedProfileId = getStoredProfileId();
      const selectedProfile =
        nextProfiles.find((profile) => profile.id === selectedProfileId) ??
        nextProfiles.find((profile) => profile.id === storedProfileId) ??
        nextProfiles[0];

      if (selectedProfile) {
        setSelectedProfileId(selectedProfile.id);
        window.localStorage.setItem(PROFILE_STORAGE_KEY, String(selectedProfile.id));
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to load profiles.";
      setProfiles([]);
      setSelectedProfileId(null);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createProfile = useCallback(
    async (displayName: string) => {
      const trimmedName = displayName.trim();
      if (!trimmedName) {
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const createdProfile = await createProfileRequest(trimmedName);
        const nextProfiles = [...profiles, createdProfile].sort((left, right) => left.id - right.id);
        setProfiles(nextProfiles);
        setSelectedProfileId(createdProfile.id);
        window.localStorage.setItem(PROFILE_STORAGE_KEY, String(createdProfile.id));
        return createdProfile.id;
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : "Unable to create profile.";
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [profiles],
  );

  useEffect(() => {
    void refreshProfiles();
  }, [refreshProfiles]);

  return {
    profiles,
    selectedProfileId,
    isLoading,
    error,
    selectProfile,
    createProfile,
    refreshProfiles,
  };
}
