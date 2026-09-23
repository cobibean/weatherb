import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-session';
import { AdminSidebar } from '@/components/admin/sidebar';
import { AdminHeader } from '@/components/admin/header';
import { adminWritesEnabled } from '@/lib/admin-writes';
import { liquidityAdminWritesEnabled } from '@/lib/liquidity/admin-config';

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {
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
      <div className="min-w-0 flex-1 flex flex-col min-h-screen lg:ml-64">
        {/* Header */}
        <AdminHeader wallet={session.wallet} readOnly={!adminWritesEnabled()} liquidityEditable={liquidityAdminWritesEnabled()} />

        {/* Page content */}
        <main className="min-w-0 flex-1 px-4 pb-4 pt-20 lg:px-6 lg:pb-6 lg:pt-20">{children}</main>
      </div>
    </div>
  );
}
