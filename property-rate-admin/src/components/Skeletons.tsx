export function AdminDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#F2F2F7] text-[#1C1C1E] flex flex-row font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white/90 backdrop-blur-xl border-r border-[#E5E5EA] shadow-xs flex flex-col fixed inset-y-0 left-0 z-30">
        <div className="h-14 flex items-center px-6 border-b border-[#E5E5EA] shrink-0">
          <div className="w-24 h-5 bg-[#E5E5EA] rounded-md animate-pulse" />
        </div>
        
        <nav className="flex flex-col flex-1 px-4 py-6 gap-2">
           <div className="w-full h-9 bg-[#E5E5EA] rounded-lg animate-pulse" />
           <div className="w-full h-9 bg-transparent rounded-lg flex items-center px-4">
              <div className="w-2/3 h-4 bg-[#E5E5EA] rounded-md" />
           </div>
           <div className="w-full h-9 bg-transparent rounded-lg flex items-center px-4">
              <div className="w-3/4 h-4 bg-[#E5E5EA] rounded-md" />
           </div>
           <div className="w-full h-9 bg-transparent rounded-lg flex items-center px-4">
              <div className="w-1/2 h-4 bg-[#E5E5EA] rounded-md" />
           </div>
        </nav>
        
        <div className="p-4 border-t border-[#E5E5EA] shrink-0">
          <div className="w-full h-10 bg-[#E5E5EA] rounded-lg animate-pulse" />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col ml-64 min-h-screen">
        {/* Top Header */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-[#E5E5EA] shadow-xs sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
            <div className="w-64 h-6 bg-[#E5E5EA] rounded-md animate-pulse" />
            <div className="w-48 h-8 bg-[#E5E5EA] rounded-lg animate-pulse" />
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 space-y-6">
          {/* Top Cards Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="h-28 bg-white border border-[#E5E5EA] rounded-xl shadow-xs animate-pulse" />
            <div className="h-28 bg-white border border-[#E5E5EA] rounded-xl shadow-xs animate-pulse" />
            <div className="h-28 bg-white border border-[#E5E5EA] rounded-xl shadow-xs animate-pulse" />
            <div className="h-28 bg-white border border-[#E5E5EA] rounded-xl shadow-xs animate-pulse" />
          </div>

          {/* Controls Skeleton */}
          <div className="flex items-center justify-between">
            <div className="w-64 h-9 bg-[#E5E5EA] rounded-lg animate-pulse" />
            <div className="flex items-center gap-3">
              <div className="w-36 h-9 bg-[#E5E5EA] rounded-lg animate-pulse" />
              <div className="w-36 h-9 bg-[#E5E5EA] rounded-lg animate-pulse" />
            </div>
          </div>

          {/* Table Skeleton */}
          <div className="bg-white border border-[#E5E5EA] rounded-xl shadow-xs p-4 h-96 flex flex-col space-y-4">
             <div className="h-10 border-b border-[#E5E5EA] bg-[#F8F9FA] rounded-md animate-pulse" />
             <div className="flex-1 space-y-3">
                <div className="h-12 bg-[#F2F2F7] rounded-md animate-pulse" />
                <div className="h-12 bg-[#F2F2F7] rounded-md animate-pulse" />
                <div className="h-12 bg-[#F2F2F7] rounded-md animate-pulse" />
             </div>
          </div>
        </main>
      </div>
    </div>
  );
}
