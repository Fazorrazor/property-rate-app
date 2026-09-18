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
    <main className="h-screen max-h-screen overflow-hidden bg-[#0B0E11] flex flex-col justify-center items-center p-3 sm:p-4 font-sans select-none relative">
      {/* Ambient grid overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(252,213,53,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(252,213,53,0.025) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      <div className="w-full max-w-sm sm:max-w-md my-auto flex flex-col justify-center relative z-10">
        {/* Top Municipal Crest & Identification */}
        <div className="text-center mb-5 sm:mb-6">
          <div className="inline-flex items-center justify-center w-11 h-11 bg-[#FCD535] text-[#181A20] shadow-lg mb-3 rounded-sm">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#848E9C]">
              Republic of Ghana
            </p>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#EAECEF]">
              Kpone-Katamanso Municipal Assembly
            </h1>
            <p className="text-[11px] text-[#848E9C] font-medium">
              Revenue Administration Portal &bull; Act 936
            </p>
          </div>
        </div>

        {/* Master Authorization Card */}
        <div className="bg-[#1E2329] border border-[#2B3139] shadow-[0_8px_48px_rgba(0,0,0,0.6)] p-5 sm:p-6 rounded-sm">
          <div className="mb-4 pb-3 border-b border-[#2B3139]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#848E9C] font-mono">
              Administrator Sign-In
            </p>
          </div>
          {/* Partial Hydration: Isolated Client Form */}
          <AdminLoginForm />
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-[#848E9C] mt-4 font-mono">
          Restricted access &middot; Authorized officers only
        </p>
      </div>
    </main>
  );
}

