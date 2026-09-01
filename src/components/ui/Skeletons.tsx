import { Skeleton } from "./Skeleton";

// Used for general property cards
export function PropertyCardSkeleton() {
  return (
    <div className="bg-white p-5 rounded-2xl border border-[#DADCE0] shadow-sm flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#F1F3F4]">
        <div className="flex items-center gap-2">
          <Skeleton className="w-4 h-4 rounded" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-2 w-24" />
          </div>
        </div>
        <Skeleton className="h-3 w-16" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Skeleton className="h-2 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-2 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="col-span-2 pt-2 border-t border-[#F1F3F4] space-y-1">
          <Skeleton className="h-2 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 flex flex-col gap-3.5 border-t border-[#DADCE0]/60">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <main className="min-h-screen bg-[#F6ECF2] flex flex-col pb-[88px] px-4 sm:px-5 max-w-md mx-auto w-full font-sans gap-3.5">
      {/* Sticky App Bar Mock */}
      <div className="sticky top-0 pt-4 sm:pt-5 shrink-0 z-20 bg-[#F6ECF2]/95 backdrop-blur-md -mx-4 px-4 sm:-mx-5 sm:px-5 pb-2 shadow-sm border-b border-[#DADCE0]/50">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-6" />
            <div className="border-l border-[#DADCE0] pl-3 space-y-1">
              <Skeleton className="w-24 h-3.5" />
              <Skeleton className="w-32 h-2.5" />
            </div>
          </div>
          <Skeleton className="w-8 h-8 rounded-full" />
        </header>
      </div>

      {/* Main Assessment */}
      <div className="px-1 space-y-3.5 mt-2">
        <div className="flex items-center justify-between">
          <Skeleton className="w-32 h-3" />
          <Skeleton className="w-24 h-3" />
        </div>
        <div className="flex items-center justify-between pb-3 border-b border-[#DADCE0]/50">
          <div className="space-y-1">
            <Skeleton className="w-32 h-3" />
            <Skeleton className="w-32 h-8" />
          </div>
          <Skeleton className="w-24 h-5 mt-3" />
        </div>
      </div>

      {/* Cards List */}
      <div className="flex flex-col space-y-3 mt-2">
        <div className="flex items-center justify-between px-1">
          <Skeleton className="w-32 h-3" />
          <Skeleton className="w-12 h-3" />
        </div>
        <div className="flex flex-col gap-4 mt-2">
          <PropertyCardSkeleton />
          <PropertyCardSkeleton />
        </div>
      </div>
    </main>
  );
}

export function PropertiesSkeleton() {
  return (
    <main className="relative flex-1 min-h-screen bg-[#F6ECF2] p-4 sm:p-5 max-w-md mx-auto w-full pb-36 font-sans space-y-4 pt-2">
      <header className="sticky top-0 z-20 bg-[#F6ECF2]/95 backdrop-blur-md -mx-4 px-4 sm:-mx-5 sm:px-5 pt-2 pb-3 space-y-3 border-b border-[#DADCE0]/60 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-6" />
            <div className="border-l border-[#DADCE0] pl-3 space-y-1">
              <Skeleton className="w-20 h-3.5" />
              <Skeleton className="w-32 h-2.5" />
            </div>
          </div>
        </div>
        <div className="w-full">
          <Skeleton className="w-full h-11 rounded-xl" />
        </div>
      </header>
      
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="w-24 h-3" />
          <Skeleton className="w-8 h-4 rounded" />
        </div>
        <div className="space-y-4 mt-2 relative z-0">
          <PropertyCardSkeleton />
          <PropertyCardSkeleton />
          <PropertyCardSkeleton />
        </div>
      </div>
    </main>
  );
}

export function ReceiptsSkeleton() {
  return (
    <main className="relative flex-1 min-h-screen bg-[#F6ECF2] p-4 sm:p-5 pb-24 max-w-md mx-auto w-full font-sans space-y-3 pt-2">
      <div className="sticky top-0 z-20 bg-[#F6ECF2]/95 backdrop-blur-md -mx-4 px-4 sm:-mx-5 sm:px-5 pt-2 pb-3 space-y-3 shadow-sm border-b border-[#DADCE0]/50">
        <div className="w-full">
          <Skeleton className="w-full h-11 rounded-xl" />
        </div>
        <div className="flex items-center gap-2 overflow-hidden">
          <Skeleton className="h-8 w-20 rounded-full shrink-0" />
          <Skeleton className="h-8 w-16 rounded-full shrink-0" />
          <Skeleton className="h-8 w-24 rounded-full shrink-0" />
          <Skeleton className="h-8 w-20 rounded-full shrink-0" />
        </div>
      </div>
      <div className="flex flex-col gap-3 mt-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-[#DADCE0] space-y-3">
            <div className="flex justify-between border-b border-[#F1F3F4] pb-3">
              <div className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

export function ProfileSkeleton() {
  return (
    <main className="relative flex-1 min-h-screen bg-[#F6ECF2] p-4 sm:p-5 max-w-md mx-auto w-full font-sans space-y-6 pt-6 pb-24">
      <header className="flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="w-32 h-5" />
          <Skeleton className="w-24 h-3" />
        </div>
      </header>

      <section className="space-y-3">
        <Skeleton className="w-24 h-3" />
        <div className="bg-white rounded-2xl border border-[#DADCE0] p-4 space-y-4">
          <div className="space-y-1">
            <Skeleton className="w-16 h-2" />
            <Skeleton className="w-32 h-4" />
          </div>
          <div className="space-y-1">
            <Skeleton className="w-16 h-2" />
            <Skeleton className="w-40 h-4" />
          </div>
          <div className="space-y-1">
            <Skeleton className="w-16 h-2" />
            <Skeleton className="w-24 h-4" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <Skeleton className="w-24 h-3" />
        <div className="bg-white rounded-2xl border border-[#DADCE0] divide-y divide-[#F1F3F4]">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-5 h-5 rounded" />
              <Skeleton className="w-24 h-4" />
            </div>
            <Skeleton className="w-4 h-4" />
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-5 h-5 rounded" />
              <Skeleton className="w-32 h-4" />
            </div>
            <Skeleton className="w-4 h-4" />
          </div>
        </div>
      </section>
    </main>
  );
}

export function NotificationsSkeleton() {
  return (
    <main className="relative flex-1 min-h-screen bg-[#F6ECF2] p-4 sm:p-5 max-w-md mx-auto w-full font-sans flex flex-col pb-24">
      <header className="flex items-center justify-between pb-4 border-b border-[#DADCE0]">
        <Skeleton className="w-24 h-5" />
        <Skeleton className="w-16 h-3" />
      </header>
      
      <div className="flex gap-2 mt-4 overflow-hidden pb-2">
        <Skeleton className="h-8 w-20 rounded-full shrink-0" />
        <Skeleton className="h-8 w-24 rounded-full shrink-0" />
      </div>

      <div className="mt-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-3 p-4 bg-white rounded-2xl border border-[#DADCE0]">
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-start">
                <Skeleton className="w-32 h-4" />
                <Skeleton className="w-12 h-3" />
              </div>
              <Skeleton className="w-full h-3" />
              <Skeleton className="w-2/3 h-3" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

export function CheckoutSkeleton() {
  return (
    <main className="min-h-screen bg-[#F6ECF2] flex flex-col p-4 sm:p-5 pb-8 max-w-md mx-auto w-full font-sans gap-4">
      <header className="flex items-center justify-between pb-3 border-b border-[#DADCE0]/50 sticky top-0 bg-[#F6ECF2] z-10 pt-2">
        <Skeleton className="w-8 h-8 rounded-full" />
        <Skeleton className="w-24 h-5" />
        <div className="w-8 h-8" />
      </header>
      
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-2xl border border-[#DADCE0] text-center space-y-2">
          <Skeleton className="w-32 h-3 mx-auto" />
          <Skeleton className="w-40 h-8 mx-auto" />
        </div>
        
        <div className="bg-white p-4 rounded-2xl border border-[#DADCE0] space-y-4">
          <Skeleton className="w-32 h-4" />
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-[#F1F3F4]">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded" />
                <Skeleton className="w-24 h-4" />
              </div>
              <Skeleton className="w-4 h-4 rounded-full" />
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded" />
                <Skeleton className="w-20 h-4" />
              </div>
              <Skeleton className="w-4 h-4 rounded-full" />
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-auto pt-6">
        <Skeleton className="w-full h-12 rounded-xl" />
      </div>
    </main>
  );
}
