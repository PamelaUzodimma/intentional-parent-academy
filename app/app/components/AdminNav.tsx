"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

export default function AdminNav({ links }: { links: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {links.map(({ href, label }) => {
        const active =
          href === "/admin"
            ? pathname === "/admin"
            : pathname === href || pathname.startsWith(href + "/");

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
             ? "bg-brand-red-light text-brand-red"
            : "text-gray-700 hover:bg-brand-red-light hover:text-brand-red"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}