"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface TeamMember {
  id: string;
  email: string;
  role: "academy_admin" | "payment_verifier";
}

const VERIFIER_LIMIT = 5;

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("list_team");
    if (!error) setMembers((data as TeamMember[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const verifiers = members.filter((m) => m.role === "payment_verifier");
  const admins = members.filter((m) => m.role === "academy_admin");

  async function grantVerifier(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_role", {
      target_email: email,
      new_role: "payment_verifier",
    });
    if (error) {
      setError(error.message);
    } else {
      setEmail("");
      load();
    }
    setSubmitting(false);
  }

  async function revoke(id: string, currentEmail: string) {
    if (!window.confirm(`Remove verifier access for ${currentEmail}?`)) return;
    const supabase = createClient();
    await supabase.rpc("admin_set_role", {
      target_email: currentEmail,
      new_role: "parent",
    });
    load();
  }

  return (
    <main className="min-h-screen bg-white p-8">
      <h1 className="text-2xl font-bold text-gray-900">Team Access</h1>
      <p className="mt-1 text-sm text-gray-500">
        Manage who can verify payments. Full admins are managed directly in
        Supabase for now.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">
          Payment Verifiers ({verifiers.length}/{VERIFIER_LIMIT})
        </h2>
        <p className="text-sm text-gray-500">
          They can only access the Payments screen — nothing else in the backend.
        </p>

        {!loading && (
          <div className="mt-4 space-y-2">
            {verifiers.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3"
              >
                <span className="text-sm text-gray-900">{v.email}</span>
                <button
                  onClick={() => revoke(v.id, v.email)}
                  className="text-xs font-semibold text-danger hover:underline"
                >
                  Revoke
                </button>
              </div>
            ))}
            {verifiers.length === 0 && (
              <p className="text-sm text-gray-400">No verifiers granted yet.</p>
            )}
          </div>
        )}

        <form onSubmit={grantVerifier} className="mt-4 flex gap-2">
          <input
            type="email"
            required
            placeholder="Email of someone who's already signed up at /login"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-brand-red focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting || verifiers.length >= VERIFIER_LIMIT}
            className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Grant Access
          </button>
        </form>
        {verifiers.length >= VERIFIER_LIMIT && (
          <p className="mt-2 text-xs text-warning">
            Limit reached — revoke someone before adding another.
          </p>
        )}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">Full Admins</h2>
        <div className="mt-3 space-y-2">
          {admins.map((a) => (
            <div key={a.id} className="rounded-lg border border-gray-100 px-4 py-3 text-sm">
              {a.email}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
