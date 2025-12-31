/**
 * Test Run Monitor Component
 *
 * Displays live test run progress with real-time updates via SSE.
 * Shows per-market status, payout verification, and fund recovery.
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  TrendingUp,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { useTestRunStream, type TestRunData } from '@/hooks/useTestRunStream';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface TestRunMonitorProps {
  testRunId: string;
}

export function TestRunMonitor({ testRunId }: TestRunMonitorProps): React.ReactElement {
  const { testRun, isConnected, error } = useTestRunStream(testRunId);

  if (error) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <div className="flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <div>
            <p className="font-semibold">Connection Error</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (!testRun) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center gap-3 text-neutral-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p>Loading test run data...</p>
        </div>
      </Card>
    );
  }

  const progress = (testRun.marketsSettled / testRun.marketsCreated) * 100;
  const isComplete = testRun.status !== 'RUNNING';
  const duration = testRun.completedAt
    ? Math.floor((new Date(testRun.completedAt).getTime() - new Date(testRun.createdAt).getTime()) / 1000 / 60)
    : Math.floor((Date.now() - new Date(testRun.createdAt).getTime()) / 1000 / 60);

  return (
    <Card className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold text-neutral-800">
            Testing: {testRun.cityName}
          </h3>
          <p className="text-sm text-neutral-500 mt-1">
            Started {new Date(testRun.createdAt).toLocaleString()}
            {' • '}
            {duration}m elapsed
          </p>
        </div>

        {/* Status Badge */}
        <Badge
          variant={
            testRun.status === 'COMPLETED' ? 'default' :
            testRun.status === 'FAILED' ? 'destructive' :
            'secondary'
          }
        >
          {testRun.status}
        </Badge>
      </div>

      {/* Connection Status */}
      {!isComplete && (
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-neutral-600">
            {isConnected ? 'Live updates active' : 'Reconnecting...'}
          </span>
        </div>
      )}

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-700 font-medium">
            Progress: {testRun.marketsSettled}/{testRun.marketsCreated} markets settled
          </span>
          <span className="text-neutral-500">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Markets List */}
      <div className="space-y-3">
        <h4 className="font-semibold text-neutral-700 text-sm">Markets</h4>
        <div className="space-y-2">
          {testRun.markets.map((market, index) => (
            <MarketCard key={market.id} market={market} index={index} />
          ))}
        </div>
      </div>

      {/* Fund Recovery Status */}
      <div className="pt-4 border-t space-y-2">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-neutral-500" />
          <h4 className="font-semibold text-neutral-700 text-sm">Fund Recovery</h4>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-neutral-500">Initial Funding</p>
            <p className="font-mono font-semibold text-neutral-800">
              {parseFloat(testRun.fundingAmount).toFixed(2)} FLR
            </p>
          </div>
          <div>
            <p className="text-neutral-500">Recovered</p>
            <p className="font-mono font-semibold text-neutral-800">
              {testRun.recoveredAmount
                ? `${parseFloat(testRun.recoveredAmount).toFixed(2)} FLR`
                : 'Pending...'}
            </p>
          </div>
          <div>
            <p className="text-neutral-500">Net Cost</p>
            <p className="font-mono font-semibold text-neutral-800">
              {testRun.netCost
                ? `${parseFloat(testRun.netCost).toFixed(2)} FLR`
                : 'Calculating...'}
            </p>
          </div>
        </div>
      </div>

      {/* Overall Status */}
      {isComplete && (
        <div className={`p-4 rounded-lg ${
          testRun.status === 'COMPLETED' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-3">
            {testRun.status === 'COMPLETED' ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">All Tests Passed</p>
                  <p className="text-sm text-green-700">
                    City is ready for promotion. Check your email for detailed results.
                  </p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="font-semibold text-red-900">Tests Failed</p>
                  <p className="text-sm text-red-700">
                    Review the failed markets and email details before retrying.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

interface MarketCardProps {
  market: TestRunData['markets'][0];
  index: number;
}

function MarketCard({ market, index }: MarketCardProps): React.ReactElement {
  const resolveTime = new Date(market.resolveTime);
  const now = new Date();
  const isPending = !market.isSettled;
  const minutesUntilResolve = isPending
    ? Math.max(0, Math.floor((resolveTime.getTime() - now.getTime()) / 1000 / 60))
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`p-4 rounded-lg border ${
        market.isSettled
          ? 'bg-white border-neutral-200'
          : 'bg-neutral-50 border-neutral-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Status Icon */}
          {isPending ? (
            <Clock className="w-4 h-4 text-neutral-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          )}

          {/* Market Info */}
          <div>
            <p className="font-medium text-neutral-800 text-sm">
              Market #{index + 1} {isPending && `(+${index * 30 + 30}m)`}
            </p>
            <p className="text-xs text-neutral-500">
              Resolves: {resolveTime.toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        {isPending ? (
          <Badge variant="outline" className="text-xs">
            ⏳ {minutesUntilResolve}m remaining
          </Badge>
        ) : (
          <Badge
            variant={market.outcome === 'YES' ? 'default' : 'secondary'}
            className="text-xs"
          >
            ✅ {market.outcome} wins
          </Badge>
        )}
      </div>

      {/* Threshold Info (when settled) */}
      {market.isSettled && (
        <div className="mt-3 pt-3 border-t text-xs space-y-1">
          <div className="flex items-center justify-between text-neutral-600">
            <span>Threshold:</span>
            <span className="font-mono">{market.threshold}°F</span>
          </div>
          {market.actualTemp !== undefined && (
            <div className="flex items-center justify-between text-neutral-600">
              <span>Actual:</span>
              <span className="font-mono font-semibold">{market.actualTemp}°F</span>
            </div>
          )}
          {market.settledAt && (
            <div className="flex items-center justify-between text-neutral-500 text-xs">
              <span>Settled:</span>
              <span>{new Date(market.settledAt).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
