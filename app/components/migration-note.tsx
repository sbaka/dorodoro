type MigrationNoteProps = {
  title: string;
  children: React.ReactNode;
};

export function MigrationNote({ title, children }: MigrationNoteProps) {
  return (
    <aside className="migration-note" aria-label="Migration status">
      <p className="migration-note-label">Migration in progress</p>
      <h2>{title}</h2>
      <p>{children}</p>
    </aside>
  );
}