import Link from "next/link";
import type { ReactNode } from "react";

const dashboardTabs = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/geofences", label: "Geofences" },
  { href: "/dashboard/vehicles", label: "Vehicles" },
  { href: "/dashboard/alerts", label: "Alerts" },
  { href: "/dashboard/violations", label: "Violations" },
] as const;

export function AssessmentShell({
  activeTab,
  title,
  description,
  children,
}: {
  activeTab: (typeof dashboardTabs)[number]["href"];
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#214229_0%,#0a120b_35%,#040605_100%)] px-4 py-8 text-[#eef6ec] sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="rounded-[32px] border border-white/10 bg-white/6 p-8 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.35em] text-[#a4d8a0]">
                Control Center
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
                {description}
              </p>
            </div>

            <nav className="flex flex-wrap gap-3">
              {dashboardTabs.map((tab) => {
                const isActive = tab.href === activeTab;

                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={
                      isActive
                        ? "rounded-full bg-[#a6ff85] px-4 py-2 text-sm font-semibold text-[#061108]"
                        : "rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/72 transition hover:bg-white/10"
                    }
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}

export { AssessmentShell as DashboardShell };

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[32px] border border-white/10 bg-white/6 p-8 ${className}`}>
      {children}
    </section>
  );
}

export function SectionHeading({ title }: { title: string }) {
  return <p className="text-sm uppercase tracking-[0.32em] text-[#a4d8a0]">{title}</p>;
}

export function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "mint" | "gold" | "slate";
}) {
  return (
    <div
      className={[
        "rounded-[28px] border p-5",
        accent === "mint" ? "border-[#aeff9d2c] bg-[#b3ff9f12]" : "",
        accent === "gold" ? "border-[#ffc4742c] bg-[#ffc47412]" : "",
        accent === "slate" ? "border-white/10 bg-white/6" : "",
      ].join(" ")}
    >
      <p className="text-sm text-white/55">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">{value}</p>
    </div>
  );
}

export function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label>
      <span className="text-sm text-white/70">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-[#aeff9d66]"
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label>
      <span className="text-sm text-white/70">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-[#aeff9d66]"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value} className="bg-[#09110a]">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 7,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <label>
      <span className="text-sm text-white/70">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-[#aeff9d66]"
      />
    </label>
  );
}

export function PrimaryButton({
  children,
  className = "",
  disabled,
  type = "submit",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl bg-[#a6ff85] px-4 py-3 text-sm font-semibold text-[#061108] transition hover:bg-[#c4ff9d] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-white/12 bg-black/15 p-6">
      <p className="text-base font-medium text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/62">{description}</p>
    </div>
  );
}

export function formatCategory(category: string) {
  return category.replaceAll("_", " ");
}

export function categoryTone(category: string) {
  switch (category) {
    case "restricted_zone":
      return "bg-[#ff8b7d24] text-[#ffb0a6]";
    case "toll_zone":
      return "bg-[#ffd36b24] text-[#ffd36b]";
    case "customer_area":
      return "bg-[#7dd3fc24] text-[#7dd3fc]";
    default:
      return "bg-[#aeff9d24] text-[#d9ff7a]";
  }
}
