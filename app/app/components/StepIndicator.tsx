const STEPS = ["Quantity", "Your Info", "Distributor", "Review"];

export function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center justify-between">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === current;
        const isDone = stepNum < current;
        return (
          <div key={label} className="flex flex-1 flex-col items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                isDone
                  ? "bg-brand-red text-white"
                  : isActive
                  ? "border-2 border-brand-red text-brand-red"
                  : "border-2 border-gray-200 text-gray-400"
              }`}
            >
              {isDone ? "✓" : stepNum}
            </div>
            <span
              className={`mt-1 text-[11px] ${
                isActive ? "font-semibold text-gray-900" : "text-gray-400"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
