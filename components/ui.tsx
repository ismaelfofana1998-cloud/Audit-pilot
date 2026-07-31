import type { ReactNode } from "react";

export function Avatar({
  initials,
  tone = "ink",
  size = "normal",
}: {
  initials: string;
  tone?: "ink" | "teal" | "blue" | "sand" | "plum";
  size?: "small" | "normal";
}) {
  return (
    <span className={`avatar avatar-${tone} avatar-${size}`} aria-hidden="true">
      {initials}
    </span>
  );
}

export function Person({
  initials,
  name,
  role,
  tone = "ink",
}: {
  initials: string;
  name: string;
  role?: string;
  tone?: "ink" | "teal" | "blue" | "sand" | "plum";
}) {
  return (
    <span className="person">
      <Avatar initials={initials} tone={tone} size="small" />
      <span>
        <strong>{name}</strong>
        {role ? <small>{role}</small> : null}
      </span>
    </span>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

export function MetricCard({
  icon,
  value,
  label,
  detail,
  tone,
}: {
  icon: string;
  value: string;
  label: string;
  detail: string;
  tone: "teal" | "orange" | "blue" | "green";
}) {
  return (
    <article className="metric-card">
      <span className={`metric-icon metric-${tone}`} aria-hidden="true">
        {icon}
      </span>
      <div>
        <strong className="metric-value">{value}</strong>
        <p>{label}</p>
        <small>{detail}</small>
      </div>
    </article>
  );
}
