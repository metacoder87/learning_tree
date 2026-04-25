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
  onCreateProfile: (displayName: string, ageBand: string) => Promise<void>;
}

const AGE_BAND_OPTIONS = [
  { value: "early-reader", label: "Early Reader" },
  { value: "elementary", label: "Elementary" },
  { value: "middle-school", label: "Middle School" },
  { value: "high-school", label: "High School" },
  { value: "higher-ed", label: "Higher Ed" },
];


export function ProfileSwitcher({
  profiles,
  selectedProfileId,
  isLoading,
  onSelectProfile,
  onCreateProfile,
}: ProfileSwitcherProps) {
  const [draftName, setDraftName] = useState("");
  const [draftAgeBand, setDraftAgeBand] = useState("elementary");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = draftName.trim();
    if (!nextName) {
      return;
    }

    await onCreateProfile(nextName, draftAgeBand);
    setDraftName("");
    setDraftAgeBand("elementary");
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
        <select
          aria-label="New profile learner level"
          className="profile-input"
          value={draftAgeBand}
          onChange={(event) => setDraftAgeBand(event.target.value)}
        >
          {AGE_BAND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button className="profile-add-button" type="submit" disabled={isLoading || draftName.trim().length === 0}>
          Add
        </button>
      </form>
    </section>
  );
}
