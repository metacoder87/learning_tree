import { FormEvent, useState } from "react";


interface ProfileSummary {
  id: number;
  display_name: string;
  age_band: string | null;
}

interface ProfileSelectorProps {
  error: string | null;
  isLoading: boolean;
  profiles: ProfileSummary[];
  selectedProfileId: number | null;
  onChooseProfile: (profileId: number) => void;
  onCreateProfile: (displayName: string) => Promise<void>;
}


export function ProfileSelector({
  error,
  isLoading,
  profiles,
  selectedProfileId,
  onChooseProfile,
  onCreateProfile,
}: ProfileSelectorProps) {
  const [draftName, setDraftName] = useState("");
  const [isAddingProfile, setIsAddingProfile] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = draftName.trim();
    if (!nextName) {
      return;
    }

    await onCreateProfile(nextName);
    setDraftName("");
    setIsAddingProfile(false);
  };

  return (
    <section className="profile-gate-screen" aria-label="Choose a child profile">
      <div className="profile-gate-backdrop" />
      <div className="profile-gate-card">
        <p className="profile-gate-kicker">Offline Learning Adventure</p>
        <h1>The Learning Tree</h1>
        <p className="profile-gate-copy">
          Choose a child profile to step into the tree.
        </p>

        <div className="profile-gate-grid">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              className={profile.id === selectedProfileId ? "profile-gate-button active" : "profile-gate-button"}
              type="button"
              onClick={() => onChooseProfile(profile.id)}
              disabled={isLoading}
            >
              <span className="profile-gate-avatar" aria-hidden="true">
                {profile.display_name.slice(0, 1).toUpperCase()}
              </span>
              <span className="profile-gate-label">{profile.display_name}</span>
              <span className="profile-gate-subtitle">{profile.age_band ?? "Learner"}</span>
            </button>
          ))}
        </div>

        <div className="profile-gate-actions">
          {!isAddingProfile ? (
            <button
              className="profile-gate-add-button"
              type="button"
              onClick={() => setIsAddingProfile(true)}
              disabled={isLoading}
            >
              Add a Child Profile
            </button>
          ) : (
            <form className="profile-gate-form" onSubmit={handleSubmit}>
              <input
                aria-label="Child profile name"
                className="profile-gate-input"
                maxLength={100}
                placeholder="Type a name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
              />
              <div className="profile-gate-form-actions">
                <button className="profile-gate-create-button" type="submit" disabled={isLoading || draftName.trim().length === 0}>
                  Create Profile
                </button>
                <button
                  className="profile-gate-cancel-button"
                  type="button"
                  onClick={() => {
                    setDraftName("");
                    setIsAddingProfile(false);
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="profile-gate-footer">
          {error
            ? error
            : isLoading
            ? "Loading your saved explorers..."
            : "Tap a profile to enter the tree."}
        </p>
      </div>
    </section>
  );
}
