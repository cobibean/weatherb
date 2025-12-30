'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertCircle, ArrowRight } from 'lucide-react';

export default function MagicLinkConfirmation() {
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

      // Build success message
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
      // If no params, show generic error
      setStatus('error');
      setMessage('Invalid request.');
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4">
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

          {/* Title */}
          <h1 className="text-2xl font-bold text-center mb-4">
            {status === 'success' ? (
              action === 'approve' ? (
                'City Approved!'
              ) : action === 'deny' ? (
                'City Denied'
              ) : (
                'Action Complete'
              )
            ) : status === 'error' ? (
              'Action Failed'
            ) : (
              'Processing...'
            )}
          </h1>

          {/* Message */}
          <p className="text-gray-600 text-center mb-8">{message}</p>

          {/* Additional Info for Success */}
          {status === 'success' && action === 'approve' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-green-900 mb-2">Next Steps:</h3>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• Markets will be created for this city in the next daily schedule</li>
                <li>• The city will appear in the public market list</li>
                <li>• Users can start betting on temperature outcomes</li>
              </ul>
            </div>
          )}

          {/* Additional Info for Error */}
          {status === 'error' && message.includes('expired') && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                Magic links expire after 48 hours for security. Please request a new link if needed.
              </p>
            </div>
          )}

          {status === 'error' && message.includes('already been used') && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                Magic links can only be used once. The action may have already been completed.
              </p>
            </div>
          )}

          {/* Action Button */}
          <Link
            href="/admin"
            className="w-full bg-blue-600 text-white rounded-lg px-6 py-3 font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            Go to Admin Dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>

          {/* Footer */}
          <p className="text-xs text-gray-500 text-center mt-6">
            This action was performed via a secure magic link from WeatherB.
          </p>
        </div>
      </div>
    </div>
  );
}