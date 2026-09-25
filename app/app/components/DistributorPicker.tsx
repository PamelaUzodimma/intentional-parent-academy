"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Distributor } from "@/lib/types";

export function DistributorPicker({
  parentCountry,
  selected,
  onSelect,
}: {
  parentCountry: string;
  selected: Distributor | null;
  onSelect: (d: Distributor) => void;
}) {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("distributors")
      .select("id, name, business_name, country, state_region, city, status")
      .eq("status", "active")
      .then(({ data }) => {
        setDistributors((data as Distributor[]) ?? []);
        setLoading(false);
      });
  }, []);

  // Parent's own country floats to the top, but nothing is hidden —
  // the system organizes, it never silently filters out a choice (PRD §13).
  const sorted = useMemo(() => {
    const filtered = distributors.filter((d) => {
      const q = query.toLowerCase();
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.city?.toLowerCase().includes(q) ||
        d.state_region?.toLowerCase().includes(q) ||
        d.country.toLowerCase().includes(q)
      );
    });
    return [...filtered].sort((a, b) => {
      const aMatch = a.country === parentCountry ? 0 : 1;
      const bMatch = b.country === parentCountry ? 0 : 1;
      return aMatch - bMatch;
    });
  }, [distributors, query, parentCountry]);

  if (loading) {
    return <p className="text-sm text-gray-500">Loading distributors…</p>;
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Search by name, city, or country"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-brand-red focus:outline-none"
      />

      <div className="space-y-3">
        {sorted.map((d) => {
          const isSelected = selected?.id === d.id;
          return (
            <button
              key={d.id}
              onClick={() => onSelect(d)}
              className={`w-full rounded-xl border p-4 text-left transition ${
                isSelected
                  ? "border-brand-red bg-brand-red-light"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{d.name}</p>
                  {d.business_name && (
                    <p className="text-xs text-gray-500">{d.business_name}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-600">
                    📍 {[d.city, d.state_region, d.country].filter(Boolean).join(", ")}
                  </p>
                </div>
                {isSelected && (
                  <span className="rounded-full bg-brand-red px-2 py-1 text-xs font-semibold text-white">
                    ✓ Selected
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {sorted.length === 0 && (
          <p className="text-sm text-gray-500">No distributors match your search.</p>
        )}
      </div>
    </div>
  );
}
