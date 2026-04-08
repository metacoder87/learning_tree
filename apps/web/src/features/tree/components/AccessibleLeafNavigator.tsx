import type { GradeBand, LeafNode } from "../types/tree";


interface AccessibleLeafNavigatorProps {
  grades: GradeBand[];
  selectedLeafId: number | string | null;
  onSelectLeaf: (leaf: LeafNode) => void;
  onSpeakLeaf: (title: string) => void;
}


export function AccessibleLeafNavigator({
  grades,
  selectedLeafId,
  onSelectLeaf,
  onSpeakLeaf,
}: AccessibleLeafNavigatorProps) {
  return (
    <section className="navigator-panel" aria-label="Keyboard leaf navigator">
      <div className="history-header">
        <p className="lesson-kicker">Leaf Navigator</p>
        <span className="profile-count">
          {grades.flatMap((grade) => grade.branches).flatMap((branch) => branch.leaves).length}
        </span>
      </div>

      <div className="navigator-grade-list">
        {grades.map((grade) => (
          <div key={grade.id} className="navigator-grade-card">
            <h3>{grade.title}</h3>
            {grade.branches.map((branch) => (
              <div key={branch.id} className="navigator-branch-block">
                <p>{branch.title}</p>
                <div className="navigator-leaf-row">
                  {branch.leaves.map((leaf) => (
                    <button
                      key={leaf.id}
                      type="button"
                      className={leaf.id === selectedLeafId ? "navigator-leaf-button active" : "navigator-leaf-button"}
                      onClick={() => onSelectLeaf(leaf)}
                      onFocus={() => onSpeakLeaf(leaf.title)}
                      onMouseEnter={() => onSpeakLeaf(leaf.title)}
                    >
                      {leaf.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
