'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  MapPin,
  Globe,
  Clock,
  ToggleLeft,
  ToggleRight,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import type { City } from '@prisma/client';

interface CitiesClientProps {
  initialCities: City[];
}

export function CitiesClient({ initialCities }: CitiesClientProps): React.ReactElement {
  const router = useRouter();
  const [cities, setCities] = useState(initialCities);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [newCity, setNewCity] = useState({
    name: '',
    latitude: '',
    longitude: '',
    timezone: '',
  });

  const handleAddCity = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsAdding(true);
    setMessage(null);

    try {
      const res = await fetch('/admin/api/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCity.name,
          latitude: parseFloat(newCity.latitude),
          longitude: parseFloat(newCity.longitude),
          timezone: newCity.timezone,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add city');
      }

      const { city } = await res.json();
      setCities([city, ...cities]);
      setNewCity({ name: '', latitude: '', longitude: '', timezone: '' });
      setShowAddForm(false);
      setMessage({ type: 'success', text: `${city.name} added successfully!` });
      router.refresh();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to add city',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleCity = async (city: City): Promise<void> => {
    setTogglingId(city.id);
    setMessage(null);

    try {
      const res = await fetch('/admin/api/cities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: city.id,
          isActive: !city.isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update city');
      }

      const { city: updatedCity } = await res.json();
      setCities(cities.map((c) => (c.id === updatedCity.id ? updatedCity : c)));
      router.refresh();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update city',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const activeCities = cities.filter((c) => c.isActive);
  const inactiveCities = cities.filter((c) => !c.isActive);

  return (
    <div className="space-y-6">
      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-success-soft/30 border border-success-soft'
                : 'bg-error-soft/30 border border-error-soft'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-success-soft" />
            ) : (
              <AlertCircle className="w-5 h-5 text-error-soft" />
            )}
            <p className="font-body text-sm text-neutral-800">{message.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add City Button / Form */}
      <AnimatePresence mode="wait">
        {showAddForm ? (
          <motion.form
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddCity}
            className="p-6 rounded-2xl border border-sky-medium/30 bg-sky-light/10"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg text-neutral-800">Add New City</h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="p-1 rounded-lg hover:bg-neutral-200 transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="font-body text-sm text-neutral-600 mb-1 block">City Name</label>
                <input
                  type="text"
                  value={newCity.name}
                  onChange={(e) => setNewCity({ ...newCity, name: e.target.value })}
                  placeholder="e.g., New York"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-body text-neutral-800 focus:outline-none focus:ring-2 focus:ring-sky-medium"
                />
              </div>
              <div>
                <label className="font-body text-sm text-neutral-600 mb-1 block">Timezone</label>
                <input
                  type="text"
                  value={newCity.timezone}
                  onChange={(e) => setNewCity({ ...newCity, timezone: e.target.value })}
                  placeholder="e.g., America/New_York"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-body text-neutral-800 focus:outline-none focus:ring-2 focus:ring-sky-medium"
                />
              </div>
              <div>
                <label className="font-body text-sm text-neutral-600 mb-1 block">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={newCity.latitude}
                  onChange={(e) => setNewCity({ ...newCity, latitude: e.target.value })}
                  placeholder="e.g., 40.7128"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-body text-neutral-800 focus:outline-none focus:ring-2 focus:ring-sky-medium"
                />
              </div>
              <div>
                <label className="font-body text-sm text-neutral-600 mb-1 block">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={newCity.longitude}
                  onChange={(e) => setNewCity({ ...newCity, longitude: e.target.value })}
                  placeholder="e.g., -74.0060"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-body text-neutral-800 focus:outline-none focus:ring-2 focus:ring-sky-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-xl bg-neutral-100 text-neutral-600 font-body font-medium hover:bg-neutral-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isAdding}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-medium text-white font-body font-medium hover:bg-sky-deep transition-colors disabled:opacity-50"
              >
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add City
              </button>
            </div>
          </motion.form>
        ) : (
          <motion.button
            key="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddForm(true)}
            className="w-full p-4 rounded-2xl border-2 border-dashed border-neutral-300 text-neutral-500 font-body font-medium hover:border-sky-medium hover:text-sky-deep hover:bg-sky-light/10 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add New City
          </motion.button>
        )}
      </AnimatePresence>

      {/* Active Cities */}
      <div>
        <h3 className="font-display font-bold text-lg text-neutral-800 mb-3">
          Active Cities ({activeCities.length})
        </h3>
        {activeCities.length === 0 ? (
          <p className="p-6 rounded-2xl border border-neutral-200 bg-white text-center font-body text-neutral-400">
            No active cities. Add one above to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {activeCities.map((city, index) => (
              <motion.div
                key={city.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-2xl border border-neutral-200 bg-white flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-success-soft/30 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-success-soft" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-neutral-800 truncate">{city.name}</p>
                  <div className="flex items-center gap-3 text-sm text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" />
                      {city.latitude.toFixed(4)}, {city.longitude.toFixed(4)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {city.timezone}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleCity(city)}
                  disabled={togglingId === city.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors disabled:opacity-50"
                >
                  {togglingId === city.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ToggleRight className="w-5 h-5 text-success-soft" />
                  )}
                  <span className="hidden sm:inline text-sm">Deactivate</span>
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Inactive Cities */}
      {inactiveCities.length > 0 && (
        <div>
          <h3 className="font-display font-bold text-lg text-neutral-800 mb-3">
            Inactive Cities ({inactiveCities.length})
          </h3>
          <div className="space-y-2">
            {inactiveCities.map((city, index) => (
              <motion.div
                key={city.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-2xl border border-neutral-200 bg-neutral-50 flex items-center gap-4 opacity-60"
              >
                <div className="w-10 h-10 rounded-xl bg-neutral-200 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-neutral-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-neutral-600 truncate">{city.name}</p>
                  <div className="flex items-center gap-3 text-sm text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" />
                      {city.latitude.toFixed(4)}, {city.longitude.toFixed(4)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {city.timezone}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleCity(city)}
                  disabled={togglingId === city.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200 transition-colors disabled:opacity-50"
                >
                  {togglingId === city.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ToggleLeft className="w-5 h-5" />
                  )}
                  <span className="hidden sm:inline text-sm">Activate</span>
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

