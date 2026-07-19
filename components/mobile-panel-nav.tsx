"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/painel", label: "Início", icon: "⌂", exact: true },
  { href: "/painel/agenda", label: "Agenda", icon: "▣" },
  { href: "/painel/agendamentos", label: "Novo agendamento", icon: "+" },
  { href: "/painel/lembretes", label: "Lembretes", icon: "◇" },
  { href: "/painel/mais", label: "Mais opções", icon: "•••" },
];

export function MobilePanelNav() {
  const pathname = usePathname();

  return (
    <nav className="mobile-nav mobile-nav-icons" aria-label="Navegação principal do painel">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);

        return (
          <Link
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={active ? "mobile-nav-item active" : "mobile-nav-item"}
            href={item.href}
            key={item.href}
            title={item.label}
          >
            <span aria-hidden="true">{item.icon}</span>
          </Link>
        );
      })}

      <style jsx>{`
        .mobile-nav-icons {
          align-items: center;
        }

        .mobile-nav-item {
          width: 48px;
          height: 48px;
          margin: 0 auto;
          padding: 0 !important;
          display: grid;
          place-items: center;
          border: 1px solid transparent;
          border-radius: 15px;
          color: var(--muted);
          transition: color .2s ease, border-color .2s ease, background .2s ease, box-shadow .2s ease, transform .2s ease;
        }

        .mobile-nav-item span {
          display: grid;
          place-items: center;
          min-width: 25px;
          font-size: 27px;
          line-height: 1;
          font-weight: 800;
        }

        .mobile-nav-item:hover {
          color: var(--primary);
          background: color-mix(in srgb, var(--primary) 8%, transparent);
        }

        .mobile-nav-item.active {
          color: var(--primary);
          border-color: color-mix(in srgb, var(--primary) 88%, white 12%);
          background: color-mix(in srgb, var(--primary) 12%, var(--surface));
          box-shadow:
            0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent),
            0 0 18px color-mix(in srgb, var(--primary) 55%, transparent),
            0 8px 22px color-mix(in srgb, var(--primary) 24%, transparent);
          transform: translateY(-3px);
        }

        @media (min-width: 901px) {
          .mobile-nav-icons {
            display: none;
          }
        }

        @media (max-width: 390px) {
          .mobile-nav-item {
            width: 44px;
            height: 44px;
          }

          .mobile-nav-item span {
            font-size: 24px;
          }
        }
      `}</style>
    </nav>
  );
}
