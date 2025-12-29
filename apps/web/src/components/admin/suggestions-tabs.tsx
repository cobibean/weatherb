'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  MapPin,
  ThumbsUp,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import type { SuggestionWithVotes } from '@/lib/admin-suggestions';
import { getTestProgress } from '@/lib/admin-suggestions';

interface SuggestionsTabsProps {
  pending: SuggestionWithVotes[];
  testing: SuggestionWithVotes[];
  live: SuggestionWithVotes[];
  rejected: SuggestionWithVotes[];
}

export function SuggestionsTabs({
  pending,
  testing,
  live,
  rejected,
}: SuggestionsTabsProps): React.ReactElement {
  const router = useRouter();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [denyingId, setDenyingId] = useState<string | null>(null);

  const handleApprove = async (id: string): Promise<void> => {
    setApprovingId(id);
    try {
      // TODO: Connect to API in Task 3
      console.log('Approving suggestion:', id);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      router.refresh();
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setApprovingId(null);
    }
  };

  const handleDeny = async (id: string): Promise<void> => {
    setDenyingId(id);
    try {
      // TODO: Connect to API in Task 3
      console.log('Denying suggestion:', id);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      router.refresh();
    } catch (error) {
      console.error('Failed to deny:', error);
    } finally {
      setDenyingId(null);
    }
  };

  const getCityName = (suggestion: SuggestionWithVotes): string => {
    return suggestion.customCityName || 'Unknown City';
  };

  return (
    <Tabs defaultValue="pending" className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-6">
        <TabsTrigger value="pending">
          Pending ({pending.length})
        </TabsTrigger>
        <TabsTrigger value="testing">
          Testing ({testing.length})
        </TabsTrigger>
        <TabsTrigger value="live">
          Live ({live.length})
        </TabsTrigger>
        <TabsTrigger value="rejected">
          Rejected ({rejected.length})
        </TabsTrigger>
      </TabsList>

      {/* Pending Tab */}
      <TabsContent value="pending" className="space-y-4">
        {pending.length === 0 ? (
          <div className="p-8 rounded-2xl border border-neutral-200 bg-white text-center">
            <p className="font-body text-neutral-400">No pending suggestions</p>
          </div>
        ) : (
          pending.map((suggestion, index) => (
            <motion.div
              key={suggestion.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-6 rounded-2xl border border-neutral-200 bg-white"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-sky-light/30 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-sky-medium" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="font-display font-bold text-lg text-neutral-800">
                        {getCityName(suggestion)}
                      </h3>
                      {suggestion.latitude && suggestion.longitude && (
                        <p className="font-body text-sm text-neutral-500">
                          {suggestion.latitude.toFixed(4)}, {suggestion.longitude.toFixed(4)}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary">
                      <ThumbsUp className="w-3 h-3 mr-1" />
                      {suggestion.voteCount}
                    </Badge>
                  </div>

                  {suggestion.timeWindow && (
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-neutral-400" />
                      <span className="font-body text-sm text-neutral-600">
                        {suggestion.timeWindow}
                      </span>
                    </div>
                  )}

                  {suggestion.comment && (
                    <div className="flex gap-2 mb-3 p-3 rounded-lg bg-neutral-50">
                      <MessageSquare className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                      <p className="font-body text-sm text-neutral-600">
                        {suggestion.comment}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleApprove(suggestion.id)}
                      disabled={approvingId === suggestion.id || denyingId === suggestion.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-success-soft text-white font-body font-medium hover:bg-success-soft/80 transition-colors disabled:opacity-50"
                    >
                      {approvingId === suggestion.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => handleDeny(suggestion.id)}
                      disabled={approvingId === suggestion.id || denyingId === suggestion.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-error-soft text-white font-body font-medium hover:bg-error-soft/80 transition-colors disabled:opacity-50"
                    >
                      {denyingId === suggestion.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Deny
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </TabsContent>

      {/* Testing Tab */}
      <TabsContent value="testing" className="space-y-4">
        {testing.length === 0 ? (
          <div className="p-8 rounded-2xl border border-neutral-200 bg-white text-center">
            <p className="font-body text-neutral-400">No cities currently in testing</p>
          </div>
        ) : (
          testing.map((suggestion, index) => {
            const testRun = suggestion.testRuns[0];
            const progress = getTestProgress(testRun);

            return (
              <motion.div
                key={suggestion.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-6 rounded-2xl border border-amber-400 bg-amber-50"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Loader2 className="w-6 h-6 text-amber-600 animate-spin" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h3 className="font-display font-bold text-lg text-neutral-800">
                          {getCityName(suggestion)}
                        </h3>
                        {suggestion.latitude && suggestion.longitude && (
                          <p className="font-body text-sm text-neutral-500">
                            {suggestion.latitude.toFixed(4)}, {suggestion.longitude.toFixed(4)}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary">
                        <ThumbsUp className="w-3 h-3 mr-1" />
                        {suggestion.voteCount}
                      </Badge>
                    </div>

                    {testRun && (
                      <div className="space-y-2 mt-4">
                        <div className="flex justify-between items-center">
                          <span className="font-body text-sm text-neutral-600">
                            Test Progress
                          </span>
                          <span className="font-body text-sm font-medium text-neutral-800">
                            {progress.marketsSettled} / {progress.marketsCreated} markets
                          </span>
                        </div>
                        <div className="w-full bg-neutral-200 rounded-full h-2">
                          <div
                            className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress.percentage}%` }}
                          />
                        </div>
                        {testRun.status === 'RUNNING' && (
                          <p className="font-body text-xs text-amber-700">
                            Test run in progress...
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </TabsContent>

      {/* Live Tab */}
      <TabsContent value="live" className="space-y-4">
        {live.length === 0 ? (
          <div className="p-8 rounded-2xl border border-neutral-200 bg-white text-center">
            <p className="font-body text-neutral-400">No cities in rotation yet</p>
          </div>
        ) : (
          live.map((suggestion, index) => (
            <motion.div
              key={suggestion.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-6 rounded-2xl border border-success-soft bg-success-soft/5"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-success-soft/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-success-soft" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="font-display font-bold text-lg text-neutral-800">
                        {getCityName(suggestion)}
                      </h3>
                      {suggestion.latitude && suggestion.longitude && (
                        <p className="font-body text-sm text-neutral-500">
                          {suggestion.latitude.toFixed(4)}, {suggestion.longitude.toFixed(4)}
                        </p>
                      )}
                    </div>
                    <Badge variant="default" className="bg-success-soft">
                      <ThumbsUp className="w-3 h-3 mr-1" />
                      {suggestion.voteCount}
                    </Badge>
                  </div>

                  {suggestion.timeWindow && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-neutral-400" />
                      <span className="font-body text-sm text-neutral-600">
                        {suggestion.timeWindow}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </TabsContent>

      {/* Rejected Tab */}
      <TabsContent value="rejected" className="space-y-4">
        {rejected.length === 0 ? (
          <div className="p-8 rounded-2xl border border-neutral-200 bg-white text-center">
            <p className="font-body text-neutral-400">No rejected suggestions</p>
          </div>
        ) : (
          rejected.map((suggestion, index) => (
            <motion.div
              key={suggestion.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-6 rounded-2xl border border-neutral-200 bg-neutral-50 opacity-60"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-neutral-200 flex items-center justify-center flex-shrink-0">
                  <XCircle className="w-6 h-6 text-neutral-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="font-display font-bold text-lg text-neutral-600">
                        {getCityName(suggestion)}
                      </h3>
                      {suggestion.latitude && suggestion.longitude && (
                        <p className="font-body text-sm text-neutral-400">
                          {suggestion.latitude.toFixed(4)}, {suggestion.longitude.toFixed(4)}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">
                      <ThumbsUp className="w-3 h-3 mr-1" />
                      {suggestion.voteCount}
                    </Badge>
                  </div>

                  {suggestion.comment && (
                    <div className="flex gap-2 p-3 rounded-lg bg-neutral-100">
                      <MessageSquare className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                      <p className="font-body text-sm text-neutral-500">
                        {suggestion.comment}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}
