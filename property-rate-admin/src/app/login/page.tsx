import { redirect } from 'next/navigation';
import { verifyAdminSession } from '../actions';
import AdminLoginForm from '@/components/AdminLoginForm';
import { Building2 } from 'lucide-react';

export const metadata = {
  title: 'Municipal Console Authorization | Kpone-Katamanso Municipal Assembly',
  description: 'Official revenue mobilization and cadastral administration gateway for authorized municipal officers.',
};

export default async function AdminLoginPage() {
  // Server-Side Rendering (SSR) Pre-Auth Guard:
  // If session is already authenticated, redirect to root dashboard immediately without client roundtrips
  const session = await verifyAdminSession();
  if (session) {
    redirect('/');
  }

  return (
    <main className="min-h-screen bg-[#F2F2F7] flex flex-col justify-center items-center p-4 sm:p-6 font-sans select-none relative">
      <div className="w-full max-w-sm sm:max-w-md my-auto flex flex-col justify-center relative z-10">
        {/* Top Municipal Crest & Identification */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#007AFF] text-white shadow-md mb-3.5 rounded-2xl">
            <Building2 className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-[#6C6C70]">
              Republic of Ghana
            </p>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C1C1E]">
              Kpone-Katamanso Municipal Assembly
            </h1>
            <p className="text-xs text-[#8E8E93] font-medium">
              Revenue Administration Portal &bull; Act 936
            </p>
          </div>
        </div>

        {/* Master Authorization Card */}
        <div className="bg-white border border-[#E5E5EA] shadow-xl p-6 sm:p-7 rounded-2xl">
          <div className="mb-5 pb-3 border-b border-[#E5E5EA]">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
              Administrator Sign-In
            </p>
          </div>
          {/* Partial Hydration: Isolated Client Form */}
          <AdminLoginForm />
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-[#8E8E93] mt-5">
          Restricted access &middot; Authorized revenue officers only
        </p>
      </div>
    </main>
  );
}
