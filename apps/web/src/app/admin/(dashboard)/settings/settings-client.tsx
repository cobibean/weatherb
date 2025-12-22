'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Save, Loader2, Info, Clock, MapPin, TrendingUp, Timer } from 'lucide-react';
import type { SystemConfigData } from '@/lib/admin-data';

interface SettingsClientProps {
  initialConfig: SystemConfigData;
}

export function SettingsClient({ initialConfig }: SettingsClientProps): React.ReactElement {
  const router = useRouter();
  const [config, setConfig] = useState(initialConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const hasChanges = JSON.stringify(config) !== JSON.stringify(initialConfig);

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/admin/api/system/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cadence: config.cadence,
          testMode: config.testMode,
          dailyCount: config.dailyCount,
          bettingBuffer: config.bettingBuffer,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      router.refresh();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to save settings' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Market Cadence */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl border border-neutral-200 bg-white"
      >
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-sky-light/30 flex items-center justify-center">
            <Clock className="w-5 h-5 text-sky-deep" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-bold text-lg text-neutral-800">
              Market Cadence
            </h3>
            <p className="font-body text-sm text-neutral-500">
              Time between market resolve times in minutes.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="1"
            max="60"
            value={config.cadence}
            onChange={(e) => setConfig({ ...config, cadence: parseInt(e.target.value) })}
            className="flex-1 h-2 bg-neutral-200 rounded-full appearance-none cursor-pointer accent-sky-medium"
          />
          <div className="w-20 px-3 py-2 rounded-xl bg-neutral-100 text-center">
            <span className="font-mono text-lg font-bold text-neutral-800">{config.cadence}</span>
            <span className="font-body text-xs text-neutral-500 ml-1">min</span>
          </div>
        </div>
      </motion.div>

      {/* Daily Market Count */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 rounded-2xl border border-neutral-200 bg-white"
      >
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-sunset-pink/30 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-sunset-coral" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-bold text-lg text-neutral-800">
              Daily Market Count
            </h3>
            <p className="font-body text-sm text-neutral-500">
              Number of markets created per day (max 5).
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {[1, 2, 3, 4, 5].map((num) => (
            <button
              key={num}
              onClick={() => setConfig({ ...config, dailyCount: num })}
              className={`w-12 h-12 rounded-xl font-display font-bold text-lg transition-all ${
                config.dailyCount === num
                  ? 'bg-sunset-pink text-white shadow-sunset'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Betting Buffer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-6 rounded-2xl border border-neutral-200 bg-white"
      >
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-sunset-orange/30 flex items-center justify-center">
            <Timer className="w-5 h-5 text-sunset-orange" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-bold text-lg text-neutral-800">
              Betting Buffer
            </h3>
            <p className="font-body text-sm text-neutral-500">
              Time before market resolution when betting closes (in seconds).
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="60"
            max="3600"
            step="60"
            value={config.bettingBuffer}
            onChange={(e) => setConfig({ ...config, bettingBuffer: parseInt(e.target.value) })}
            className="flex-1 h-2 bg-neutral-200 rounded-full appearance-none cursor-pointer accent-sunset-orange"
          />
          <div className="w-24 px-3 py-2 rounded-xl bg-neutral-100 text-center">
            <span className="font-mono text-lg font-bold text-neutral-800">
              {Math.floor(config.bettingBuffer / 60)}
            </span>
            <span className="font-body text-xs text-neutral-500 ml-1">min</span>
          </div>
        </div>
        
        <p className="mt-2 font-body text-xs text-neutral-400">
          Current: {config.bettingBuffer} seconds ({Math.floor(config.bettingBuffer / 60)} minutes)
        </p>
      </motion.div>

      {/* Test Mode */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-6 rounded-2xl border border-neutral-200 bg-white"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-success-soft/30 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-success-soft" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-neutral-800">
                Test Mode
              </h3>
              <p className="font-body text-sm text-neutral-500">
                When enabled, only creates markets for a single test city.
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setConfig({ ...config, testMode: !config.testMode })}
            className={`relative w-14 h-8 rounded-full transition-colors ${
              config.testMode ? 'bg-success-soft' : 'bg-neutral-300'
            }`}
          >
            <motion.div
              animate={{ x: config.testMode ? 26 : 4 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-md"
            />
          </button>
        </div>
      </motion.div>

      {/* Info Box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-4 rounded-xl bg-sky-light/20 border border-sky-medium/30 flex items-start gap-3"
      >
        <Info className="w-5 h-5 text-sky-deep flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-body text-sm text-neutral-700">
            <strong>Note:</strong> Changes to betting buffer will also update the smart contract 
            (requires contract owner privileges). Other settings affect the scheduler service only.
          </p>
        </div>
      </motion.div>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-4">
        {message && (
          <motion.p
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`font-body text-sm ${
              message.type === 'success' ? 'text-success-soft' : 'text-error-soft'
            }`}
          >
            {message.text}
          </motion.p>
        )}
        
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="ml-auto flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-medium to-sky-deep text-white font-body font-semibold transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          Save Changes
        </button>
      </div>
    </div>
  );
}

