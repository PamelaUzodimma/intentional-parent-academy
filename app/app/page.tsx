import Link from "next/link";

export default function ProductPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4">
        <p className="text-sm font-semibold tracking-wide text-brand-red">
          INTENTIONAL PARENT ACADEMY
        </p>
      </header>

      <section className="mx-auto max-w-md px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-900">7-in-1 Book Package</h1>
        <p className="mt-2 text-4xl font-extrabold text-brand-red">₦49,500</p>

        <p className="mt-6 text-gray-700 leading-relaxed">
          Seven books, one package — everything you need to guide your child's
          development through the Academy's yearly reading programme.
        </p>

        <div className="mt-8 rounded-xl border border-gray-100 bg-gray-50 p-5">
          <h2 className="font-semibold text-gray-900">What's inside</h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>• 7 books covering Level 1 &amp; Level 2 themes</li>
            <li>• Delivered by an Academy-approved distributor near you</li>
            <li>• Available to parents worldwide</li>
          </ul>
        </div>

        <div className="mt-6 rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900">How delivery works</h2>
          <p className="mt-2 text-sm text-gray-600">
            You'll choose your preferred distributor during checkout. Your
            books are shipped to them, and they deliver to you directly.
          </p>
        </div>

        <p className="mt-4 text-xs text-gray-400">
          Ordering for resale? Distributors use this same form — just select
          yourself as your own collection point.
        </p>

        <Link
          href="/order"
          className="mt-8 block w-full rounded-lg bg-brand-red py-4 text-center font-semibold text-white shadow-sm transition hover:bg-brand-red-dark"
        >
          Order Your Books
        </Link>
      </section>
    </main>
  );
}
