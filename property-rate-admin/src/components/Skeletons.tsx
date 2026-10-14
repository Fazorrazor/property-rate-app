import {
  Building2,
  Users,
  MessageSquare,
  Landmark,
  ShieldCheck,
  Settings,
  Search,
  UploadCloud,
  Download,
  ChevronLeft,
  Plus,
  Calendar,
} from "lucide-react";

export function AdminDashboardSkeleton() {
  return (
    <div className="min-h-dvh w-full bg-[#F2F2F7] text-[#1C1C1E] flex flex-col lg:flex-row font-sans relative select-none">
      {/* 1. Static Sidebar Shell (Never Skeletonized) */}
      <aside className="w-56 xl:w-60 bg-white border-r border-[#E5E5EA] shadow-2xs flex-col shrink-0 hidden lg:flex font-sans z-30">
        {/* Assembly Brand Header */}
        <div className="h-13 flex items-center px-4 border-b border-[#E5E5EA] justify-between shrink-0 bg-[#F8F9FA]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-[#007AFF] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              H
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-[#007AFF] tracking-tight truncate">
                HEINZ Ltd.
              </span>
              <span className="text-[10px] text-[#6C6C70] font-medium leading-none truncate">
                Console
              </span>
            </div>
          </div>
        </div>

        {/* Municipality Selector Badge */}
        <div className="p-3 border-b border-[#E5E5EA] bg-[#F8F9FA]">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#6C6C70] mb-1 font-mono">
            Administrative Assembly
          </span>
          <div className="w-full text-xs font-semibold text-[#1C1C1E] bg-[#F2F2F7] border border-[#E5E5EA] rounded-md py-1.5 px-2.5">
            HEINZ INTEGRATED SYSTEMS LIMITED
          </div>
        </div>

        {/* Navigation Tabs (Fully rendered with icons and labels) */}
        <nav className="flex flex-col flex-1 px-3 py-3 gap-0.5 overflow-y-auto">
          {[
            { label: "Ratepayer Portfolios", icon: Users, active: true },
            { label: "Cadastre & Property Roll", icon: Building2, active: false },
            { label: "SMS Bill Rollout Engine", icon: MessageSquare, active: false },
            { label: "Treasury Reconciliation", icon: Landmark, active: false },
            { label: "System Audit Trail", icon: ShieldCheck, active: false },
            { label: "Settings & SMS Gateway", icon: Settings, active: false },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                className={`relative px-2.5 py-2 text-left text-xs transition-colors rounded-lg flex items-center justify-between min-h-[36px] ${
                  item.active
                    ? "bg-[#007AFF]/10 text-[#007AFF] font-semibold"
                    : "text-[#6C6C70]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      item.active ? "text-[#007AFF]" : "text-[#8E8E93]"
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.active && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#007AFF] shrink-0" />
                )}
              </div>
            );
          })}
        </nav>

        {/* User Identity Stamp */}
        <div className="p-3 border-t border-[#E5E5EA] bg-[#F8F9FA] shrink-0">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-md bg-[#F2F2F7] border border-[#E5E5EA] flex items-center justify-center font-bold text-xs text-[#1C1C1E] shrink-0">
              A
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-[#1C1C1E] truncate block">
                Municipal Admin
              </span>
              <span className="text-[10px] text-[#6C6C70] truncate block">
                HEINZ INTEGRATED SYSTEMS LIMITED
              </span>
            </div>
          </div>
          <div className="text-[11px] text-[#8E8E93] px-1">Sign Out</div>
        </div>
      </aside>

      {/* 2. Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 min-h-dvh lg:h-dvh lg:overflow-hidden">
        {/* Mobile Header Shell */}
        <header className="bg-white/80 border-b border-[#E5E5EA] px-4 h-13 flex items-center justify-between shrink-0 lg:hidden z-20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[#007AFF] text-white flex items-center justify-center font-bold text-xs">
              H
            </div>
            <span className="text-xs font-bold text-[#007AFF]">HEINZ Ltd.</span>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 min-h-0 w-full flex flex-col p-0 lg:px-6 lg:py-3 max-w-none lg:max-w-7xl lg:mx-auto gap-0 lg:gap-3 bg-[#F2F2F7] lg:bg-transparent lg:overflow-hidden pb-3">
          {/* Top KPI Cards (Labels static, dynamic metrics shimmer) */}
          <section aria-label="Executive KPIs" className="shrink-0 bg-white border-b border-[#E5E5EA] lg:border-b-0 lg:bg-transparent">
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-x-0 lg:divide-y-0 divide-[#E5E5EA] lg:gap-3">
              {/* Card 1: Total Assessed Demand */}
              <div className="p-3.5 sm:p-4 lg:p-3 lg:bg-white lg:border lg:border-[#E5E5EA] lg:rounded-xl flex items-center justify-between">
                <div className="min-w-0 pr-2 space-y-1.5">
                  <span className="text-[11px] text-[#6C6C70] font-medium block">
                    Total Assessed Demand
                  </span>
                  <div className="h-5 w-28 rounded-md vercel-skeleton" />
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <span className="text-[10px] text-[#6C6C70] block font-mono">FY 2025</span>
                  <div className="h-3 w-16 rounded vercel-skeleton ml-auto" />
                </div>
              </div>

              {/* Card 2: Revenue Collected */}
              <div className="p-3.5 sm:p-4 lg:p-3 lg:bg-white lg:border lg:border-[#E5E5EA] lg:rounded-xl flex items-center justify-between">
                <div className="min-w-0 pr-2 space-y-1.5">
                  <span className="text-[11px] text-[#6C6C70] font-medium block">
                    Revenue Collected
                  </span>
                  <div className="h-5 w-24 rounded-md vercel-skeleton" />
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <span className="text-[10px] text-[#6C6C70] block font-mono">Efficiency</span>
                  <div className="h-3 w-12 rounded vercel-skeleton ml-auto" />
                </div>
              </div>

              {/* Card 3: Cumulative Arrears */}
              <div className="p-3.5 sm:p-4 lg:p-3 lg:bg-white lg:border lg:border-[#E5E5EA] lg:rounded-xl flex items-center justify-between">
                <div className="min-w-0 pr-2 space-y-1.5">
                  <span className="text-[11px] text-[#6C6C70] font-medium block">
                    Cumulative Arrears
                  </span>
                  <div className="h-5 w-24 rounded-md vercel-skeleton" />
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <span className="text-[10px] text-[#6C6C70] block font-mono">Prior Debt</span>
                  <span className="text-[10px] text-[#6C6C70] block">Act 936</span>
                </div>
              </div>

              {/* Card 4: Accounts with Arrears */}
              <div className="p-3.5 sm:p-4 lg:p-3 lg:bg-white lg:border lg:border-[#E5E5EA] lg:rounded-xl flex items-center justify-between">
                <div className="min-w-0 pr-2 space-y-1.5">
                  <span className="text-[11px] text-[#6C6C70] font-medium block">
                    Accounts with Arrears
                  </span>
                  <div className="h-5 w-16 rounded-md vercel-skeleton" />
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <div className="h-3 w-16 rounded vercel-skeleton ml-auto" />
                  <span className="text-[10px] text-[#007AFF]">Inspect</span>
                </div>
              </div>
            </div>
          </section>

          {/* Master Cadastre Table Container */}
          <section className="bg-white border-b border-[#E5E5EA] lg:border lg:border-[#E5E5EA] rounded-none lg:rounded-xl shadow-none flex-1 min-h-0 flex flex-col overflow-hidden w-full">
            {/* Header & Filter Controls (Rendered immediately on Frame 1) */}
            <div className="p-3.5 border-b border-[#E5E5EA] space-y-2.5 shrink-0 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[#1C1C1E]">
                    Municipal Property Cadastre &amp; Valuation Roll
                  </h2>
                  <p className="text-xs text-[#6C6C70] mt-0.5">
                    Master register of municipal property accounts, GhanaPost GPS codes, and rating valuations
                  </p>
                </div>
                <div className="h-3.5 w-28 rounded vercel-skeleton hidden sm:block" />
              </div>

              {/* Toolbar Shell */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3 pt-2 border-t border-[#E5E5EA]">
                {/* Search Bar Shell */}
                <div className="relative flex items-center w-full lg:flex-1 lg:max-w-md">
                  <Search className="w-4 h-4 text-[#8E8E93] absolute left-3 pointer-events-none" />
                  <div className="w-full h-8 pl-9 pr-3 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-xs text-[#8E8E93] flex items-center">
                    Search by Account Number, GhanaPost GPS, Ratepayer, Phone...
                  </div>
                </div>

                {/* Filter & Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <div className="h-8 px-2.5 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-xs text-[#6C6C70] flex items-center">
                    All Property Classes
                  </div>
                  <div className="h-8 px-2.5 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-xs text-[#6C6C70] flex items-center">
                    All Statuses
                  </div>
                  <div className="apple-btn-primary h-8 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 opacity-80 pointer-events-none">
                    <span>+ Add Property</span>
                  </div>
                  <div className="apple-btn-secondary h-8 px-3 rounded-lg font-medium text-xs flex items-center gap-1.5 text-[#007AFF] opacity-80 pointer-events-none">
                    <UploadCloud className="w-3.5 h-3.5 text-[#007AFF]" />
                    <span>Import CSV</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Table Container with Static Column Headers & Shimmer Rows */}
            <div className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              <table className="hidden md:table table-fixed w-full text-left text-xs border-collapse">
                <thead className="bg-[#F8F9FA] border-b border-[#E5E5EA] text-[#6C6C70] font-semibold text-[11px] sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-8 bg-[#F8F9FA]">
                      <input
                        type="checkbox"
                        disabled
                        className="rounded border-[#C7C7CC] opacity-50"
                      />
                    </th>
                    <th className="py-2.5 px-3 w-[24%] bg-[#F8F9FA]">Account &amp; Cadastre</th>
                    <th className="py-2.5 px-3 w-[23%] bg-[#F8F9FA]">Ratepayer Particulars</th>
                    <th className="py-2.5 px-3 w-[15%] bg-[#F8F9FA]">Classification</th>
                    <th className="py-2.5 px-3 w-[13%] text-right bg-[#F8F9FA]">Rateable Value</th>
                    <th className="py-2.5 px-3 w-[14%] text-right bg-[#F8F9FA]">Assessment Due</th>
                    <th className="py-2.5 px-3 w-[11%] text-center bg-[#F8F9FA]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5EA] bg-white">
                  {[...Array(9)].map((_, i) => (
                    <tr key={i} className="hover:bg-[#F8F9FA] transition-colors">
                      <td className="py-2.5 px-3 text-center">
                        <div className="w-3.5 h-3.5 rounded border border-[#E5E5EA] bg-[#F2F2F7] mx-auto" />
                      </td>
                      <td className="py-2.5 px-3 space-y-1">
                        <div
                          className="h-3.5 rounded vercel-skeleton"
                          style={{ width: `${80 + (i % 3) * 20}px` }}
                        />
                        <div
                          className="h-2.5 rounded vercel-skeleton"
                          style={{ width: `${110 + (i % 4) * 15}px` }}
                        />
                      </td>
                      <td className="py-2.5 px-3 space-y-1">
                        <div
                          className="h-3.5 rounded vercel-skeleton"
                          style={{ width: `${95 + (i % 3) * 25}px` }}
                        />
                        <div
                          className="h-2.5 rounded vercel-skeleton"
                          style={{ width: `${75 + (i % 2) * 20}px` }}
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <div
                          className="h-3 rounded vercel-skeleton"
                          style={{ width: `${60 + (i % 3) * 15}px` }}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div
                          className="h-3.5 rounded vercel-skeleton ml-auto"
                          style={{ width: `${55 + (i % 3) * 15}px` }}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right space-y-1">
                        <div
                          className="h-3.5 rounded vercel-skeleton ml-auto"
                          style={{ width: `${65 + (i % 2) * 15}px` }}
                        />
                        <div
                          className="h-2.5 rounded vercel-skeleton ml-auto"
                          style={{ width: `${45 + (i % 3) * 10}px` }}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="h-3.5 w-12 rounded vercel-skeleton mx-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile View Shimmer Tiles (< 768px) */}
              <div className="block md:hidden divide-y divide-[#E5E5EA] bg-white">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="px-3.5 py-3 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-4 h-4 rounded border border-[#E5E5EA] bg-[#F2F2F7] shrink-0" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="h-3.5 w-28 rounded vercel-skeleton" />
                        <div className="h-2.5 w-36 rounded vercel-skeleton" />
                      </div>
                    </div>
                    <div className="space-y-1 text-right shrink-0">
                      <div className="h-3.5 w-16 rounded vercel-skeleton ml-auto" />
                      <div className="h-2.5 w-10 rounded vercel-skeleton ml-auto" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export function SmsRolloutSkeleton() {
  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-white border-0 overflow-hidden font-sans select-none animate-pulse">
      {/* Top Banner Toolbar Skeleton */}
      <div className="p-3 border-b border-[#E5E5EA] bg-[#F8F9FA] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-5 w-40 bg-[#E5E5EA] rounded" />
          <div className="h-4 w-24 bg-[#E5E5EA] rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-[#E5E5EA] rounded-lg" />
          <div className="h-8 w-28 bg-[#E5E5EA] rounded-lg" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="px-4 py-2.5 bg-white border-b border-[#E5E5EA] flex items-center justify-between">
          <div className="h-4 w-48 bg-[#E5E5EA] rounded" />
          <div className="h-4 w-28 bg-[#E5E5EA] rounded" />
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#F8F9FA] border-b border-[#E5E5EA]">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center"><div className="w-3.5 h-3.5 bg-[#E5E5EA] rounded mx-auto" /></th>
                <th className="py-2.5 px-3 w-[18%]"><div className="h-3 w-24 bg-[#E5E5EA] rounded" /></th>
                <th className="py-2.5 px-3 w-[20%]"><div className="h-3 w-28 bg-[#E5E5EA] rounded" /></th>
                <th className="py-2.5 px-3 w-[16%]"><div className="h-3 w-20 bg-[#E5E5EA] rounded" /></th>
                <th className="py-2.5 px-3 w-[14%]"><div className="h-3 w-18 bg-[#E5E5EA] rounded" /></th>
                <th className="py-2.5 px-3 w-[16%] text-right"><div className="h-3 w-20 bg-[#E5E5EA] rounded ml-auto" /></th>
                <th className="py-2.5 px-3 w-[16%] text-right"><div className="h-3 w-24 bg-[#E5E5EA] rounded ml-auto" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5EA] bg-white">
              {Array.from({ length: 9 }).map((_, i) => (
                <tr key={`sms-skel-${i}`}>
                  <td className="py-2.5 px-3 text-center"><div className="w-3.5 h-3.5 bg-[#E5E5EA] rounded mx-auto" /></td>
                  <td className="py-2.5 px-3 space-y-1"><div className="h-3.5 w-24 bg-[#E5E5EA] rounded" /><div className="h-2.5 w-32 bg-[#F2F2F7] rounded" /></td>
                  <td className="py-2.5 px-3 space-y-1"><div className="h-3.5 w-28 bg-[#E5E5EA] rounded" /><div className="h-2.5 w-20 bg-[#F2F2F7] rounded" /></td>
                  <td className="py-2.5 px-3"><div className="h-3.5 w-20 bg-[#E5E5EA] rounded" /></td>
                  <td className="py-2.5 px-3"><div className="h-3.5 w-16 bg-[#E5E5EA] rounded" /></td>
                  <td className="py-2.5 px-3 text-right"><div className="h-3.5 w-18 bg-[#E5E5EA] rounded ml-auto" /></td>
                  <td className="py-2.5 px-3 text-right"><div className="h-3.5 w-20 bg-[#E5E5EA] rounded ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden bg-white font-sans border-0 rounded-none shadow-none select-none animate-pulse">
      {/* Studio Header Toolbar Skeleton */}
      <div className="px-4 lg:px-6 py-3.5 border-b border-[#E5E5EA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-white">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="h-4 w-48 bg-[#E5E5EA] rounded" />
            <div className="h-3.5 w-32 bg-[#F2F2F7] rounded" />
          </div>
          <div className="h-3 w-72 bg-[#F2F2F7] rounded" />
        </div>
        <div className="h-6 w-48 bg-[#F2F2F7] rounded" />
      </div>

      {/* Flat Studio Workspace Body Skeleton */}
      <div className="w-full flex-1 min-h-0 overflow-y-auto bg-white divide-y divide-[#E5E5EA]">
        {/* Section 1: Outbound SMS Mode */}
        <div className="px-4 lg:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-1.5">
            <div className="h-4 w-36 bg-[#E5E5EA] rounded" />
            <div className="h-3 w-56 bg-[#F2F2F7] rounded" />
          </div>
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="h-24 bg-[#F8F9FA] border border-[#E5E5EA] rounded-xl" />
            <div className="h-24 bg-[#F8F9FA] border border-[#E5E5EA] rounded-xl" />
          </div>
        </div>

        {/* Section 2: Gateway Credentials */}
        <div className="px-4 lg:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-1.5">
            <div className="h-4 w-40 bg-[#E5E5EA] rounded" />
            <div className="h-3 w-60 bg-[#F2F2F7] rounded" />
          </div>
          <div className="lg:col-span-8 space-y-4 max-w-2xl">
            <div className="h-9 bg-[#F8F9FA] border border-[#E5E5EA] rounded-lg" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-9 bg-[#F8F9FA] border border-[#E5E5EA] rounded-lg" />
              <div className="h-9 bg-[#F8F9FA] border border-[#E5E5EA] rounded-lg" />
            </div>
            <div className="flex justify-between pt-2">
              <div className="h-9 w-40 bg-[#F8F9FA] border border-[#E5E5EA] rounded-lg" />
              <div className="h-9 w-32 bg-[#E5E5EA] rounded-lg" />
            </div>
          </div>
        </div>

        {/* Section 3: Carrier Protocols */}
        <div className="px-4 lg:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-1.5">
            <div className="h-4 w-36 bg-[#E5E5EA] rounded" />
            <div className="h-3 w-64 bg-[#F2F2F7] rounded" />
          </div>
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="h-20 bg-[#F8F9FA] border border-[#E5E5EA] rounded-lg" />
            <div className="h-20 bg-[#F8F9FA] border border-[#E5E5EA] rounded-lg" />
            <div className="h-20 bg-[#F8F9FA] border border-[#E5E5EA] rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton matching View 1: Ratepayer Accounts Directory (when NO user is selected)
 */
export function PaymentsDirectorySkeleton() {
  return (
    <div className="w-full flex-1 min-h-0 flex flex-col gap-2.5 sm:gap-3 p-3 sm:px-6 lg:px-8 sm:py-3 overflow-hidden select-none animate-pulse">
      {/* 1. Static Search Toolbar Shell */}
      <div className="w-full bg-white border border-[#E8E8ED] rounded-[14px] px-3.5 py-3 sm:px-5 sm:py-3.5 shadow-xs shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8E8E93]" />
            <div className="w-full pl-9 pr-8 py-2 bg-[#F5F5F7] border border-[#E8E8ED] rounded-xl text-xs text-[#8E8E93] flex items-center">
              Search ratepayer accounts, names, phones...
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          <div className="h-4 w-32 bg-[#E5E5EA] rounded" />
        </div>
      </div>

      {/* 2. Standalone Table & Mobile List Container */}
      <div className="w-full flex-1 min-h-0 bg-white border border-[#E8E8ED] rounded-[14px] shadow-xs flex flex-col overflow-hidden relative">
        <div className="w-full flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col">
          {/* Desktop Table Headers */}
          <table className="hidden sm:table w-full text-left border-collapse min-w-[760px]">
            <thead className="bg-[#F9F9FB] text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider sticky top-0 z-10 border-b border-[#E8E8ED]">
              <tr>
                <th className="py-2.5 px-4 lg:px-6">Account No &amp; Name</th>
                <th className="py-2.5 px-4">Telephone &amp; Address</th>
                <th className="py-2.5 px-4">Classification</th>
                <th className="py-2.5 px-4 text-right">Outstanding Balance</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 lg:px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8ED]">
              {Array.from({ length: 7 }).map((_, i) => (
                <tr key={`dir-skel-${i}`}>
                  <td className="py-3 px-4 lg:px-6 space-y-1">
                    <div className="h-3.5 w-24 bg-[#E5E5EA] rounded" />
                    <div className="h-4 w-36 bg-[#F2F2F7] rounded" />
                  </td>
                  <td className="py-3 px-4 space-y-1">
                    <div className="h-3.5 w-28 bg-[#E5E5EA] rounded" />
                    <div className="h-3 w-40 bg-[#F2F2F7] rounded" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-3.5 w-20 bg-[#E5E5EA] rounded" />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="h-4 w-20 bg-[#E5E5EA] rounded ml-auto" />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="h-3.5 w-14 bg-[#E5E5EA] rounded mx-auto" />
                  </td>
                  <td className="py-3 px-4 lg:px-6 text-right">
                    <div className="h-3.5 w-16 bg-[#007AFF]/20 rounded ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Tiles (< 640px) */}
          <div className="block sm:hidden divide-y divide-[#E8E8ED]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`dir-mob-skel-${i}`} className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 bg-[#E5E5EA] rounded" />
                  <div className="h-4 w-16 bg-[#E5E5EA] rounded" />
                </div>
                <div className="h-4 w-36 bg-[#F2F2F7] rounded" />
                <div className="flex items-center justify-between pt-1">
                  <div className="h-3.5 w-28 bg-[#F2F2F7] rounded" />
                  <div className="h-3.5 w-14 bg-[#007AFF]/20 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton matching View 2: Account Payments Ledger (when a user IS selected)
 */
export function PaymentsUserRecordsSkeleton() {
  return (
    <div className="w-full flex-1 min-h-0 flex flex-col gap-2.5 sm:gap-3 p-3 sm:px-6 lg:px-8 sm:py-3 overflow-hidden select-none animate-pulse">
      {/* Top Standalone Card: Apple Navigation & Profile Summary */}
      <div className="w-full bg-white border border-[#E8E8ED] rounded-2xl p-3.5 sm:p-5 shadow-xs shrink-0 space-y-3.5">
        {/* iOS Level 1: Navigation Link & Action Bar */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-1 text-[13px] font-semibold text-[#007AFF] opacity-80">
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Back</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-lg bg-[#007AFF]/30 text-transparent font-semibold text-xs flex items-center gap-1.5 min-h-[38px] w-28" />
        </div>

        {/* iOS Level 2: Biodata & Metrics Card (Reduced Height ~12%) */}
        <div className="relative bg-[#FAFAFC] border border-[#E8E8ED] rounded-xl p-3 sm:px-4 sm:py-3 flex flex-col gap-2.5">
          {/* Floated redirect icon placeholder */}
          <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 w-5 h-5 bg-[#E5E5EA] rounded" />

          {/* Ratepayer Biodata Header */}
          <div className="space-y-1.5 pr-12 sm:pr-24">
            <div className="h-4 sm:h-4.5 w-48 bg-[#E5E5EA] rounded" />
            <div className="h-3 w-36 bg-[#F2F2F7] rounded" />
          </div>

          <div className="border-t border-[#E8E8ED]" />

          {/* Financial Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:gap-6 items-start">
            <div className="space-y-1">
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block">
                Outstanding balance
              </span>
              <div className="h-5 sm:h-5.5 w-24 bg-[#E5E5EA] rounded" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block">
                Total paid
              </span>
              <div className="h-5 sm:h-5.5 w-28 bg-[#E5E5EA] rounded" />
              <div className="h-2.5 w-36 bg-[#F2F2F7] rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Standalone Payments Ledger Card Container */}
      <div className="w-full flex-1 min-h-0 bg-white border border-[#E8E8ED] rounded-[14px] shadow-xs flex flex-col overflow-hidden relative">
        {/* Channel Filter Tabs */}
        <div className="flex items-center gap-5 sm:gap-7 px-4 pt-2.5 border-b border-[#E8E8ED] shrink-0 text-xs font-semibold bg-[#FAFAFC]">
          <span className="pb-2.5 text-[#007AFF] font-bold border-b-2 border-[#007AFF]">All</span>
          <span className="pb-2.5 text-[#8E8E93]">Online</span>
          <span className="pb-2.5 text-[#8E8E93]">In-person</span>
        </div>

        {/* Ledger Table & Cards */}
        <div className="w-full flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col">
          <table className="hidden sm:table w-full text-left border-collapse min-w-[760px]">
            <thead className="bg-[#F9F9FB] text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider sticky top-0 z-10 border-b border-[#E8E8ED]">
              <tr>
                <th className="py-2.5 px-4 lg:px-6">Date &amp; Time</th>
                <th className="py-2.5 px-4">Receipt / GCR No</th>
                <th className="py-2.5 px-4">Channel</th>
                <th className="py-2.5 px-4">Payment Method</th>
                <th className="py-2.5 px-4 text-right">Amount Paid</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 lg:px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8ED]">
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={`rec-skel-${i}`}>
                  <td className="py-3 px-4 lg:px-6"><div className="h-3.5 w-24 bg-[#E5E5EA] rounded" /></td>
                  <td className="py-3 px-4"><div className="h-3.5 w-20 bg-[#E5E5EA] rounded font-mono" /></td>
                  <td className="py-3 px-4"><div className="h-3.5 w-16 bg-[#E5E5EA] rounded" /></td>
                  <td className="py-3 px-4"><div className="h-3.5 w-14 bg-[#E5E5EA] rounded" /></td>
                  <td className="py-3 px-4 text-right"><div className="h-4 w-20 bg-[#E5E5EA] rounded ml-auto" /></td>
                  <td className="py-3 px-4 text-center"><div className="h-3.5 w-16 bg-[#E5E5EA] rounded mx-auto" /></td>
                  <td className="py-3 px-4 lg:px-6 text-right"><div className="h-3.5 w-14 bg-[#007AFF]/20 rounded ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Tiles (< 640px) */}
          <div className="block sm:hidden divide-y divide-[#E8E8ED]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`rec-mob-skel-${i}`} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-20 bg-[#E5E5EA] rounded" />
                  <div className="h-3.5 w-16 bg-[#E5E5EA] rounded" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-28 bg-[#F2F2F7] rounded" />
                  <div className="h-3.5 w-14 bg-[#F2F2F7] rounded" />
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[#F5F5F7]">
                  <div className="h-4 w-24 bg-[#E5E5EA] rounded" />
                  <div className="h-3.5 w-16 bg-[#007AFF]/20 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton matching Officer Statement View (when statements are loading)
 */
export function StatementsViewSkeleton() {
  return (
    <div className="w-full flex-1 min-h-0 flex flex-col p-3 sm:px-6 lg:px-8 sm:py-3 gap-3 overflow-hidden select-none animate-pulse">
      {/* 1. Statement Controls / Summary Header Bar */}
      <div className="w-full bg-white border border-[#E8E8ED] rounded-xl p-3 sm:px-4 sm:py-3 shadow-xs shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="h-4 sm:h-5 w-44 bg-[#E5E5EA] rounded" />
          <div className="h-3 w-32 bg-[#F2F2F7] rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 bg-[#E5E5EA] rounded-lg" />
          <div className="h-8 w-24 bg-[#007AFF]/20 rounded-lg" />
        </div>
      </div>

      {/* 2. Financial Overview KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 shrink-0">
        <div className="bg-white border border-[#E8E8ED] rounded-xl p-3 space-y-1">
          <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider block">Total Billed</span>
          <div className="h-5 w-24 bg-[#E5E5EA] rounded" />
        </div>
        <div className="bg-white border border-[#E8E8ED] rounded-xl p-3 space-y-1">
          <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider block">Total Paid</span>
          <div className="h-5 w-24 bg-[#E5E5EA] rounded" />
        </div>
        <div className="bg-white border border-[#E8E8ED] rounded-xl p-3 space-y-1">
          <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider block">Balance Due</span>
          <div className="h-5 w-24 bg-[#E5E5EA] rounded" />
        </div>
      </div>

      {/* 3. Statement Ledger Table Container */}
      <div className="w-full flex-1 min-h-0 bg-white border border-[#E8E8ED] rounded-xl shadow-xs flex flex-col overflow-hidden">
        <div className="p-3 border-b border-[#E8E8ED] flex items-center justify-between bg-[#F9F9FB]">
          <div className="h-4 w-36 bg-[#E5E5EA] rounded" />
          <div className="h-3.5 w-20 bg-[#E5E5EA] rounded" />
        </div>
        <div className="w-full flex-1 min-h-0 overflow-y-auto no-scrollbar p-3 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`stmt-skel-${i}`} className="p-2.5 border border-[#F2F2F7] rounded-lg flex items-center justify-between">
              <div className="space-y-1">
                <div className="h-3.5 w-24 bg-[#E5E5EA] rounded" />
                <div className="h-3 w-40 bg-[#F2F2F7] rounded" />
              </div>
              <div className="h-4 w-20 bg-[#E5E5EA] rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

