import { redirect } from 'next/navigation';
import { verifyAdminSession } from '../actions';
import AdminLoginForm from '@/components/AdminLoginForm';
import { Building2 } from 'lucide-react';

export const metadata = {
  title: 'Sign In | Kpone-Katamanso Municipal Assembly',
  description: 'Revenue administration portal for authorized municipal officers.',
};

export default async function AdminLoginPage() {
  // Server-Side Rendering (SSR) Pre-Auth Guard:
  // If session is already authenticated, redirect to root dashboard immediately without client roundtrips
  const session = await verifyAdminSession();
  if (session) {
    redirect('/');
  }

  return (
    <main className="h-screen max-h-screen bg-[#F2F2F7] flex flex-col justify-center items-center p-3 sm:p-4 font-sans select-none relative overflow-hidden">
      <div className="w-full max-w-sm sm:max-w-md my-auto flex flex-col justify-center relative z-10 max-h-full overflow-y-auto py-2">
        {/* Top Municipal Crest & Identification */}
        <div className="text-center mb-3 sm:mb-4 shrink-0">
          <div className="inline-flex items-center justify-center w-11 h-11 bg-[#007AFF] text-white shadow-md mb-2 rounded-xl">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold tracking-wider uppercase text-[#6C6C70]">
              Republic of Ghana
            </p>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#1C1C1E]">
              Kpone-Katamanso Municipal Assembly
            </h1>
            <p className="text-[11px] text-[#8E8E93] font-medium">
              Revenue Administration Portal
            </p>
          </div>
        </div>

        {/* Master Authorization Card */}
        <div className="bg-white border border-[#E5E5EA] shadow-xl p-5 sm:p-6 rounded-2xl shrink-0">
          <div className="mb-3.5 pb-2.5 border-b border-[#E5E5EA]">
            <p className="text-xs font-semibold text-[#1C1C1E]">
              Sign In
            </p>
          </div>
          {/* Partial Hydration: Isolated Client Form */}
          <AdminLoginForm />
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-[#8E8E93] mt-3 shrink-0">
          Authorized municipal staff only
        </p>
      </div>
    </main>
  );
}
