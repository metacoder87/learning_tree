import type { ReactNode } from "react";


interface ParentMenuDrawerProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
}


export function ParentMenuDrawer({ children, isOpen, onClose }: ParentMenuDrawerProps) {
  return (
    <>
      <button
        type="button"
        className={isOpen ? "parent-drawer-backdrop open" : "parent-drawer-backdrop"}
        aria-label="Close parent menu"
        aria-hidden={!isOpen}
        tabIndex={isOpen ? 0 : -1}
        onClick={onClose}
      />
      <aside
        className={isOpen ? "parent-drawer open" : "parent-drawer"}
        aria-hidden={!isOpen}
        aria-label="Parent menu"
      >
        <div className="parent-drawer-header">
          <div>
            <p className="lesson-kicker">Parent Menu</p>
            <h2>Settings and history</h2>
          </div>
          <button className="parent-drawer-close" type="button" onClick={onClose}>
            X
          </button>
        </div>
        <div className="parent-drawer-scroll">{children}</div>
      </aside>
    </>
  );
}
