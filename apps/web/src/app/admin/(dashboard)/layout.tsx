import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-session';
import { AdminSidebar } from '@/components/admin/sidebar';
import { AdminHeader } from '@/components/admin/header';

export default async function AdminLayout({ children }: { children: ReactNode }): Promise<React.ReactElement> {
  // Validate session on the server
  const session = await getAdminSession();

  if (!session) {
    redirect('/admin/login');
  }

  return (
    <div className="min-h-screen bg-cloud-off flex">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        {/* Header */}
        <AdminHeader wallet={session.wallet} />

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 pt-20">
          {children}
        </main>
      </div>
    </div>
  );
}

