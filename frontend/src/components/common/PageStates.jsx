export function LoadingState({ label = "Loading..." }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <section className="empty-state" aria-live="polite">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </section>
  );
}
