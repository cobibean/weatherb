'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ThumbsUp,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SuggestionWithVotes } from '@/lib/admin-suggestions';
import { getTestProgress } from '@/lib/admin-suggestions';
import { TestRunMonitor } from '@/components/admin/test-run-monitor';

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
      const authToken = typeof window !== 'undefined'
        ? localStorage.getItem('adminToken') || ''
        : '';

      if (!authToken) {
        console.error('No admin token found');
        alert('Authentication required. Please log in again.');
        return;
      }

      const response = await fetch('/api/admin/suggestions/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ suggestionId: id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve suggestion');
      }

      router.refresh();
    } catch (error) {
      console.error('Failed to approve:', error);
      alert(error instanceof Error ? error.message : 'Failed to approve suggestion');
    } finally {
      setApprovingId(null);
    }
  };

  const handleDeny = async (id: string): Promise<void> => {
    setDenyingId(id);
    try {
      const authToken = typeof window !== 'undefined'
        ? localStorage.getItem('adminToken') || ''
        : '';

      if (!authToken) {
        console.error('No admin token found');
        alert('Authentication required. Please log in again.');
        return;
      }

      const response = await fetch('/api/admin/suggestions/deny', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ suggestionId: id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to deny suggestion');
      }

      router.refresh();
    } catch (error) {
      console.error('Failed to deny:', error);
      alert(error instanceof Error ? error.message : 'Failed to deny suggestion');
    } finally {
      setDenyingId(null);
    }
  };

  const getCityName = (suggestion: SuggestionWithVotes): string => {
    return suggestion.customCityName || 'Unknown City';
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (date: Date): string => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const estimateCompletion = (testRun: SuggestionWithVotes['testRuns'][0] | undefined): string => {
    if (!testRun) return 'N/A';

    const progress = getTestProgress(testRun);
    if (progress.percentage >= 100) return 'Complete';

    // Estimate based on typical test duration (3-7 days)
    const daysSinceStart = Math.floor(
      (Date.now() - testRun.startedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const estimatedDays = Math.max(7 - daysSinceStart, 0);

    if (estimatedDays === 0) return 'Soon';
    if (estimatedDays === 1) return '1 day';
    return `${estimatedDays} days`;
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
      <TabsContent value="pending">
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
          {pending.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-body text-neutral-400">No pending suggestions</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-display font-semibold text-neutral-800">City</TableHead>
                  <TableHead className="font-display font-semibold text-neutral-800">Total Votes</TableHead>
                  <TableHead className="font-display font-semibold text-neutral-800">Recent Votes (7d)</TableHead>
                  <TableHead className="font-display font-semibold text-neutral-800">Time Preference</TableHead>
                  <TableHead className="font-display font-semibold text-neutral-800 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((suggestion, index) => (
                  <motion.tr
                    key={suggestion.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b last:border-0 hover:bg-neutral-50"
                  >
                    <TableCell>
                      <div>
                        <div className="font-display font-semibold text-neutral-800">
                          {getCityName(suggestion)}
                        </div>
                        {suggestion.latitude && suggestion.longitude && (
                          <div className="font-body text-xs text-neutral-500 mt-0.5">
                            {suggestion.latitude.toFixed(4)}, {suggestion.longitude.toFixed(4)}
                          </div>
                        )}
                        {suggestion.comment && (
                          <div className="font-body text-xs text-neutral-600 mt-1 italic">
                            "{suggestion.comment}"
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-body">
                        <ThumbsUp className="w-3 h-3 mr-1" />
                        {suggestion.voteCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-body text-sm text-neutral-700">
                        {suggestion.recentVotes7d || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      {suggestion.timeWindow ? (
                        <Badge variant="outline" className="font-body capitalize">
                          <Clock className="w-3 h-3 mr-1" />
                          {suggestion.timeWindow.toLowerCase()}
                        </Badge>
                      ) : (
                        <span className="font-body text-sm text-neutral-400">Any</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApprove(suggestion.id)}
                          disabled={approvingId === suggestion.id || denyingId === suggestion.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success-soft text-white text-sm font-body font-medium hover:bg-success-soft/80 transition-colors disabled:opacity-50"
                        >
                          {approvingId === suggestion.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => handleDeny(suggestion.id)}
                          disabled={approvingId === suggestion.id || denyingId === suggestion.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error-soft text-white text-sm font-body font-medium hover:bg-error-soft/80 transition-colors disabled:opacity-50"
                        >
                          {denyingId === suggestion.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          Deny
                        </button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </TabsContent>

      {/* Testing Tab - Live Monitoring */}
      <TabsContent value="testing">
        {testing.length === 0 ? (
          <div className="rounded-2xl border border-amber-400 bg-amber-50 p-8 text-center">
            <p className="font-body text-neutral-400">No cities currently in testing</p>
          </div>
        ) : (
          <div className="space-y-4">
            {testing.map((suggestion, index) => {
              const testRun = suggestion.testRuns[0];

              if (!testRun) return null;

              // For live monitoring, we'll need admin auth token
              // In a real implementation, get this from session/cookie
              const authToken = typeof window !== 'undefined'
                ? localStorage.getItem('adminToken') || ''
                : '';

              return (
                <motion.div
                  key={suggestion.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <TestRunMonitor
                    testRunId={testRun.id}
                    authToken={authToken}
                  />
                </motion.div>
              );
            })}
          </div>
        )}
      </TabsContent>

      {/* Live Tab */}
      <TabsContent value="live">
        <div className="rounded-2xl border border-success-soft bg-success-soft/5 overflow-hidden">
          {live.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-body text-neutral-400">No cities in rotation yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-display font-semibold text-neutral-800">City</TableHead>
                  <TableHead className="font-display font-semibold text-neutral-800">Added</TableHead>
                  <TableHead className="font-display font-semibold text-neutral-800">Total Votes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {live.map((suggestion, index) => (
                  <motion.tr
                    key={suggestion.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b last:border-0 hover:bg-success-soft/10"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success-soft flex-shrink-0" />
                        <div>
                          <div className="font-display font-semibold text-neutral-800">
                            {getCityName(suggestion)}
                          </div>
                          {suggestion.latitude && suggestion.longitude && (
                            <div className="font-body text-xs text-neutral-500 mt-0.5">
                              {suggestion.latitude.toFixed(4)}, {suggestion.longitude.toFixed(4)}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-body text-sm text-neutral-700">
                        {formatDate(suggestion.updatedAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-success-soft font-body">
                        <ThumbsUp className="w-3 h-3 mr-1" />
                        {suggestion.voteCount}
                      </Badge>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </TabsContent>

      {/* Rejected Tab */}
      <TabsContent value="rejected">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 overflow-hidden">
          {rejected.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-body text-neutral-400">No rejected suggestions</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-display font-semibold text-neutral-600">City</TableHead>
                  <TableHead className="font-display font-semibold text-neutral-600">Rejected Date</TableHead>
                  <TableHead className="font-display font-semibold text-neutral-600">Votes at Rejection</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejected.map((suggestion, index) => (
                  <motion.tr
                    key={suggestion.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b last:border-0 hover:bg-neutral-100 opacity-60"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                        <div>
                          <div className="font-display font-semibold text-neutral-600">
                            {getCityName(suggestion)}
                          </div>
                          {suggestion.latitude && suggestion.longitude && (
                            <div className="font-body text-xs text-neutral-400 mt-0.5">
                              {suggestion.latitude.toFixed(4)}, {suggestion.longitude.toFixed(4)}
                            </div>
                          )}
                          {suggestion.comment && (
                            <div className="font-body text-xs text-neutral-500 mt-1 italic">
                              "{suggestion.comment}"
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-body text-sm text-neutral-600">
                        {formatDate(suggestion.updatedAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-body">
                        <ThumbsUp className="w-3 h-3 mr-1" />
                        {suggestion.voteCount}
                      </Badge>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
