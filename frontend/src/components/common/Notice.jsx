export default function Notice({ type = "error", children }) {
  if (!children) return null;
  return (
    <div
      className={`notice notice-${type}`}
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}
