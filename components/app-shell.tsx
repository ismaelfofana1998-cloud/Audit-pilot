import Link from "next/link";
import type { ReactNode } from "react";
import { chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { TenantSwitcher } from "@/components/tenant-switcher";
import { GlobalSearch } from "@/components/global-search";
import { requirePageActor } from "@/lib/server/core";

const navigation = [
  { href: "/", label: "Vue d’ensemble", icon: "⌂", key: "dashboard" },
  { href: "/missions", label: "Missions", icon: "▣", key: "missions" },
  { href: "/planning", label: "Planning", icon: "□", key: "planning" },
  { href: "/demandes", label: "Demandes", icon: "≡", key: "requests" },
  {
    href: "/circularisations",
    label: "Circularisations",
    icon: "↻",
    key: "circularisations",
  },
  { href: "/equipe", label: "Équipe", icon: "♙", key: "team" },
  { href: "/tenant", label: "Cabinet & rôles", icon: "⚙", key: "tenant" },
];

export async function AppShell({
  children,
  active,
  title,
}: {
  children: ReactNode;
  active: string;
  title: string;
}) {
  const actor = await requirePageActor();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Audit Pilot — accueil">
          <span className="brand-mark" aria-hidden="true">
            AP
          </span>
          <span>Audit Pilot</span>
        </Link>

        <nav className="primary-nav" aria-label="Navigation principale">
          {navigation.map((item) => (
            <Link
              className={`nav-item ${active === item.key ? "is-active" : ""}`}
              href={item.href}
              key={item.key}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="secure-dot" aria-hidden="true" />
          Espace sécurisé
        </div>
      </aside>

      <div className="app-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">{actor.tenantName}</p>
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">
            <GlobalSearch />
            <TenantSwitcher
              activeTenantId={actor.tenantId}
              tenants={actor.tenants}
            />
            <Link className="notification-button" href="/#actions" aria-label="Voir les actions prioritaires">
              <span aria-hidden="true">♢</span>
            </Link>
            <Link
              className="user-chip"
              href={chatGPTSignOutPath("/")}
              title={`${actor.fullName} — Se déconnecter`}
              aria-label={`${actor.fullName} — Se déconnecter`}
            >
              {actor.initials}
            </Link>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
