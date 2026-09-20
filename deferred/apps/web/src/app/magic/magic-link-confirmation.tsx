'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertCircle, ArrowRight } from 'lucide-react';

export function MagicLinkConfirmationClient() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'success' | 'error' | 'loading'>('loading');
  const [message, setMessage] = useState('');
  const [action, setAction] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    const statusParam = searchParams.get('status');
    const messageParam = searchParams.get('message');
    const actionParam = searchParams.get('action');
    const cityParam = searchParams.get('city');

    if (statusParam === 'success') {
      setStatus('success');
      setAction(actionParam || '');
      setCity(cityParam || '');

      if (actionParam === 'approve') {
        setMessage(`Successfully approved ${cityParam || 'the city'} for production use.`);
      } else if (actionParam === 'deny') {
        setMessage(`Successfully denied ${cityParam || 'the city'}.`);
      } else {
        setMessage('Action completed successfully.');
      }
    } else if (statusParam === 'error') {
      setStatus('error');
      setMessage(messageParam || 'An error occurred processing your request.');
    } else {
      setStatus('error');
      setMessage('Invalid request.');
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Icon and Status */}
          <div className="flex justify-center mb-6">
            {status === 'success' ? (
              <div className="relative">
                <CheckCircle2 className="w-20 h-20 text-green-500" />
                <div className="absolute inset-0 animate-ping">
                  <CheckCircle2 className="w-20 h-20 text-green-500 opacity-30" />
                </div>
              </div>
            ) : status === 'error' ? (
              <XCircle className="w-20 h-20 text-red-500" />
            ) : (
              <AlertCircle className="w-20 h-20 text-gray-400 animate-pulse" />
            )}
          </div>

          {/* Message */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {status === 'success' ? 'Success!' : status === 'error' ? 'Error' : 'Processing...'}
            </h1>
            <p className="text-gray-600">{message}</p>
          </div>

          {/* Actions */}
          {status === 'success' && (
            <div className="space-y-3">
              <Link
                href="/admin/suggestions"
                className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Go to Admin Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <Link
                href="/"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Return to Home
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
