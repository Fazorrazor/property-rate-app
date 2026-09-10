import { redirect } from 'next/navigation';
import { verifyAdminSession } from '../actions';
import AdminLoginForm from '@/components/AdminLoginForm';
import { Shield, Building2, Lock } from 'lucide-react';

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
    <main className="h-screen max-h-screen overflow-hidden bg-[#F6ECF2] flex flex-col justify-center items-center p-3 sm:p-4 font-sans select-none">
      <div className="w-full max-w-sm sm:max-w-md my-auto flex flex-col justify-center">
        {/* Top Municipal Crest & Identification */}
        <div className="text-center mb-2.5 sm:mb-3">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-[#612D53] text-white shadow-sm mb-1.5 border border-[#4A2240]">
            <Building2 className="w-5 h-5" />
          </div>

          <div className="space-y-0.5">
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#5F6368]">
              Republic of Ghana
            </p>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#2C2C2C]">
              Kpone-Katamanso Municipal Assembly
            </h1>
            <p className="text-xs font-medium text-[#612D53]">
              Rate Revenue & Cadastral Administration Console
            </p>
          </div>
        </div>

        {/* Master Authorization Card */}
        <div className="bg-white border border-[#DADCE0] shadow-sm p-4 sm:p-5">
          <div className="border-b border-[#F1F3F4] pb-2 mb-3">
            <h2 className="text-xs sm:text-sm font-semibold text-[#2C2C2C] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#612D53]" />
              Municipal Officer Authorization
            </h2>
            <p className="mt-0.5 text-[10px] sm:text-[11px] text-[#5F6368]">
              Restricted portal. Provide authorized credentials to access municipal registries and fiscal ledgers.
            </p>
          </div>

          {/* Partial Hydration: Isolated Client Form */}
          <AdminLoginForm />
        </div>

        {/* Legal and Security Governance Notice */}
        <div className="mt-2.5 sm:mt-3 text-center space-y-1">
          <p className="text-[10px] sm:text-[11px] text-[#717171] flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-[#5F6368]" />
            256-Bit TLS Municipal Session &bull; Local Governance Act, 2016 (Act 936)
          </p>
          <p className="text-[9px] sm:text-[10px] text-[#9AA0A6] max-w-xs mx-auto leading-tight">
            All terminal activities and record inquiries are continuously audited and committed to the municipal security ledger.
          </p>
          <p className="text-[9px] sm:text-[10px] text-[#717171] pt-1.5 border-t border-[#E8EAED]/60">
            KKMA Directorate of Finance & Revenue Mobilization &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </main>
  );
}
