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
    <main className="h-screen max-h-screen overflow-hidden bg-[#F6ECF2] flex flex-col justify-center items-center p-3 sm:p-4 font-sans select-none">
      <div className="w-full max-w-sm sm:max-w-md my-auto flex flex-col justify-center">
        {/* Top Municipal Crest & Identification */}
        <div className="text-center mb-3 sm:mb-4">
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
          </div>
        </div>

        {/* Master Authorization Card */}
        <div className="bg-white border border-[#DADCE0] shadow-sm p-4 sm:p-5">
          {/* Partial Hydration: Isolated Client Form */}
          <AdminLoginForm />
        </div>
      </div>
    </main>
  );
}
