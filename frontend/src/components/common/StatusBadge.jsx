export default function StatusBadge({ value }) {
  return <span className={`status status-${String(value).toLowerCase()}`}>{value}</span>;
}
