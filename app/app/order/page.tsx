"use client";

import { useState } from "react";
import { StepIndicator } from "@/app/components/StepIndicator";
import { DistributorPicker } from "@/app/components/DistributorPicker";
import { UNIT_PRICE, type Distributor, type ParentInfo } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

const emptyParent: ParentInfo = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  whatsapp_number: "",
  country: "",
  state_region: "",
  city: "",
  delivery_address: "",
  postal_code: "",
  delivery_instructions: "",
};

interface BankAccount {
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: string;
}

function formatNaira(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

export default function OrderPage() {
  const [step, setStep] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [parent, setParent] = useState<ParentInfo>(emptyParent);
  const [distributor, setDistributor] = useState<Distributor | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set once the order + payment record exist (step 5)
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [claimed, setClaimed] = useState(false);

  const total = quantity * UNIT_PRICE;

  const canProceedFromInfo =
    parent.first_name &&
    parent.last_name &&
    parent.email &&
    parent.phone &&
    parent.country &&
    parent.delivery_address;

  async function handleCreateOrder() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity, parent, distributor_id: distributor?.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not create order. Please try again.");
      }
      const data = await res.json();
      setOrderId(data.order_id);
      setOrderNumber(data.order_number);
      setBankAccount(data.bank_account);
      setStep(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmTransfer() {
    if (!orderId) return;
    setSubmitting(true);
    setError(null);
    try {
      let proof_url: string | undefined;

      if (receiptFile) {
        const supabase = createClient();
        const path = `${orderNumber}/${receiptFile.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("payment-receipts")
          .upload(path, receiptFile, { upsert: true });
        if (uploadErr) throw new Error("Could not upload receipt. You can still confirm without it.");
        proof_url = path;
      }

      const res = await fetch("/api/orders/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, proof_url }),
      });
      if (!res.ok) throw new Error("Could not confirm payment. Please try again.");
      setClaimed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-6 py-8">
      <div className="mx-auto max-w-md">
        {step <= 4 && <StepIndicator current={step} />}

        {step === 1 && (
          <section>
            <h1 className="text-xl font-bold text-gray-900">How many packages?</h1>
            <div className="mt-6 flex items-center justify-center gap-6">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-12 w-12 rounded-full border border-gray-200 text-xl font-semibold text-gray-700"
              >
                −
              </button>
              <span className="w-10 text-center text-2xl font-bold">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="h-12 w-12 rounded-full border border-gray-200 text-xl font-semibold text-gray-700"
              >
                +
              </button>
            </div>
            <p className="mt-6 text-center text-lg font-semibold text-brand-red">
              {formatNaira(total)}
            </p>
            <button
              onClick={() => setStep(2)}
              className="mt-8 w-full rounded-lg bg-brand-red py-4 font-semibold text-white hover:bg-brand-red-dark"
            >
              Continue
            </button>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="text-xl font-bold text-gray-900">Your information</h1>
            <div className="mt-4 space-y-3">
              {(
                [
                  ["first_name", "First Name"],
                  ["last_name", "Last Name"],
                  ["email", "Email Address"],
                  ["phone", "Phone Number"],
                  ["whatsapp_number", "WhatsApp Number"],
                  ["country", "Country"],
                  ["state_region", "State / Province / Region"],
                  ["city", "City"],
                  ["delivery_address", "Delivery Address"],
                  ["postal_code", "Postal / ZIP Code (optional)"],
                  ["delivery_instructions", "Delivery Instructions (optional)"],
                ] as [keyof ParentInfo, string][]
              ).map(([field, label]) => (
                <input
                  key={field}
                  placeholder={label}
                  value={parent[field] ?? ""}
                  onChange={(e) => setParent({ ...parent, [field]: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-brand-red focus:outline-none"
                />
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 rounded-lg border border-gray-200 py-3 font-semibold text-gray-700"
              >
                Back
              </button>
              <button
                disabled={!canProceedFromInfo}
                onClick={() => setStep(3)}
                className="flex-1 rounded-lg bg-brand-red py-3 font-semibold text-white disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <h1 className="text-xl font-bold text-gray-900">
              Select your preferred distributor
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Your books will be shipped to them, and they&apos;ll deliver to you.
            </p>
            <div className="mt-4">
              <DistributorPicker
                parentCountry={parent.country}
                selected={distributor}
                onSelect={setDistributor}
              />
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-lg border border-gray-200 py-3 font-semibold text-gray-700"
              >
                Back
              </button>
              <button
                disabled={!distributor}
                onClick={() => setStep(4)}
                className="flex-1 rounded-lg bg-brand-red py-3 font-semibold text-white disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 4 && distributor && (
          <section>
            <h1 className="text-xl font-bold text-gray-900">Review your order</h1>

            <div className="mt-4 rounded-xl border border-gray-100 p-5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">7-in-1 Book Package</span>
                <span>Qty {quantity}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm text-gray-500">
                <span>Unit price</span>
                <span>{formatNaira(UNIT_PRICE)}</span>
              </div>
              <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 font-semibold">
                <span>Total</span>
                <span className="text-brand-red">{formatNaira(total)}</span>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-gray-100 p-5">
              <p className="text-xs font-semibold uppercase text-gray-400">
                Selected Distributor
              </p>
              <p className="mt-1 font-semibold text-gray-900">{distributor.name}</p>
              <p className="text-sm text-gray-600">
                {[distributor.city, distributor.state_region, distributor.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-gray-100 p-5">
              <p className="text-xs font-semibold uppercase text-gray-400">
                Delivery Location
              </p>
              <p className="mt-1 text-sm text-gray-900">
                {parent.delivery_address}, {[parent.city, parent.state_region, parent.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex-1 rounded-lg border border-gray-200 py-3 font-semibold text-gray-700"
              >
                Back
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={submitting}
                className="flex-1 rounded-lg bg-brand-red py-3 font-semibold text-white disabled:opacity-40"
              >
                {submitting ? "Please wait…" : "Confirm Order"}
              </button>
            </div>
          </section>
        )}

        {step === 5 && bankAccount && !claimed && (
          <section>
            <h1 className="text-xl font-bold text-gray-900">Complete your payment</h1>
            <p className="mt-1 text-sm text-gray-500">
              Order <span className="font-semibold">{orderNumber}</span> has been created.
              Transfer the amount below to complete it.
            </p>

            <div className="mt-4 rounded-xl border border-brand-red bg-brand-red-light p-5">
              <p className="text-xs font-semibold uppercase text-brand-red">Amount to Pay</p>
              <p className="mt-1 text-2xl font-bold text-brand-red">{formatNaira(total)}</p>
            </div>

            <div className="mt-4 space-y-3 rounded-xl border border-gray-100 p-5 text-sm">
              <Row label="Bank Name" value={bankAccount.bank_name} />
              <Row label="Account Name" value={bankAccount.account_name} />
              <Row label="Account Number" value={bankAccount.account_number} mono />
              <Row label="Transfer Reference" value={orderNumber ?? ""} mono highlight />
            </div>

            <div className="mt-4 rounded-lg bg-gray-50 p-4 text-xs text-gray-600">
              <strong>Important:</strong> Put <strong>{orderNumber}</strong> in the transfer
              narration/description. This is how the Academy matches your payment to your
              order — without it, verification will take longer.
            </div>

                        <div className="mt-5 rounded-lg border-2 border-brand-red/30 bg-red-50/50 p-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-gray-900">
                  Upload payment receipt
                </label>
                <span className="rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Recommended
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-600">
                Attaching your receipt or transfer screenshot helps the Academy verify your
                payment faster — often the same day instead of waiting for the next bank
                statement check.
              </p>
              
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                className="mt-3 w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-red file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-red/90 file:cursor-pointer"
              />
            </div>

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}

            <button
              onClick={handleConfirmTransfer}
              disabled={submitting}
              className="mt-6 w-full rounded-lg bg-brand-red py-4 font-semibold text-white disabled:opacity-40"
            >
              {submitting ? "Please wait…" : "I've Made the Transfer"}
            </button>
          </section>
        )}

        {step === 5 && claimed && (
          <section className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-red-light text-2xl text-brand-red">
              ✓
            </div>
            <h1 className="mt-4 text-xl font-bold text-gray-900">Payment submitted</h1>
            <p className="mt-2 text-sm text-gray-600">
              Order <span className="font-semibold">{orderNumber}</span> is awaiting
              verification against the Academy&apos;s bank statement. You&apos;ll be
              notified once it&apos;s confirmed.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span
        className={`font-semibold ${mono ? "font-mono" : ""} ${
          highlight ? "text-brand-red" : "text-gray-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
