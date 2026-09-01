export function AdminDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#F6ECF2] text-[#2C2C2C] flex flex-row font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-[#DADCE0]/50 shadow-sm flex flex-col fixed inset-y-0 left-0 z-30">
        <div className="h-14 flex items-center px-6 border-b border-[#DADCE0]/50 shrink-0">
          <div className="w-20 h-6 bg-[#DADCE0] rounded animate-pulse" />
        </div>
        
        <nav className="flex flex-col flex-1 px-4 py-6 gap-2">
           <div className="w-full h-12 bg-[#F6ECF2] rounded-lg animate-pulse" />
           <div className="w-full h-12 bg-transparent rounded-lg animate-pulse flex items-center px-4">
              <div className="w-2/3 h-4 bg-[#DADCE0] rounded" />
           </div>
           <div className="w-full h-12 bg-transparent rounded-lg animate-pulse flex items-center px-4">
              <div className="w-3/4 h-4 bg-[#DADCE0] rounded" />
           </div>
           <div className="w-full h-12 bg-transparent rounded-lg animate-pulse flex items-center px-4">
              <div className="w-1/2 h-4 bg-[#DADCE0] rounded" />
           </div>
        </nav>
        
        <div className="p-4 border-t border-[#DADCE0]/50 shrink-0">
          <div className="w-full h-10 bg-[#DADCE0] rounded animate-pulse" />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col ml-64 min-h-screen">
        {/* Top Header */}
        <header className="bg-white border-b border-[#DADCE0]/50 shadow-sm sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
            <div className="w-64 h-6 bg-[#DADCE0] rounded animate-pulse" />
            <div className="w-48 h-8 bg-[#DADCE0] rounded animate-pulse" />
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 space-y-6">
          {/* Top Cards Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="h-28 bg-[#DADCE0] rounded-xl animate-pulse" />
            <div className="h-28 bg-[#DADCE0] rounded-xl animate-pulse" />
            <div className="h-28 bg-[#DADCE0] rounded-xl animate-pulse" />
            <div className="h-28 bg-[#DADCE0] rounded-xl animate-pulse" />
          </div>

          {/* Controls Skeleton */}
          <div className="flex items-center justify-between">
            <div className="w-64 h-10 bg-[#DADCE0] rounded-xl animate-pulse" />
            <div className="flex items-center gap-3">
              <div className="w-40 h-10 bg-[#DADCE0] rounded-xl animate-pulse" />
              <div className="w-40 h-10 bg-[#DADCE0] rounded-xl animate-pulse" />
            </div>
          </div>

          {/* Table Skeleton */}
          <div className="bg-white border border-[#DADCE0]/50 rounded-xl shadow-sm p-4 h-96 flex flex-col space-y-4">
             <div className="h-12 border-b border-[#DADCE0]/50 bg-[#F8F9FA] rounded animate-pulse" />
             <div className="flex-1 space-y-3">
                <div className="h-14 bg-[#F8F9FA] rounded animate-pulse" />
                <div className="h-14 bg-[#F8F9FA] rounded animate-pulse" />
                <div className="h-14 bg-[#F8F9FA] rounded animate-pulse" />
             </div>
          </div>
        </main>
      </div>
    </div>
  );
}
