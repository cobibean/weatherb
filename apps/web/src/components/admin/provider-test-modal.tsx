'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CheckCircle, XCircle, Loader2, MapPin, Thermometer, Clock, Cloud } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type TestResult = {
  success: boolean;
  city: {
    name: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  temperature?: number;
  temperatureDisplay?: string;
  observedTimestamp?: number;
  source?: string;
  error?: string;
};

interface ProviderTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestComplete?: () => void;
}

export function ProviderTestModal({ isOpen, onClose, onTestComplete }: ProviderTestModalProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleTest = async (): Promise<void> => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/admin/api/provider/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      setResult(data);

      if (data.success && onTestComplete) {
        // Small delay to show result before refreshing
        setTimeout(() => {
          onTestComplete();
        }, 1000);
      }
    } catch (error) {
      setResult({
        success: false,
        city: { name: 'Unknown', country: 'Unknown', latitude: 0, longitude: 0 },
        error: error instanceof Error ? error.message : 'Failed to test provider',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = (): void => {
    if (!isLoading) {
      setResult(null);
      onClose();
    }
  };

  // Format timestamp to readable date/time
  const formatTimestamp = (timestamp?: number): string => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  // Format temperature to whole degrees
  const formatTemperature = (tempDisplay?: string): string => {
    if (!tempDisplay) return 'N/A';
    // Extract number and round to whole degree
    const match = tempDisplay.match(/(\d+\.?\d*)/);
    if (match && match[1]) {
      const temp = parseFloat(match[1]);
      return `${Math.round(temp)}°F`;
    }
    return tempDisplay;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-white border border-neutral-200 shadow-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-neutral-100">
          <DialogTitle className="text-lg font-display font-bold text-neutral-800">
            Test Weather Provider
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-600 mt-1">
            Test the connection by fetching temperature for a random city worldwide
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-6 space-y-6">
          {!result && !isLoading && (
            <div className="text-center py-8">
              <p className="text-neutral-600 mb-4">Click the button below to test the provider</p>
              <button
                onClick={handleTest}
                className="px-6 py-2 bg-sky-medium text-white rounded-lg font-medium hover:bg-sky-dark transition-colors"
              >
                Run Test
              </button>
            </div>
          )}

          {isLoading && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-sky-medium mx-auto mb-4" />
              <p className="text-neutral-600">Testing provider connection...</p>
            </div>
          )}

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Status Header */}
                <div
                  className={`flex items-center gap-3 p-4 rounded-xl ${
                    result.success
                      ? 'bg-success-soft/20 border border-success-soft/40'
                      : 'bg-error-soft/30 border border-error-soft/50'
                  }`}
                >
                  {result.success ? (
                    <CheckCircle className="w-6 h-6 text-success-soft flex-shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-error-soft flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold text-neutral-800">
                      {result.success ? 'Test Successful' : 'Test Failed'}
                    </p>
                    {!result.success && result.error && (
                      <p className="text-sm text-neutral-600 mt-1">{result.error}</p>
                    )}
                  </div>
                </div>

                {/* Results */}
                {result.success && (
                  <div className="space-y-3">
                    {/* City */}
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-neutral-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-neutral-500">City</p>
                        <p className="font-medium text-neutral-800">
                          {result.city.name}, {result.city.country}
                        </p>
                        <p className="text-xs text-neutral-400 mt-1">
                          {result.city.latitude.toFixed(4)}, {result.city.longitude.toFixed(4)}
                        </p>
                      </div>
                    </div>

                    {/* Temperature */}
                    <div className="flex items-start gap-3">
                      <Thermometer className="w-5 h-5 text-neutral-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-neutral-500">Temperature</p>
                        <p className="font-medium text-neutral-800 text-lg">
                          {formatTemperature(result.temperatureDisplay)}
                        </p>
                        {result.temperatureDisplay && (
                          <p className="text-xs text-neutral-400 mt-1">
                            Raw: {result.temperatureDisplay}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-neutral-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-neutral-500">Observed At</p>
                        <p className="font-medium text-neutral-800">
                          {formatTimestamp(result.observedTimestamp)}
                        </p>
                      </div>
                    </div>

                    {/* Provider Source */}
                    {result.source && (
                      <div className="flex items-start gap-3">
                        <Cloud className="w-5 h-5 text-neutral-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-neutral-500">Provider</p>
                          <p className="font-medium text-neutral-800">{result.source}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 flex justify-end">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
