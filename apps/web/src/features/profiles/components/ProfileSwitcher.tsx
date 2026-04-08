import { FormEvent, useState } from "react";


interface ProfileSummary {
  id: number;
  display_name: string;
}

interface ProfileSwitcherProps {
  profiles: ProfileSummary[];
  selectedProfileId: number | null;
  isLoading: boolean;
  onSelectProfile: (profileId: number) => void;
  onCreateProfile: (displayName: string) => Promise<void>;
}


export function ProfileSwitcher({
  profiles,
  selectedProfileId,
  isLoading,
  onSelectProfile,
  onCreateProfile,
}: ProfileSwitcherProps) {
  const [draftName, setDraftName] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = draftName.trim();
    if (!nextName) {
      return;
    }

    await onCreateProfile(nextName);
    setDraftName("");
  };

  return (
    <section className="profile-panel">
      <div className="profile-panel-header">
        <p className="lesson-kicker">Profiles</p>
        <span className="profile-count">{profiles.length}</span>
      </div>

      <div className="profile-chip-row">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            className={profile.id === selectedProfileId ? "profile-chip active" : "profile-chip"}
            type="button"
            onClick={() => onSelectProfile(profile.id)}
            disabled={isLoading}
          >
            {profile.display_name}
          </button>
        ))}
      </div>

      <form className="profile-form" onSubmit={handleSubmit}>
        <input
          aria-label="New profile name"
          className="profile-input"
          maxLength={100}
          placeholder="Add a child profile"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
        />
        <button className="profile-add-button" type="submit" disabled={isLoading || draftName.trim().length === 0}>
          Add
        </button>
      </form>
    </section>
  );
}
