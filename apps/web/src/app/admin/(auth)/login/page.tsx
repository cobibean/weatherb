import { Suspense } from 'react';
import { LoginForm } from './login-form';
import { Loader2 } from 'lucide-react';

// Force dynamic rendering to avoid build-time env var requirements
export const dynamic = 'force-dynamic';

function LoginFallback(): React.ReactElement {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-light via-cloud-off to-sunset-pink/20 p-4">
      <div className="w-full max-w-md">
        <div className="card-hero text-center">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-sky-medium animate-spin" />
          </div>
          <p className="mt-4 font-body text-neutral-500">Loading...</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage(): React.ReactElement {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
