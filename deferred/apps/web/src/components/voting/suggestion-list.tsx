'use client';

import { useState, useEffect } from 'react';
import { SuggestionCard } from './suggestion-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type Suggestion, type City } from '@prisma/client';

type SuggestionWithRelations = Suggestion & {
  city: City | null;
  _count?: {
    votes: number;
  };
};

type SortType = 'votes' | 'recent' | 'trending';

interface SuggestionListProps {
  wallet: string | null;
}

export function SuggestionList({ wallet }: SuggestionListProps) {
  const [suggestions, setSuggestions] = useState<SuggestionWithRelations[]>([]);
  const [votedMap, setVotedMap] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeSort, setActiveSort] = useState<SortType>('votes');

  useEffect(() => {
    fetchSuggestions(activeSort);
  }, [activeSort]);

  const fetchSuggestions = async (sort: SortType) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/suggestions?sort=${sort}&limit=50`);
      if (!response.ok) throw new Error('Failed to fetch suggestions');

      const data = await response.json();
      setSuggestions(data.suggestions);

      // Fetch voted status for each suggestion if wallet connected
      if (wallet) {
        const votedStatuses = await Promise.all(
          data.suggestions.map(async (s: SuggestionWithRelations) => {
            const res = await fetch(`/api/suggestions/${s.id}/voted`, {
              headers: { 'x-wallet-address': wallet },
            });
            const votedData = await res.json();
            return [s.id, votedData.voted] as [string, boolean];
          })
        );
        setVotedMap(new Map(votedStatuses));
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (suggestionId: string) => {
    if (!wallet) return;

    const isVoted = votedMap.get(suggestionId) || false;

    try {
      const method = isVoted ? 'DELETE' : 'POST';
      const response = await fetch(`/api/suggestions/${suggestionId}/vote`, {
        method,
        headers: { 'x-wallet-address': wallet },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      // Update voted map
      setVotedMap(new Map(votedMap.set(suggestionId, !isVoted)));

      // Refresh suggestions to get updated counts
      fetchSuggestions(activeSort);
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading suggestions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeSort} onValueChange={(v) => setActiveSort(v as SortType)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="votes">Top Voted</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="recent">Recent</TabsTrigger>
        </TabsList>

        <TabsContent value={activeSort} className="mt-6">
          {suggestions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No suggestions yet. Be the first to suggest a market!
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onVote={handleVote}
                  isVoted={votedMap.get(suggestion.id) || false}
                  showVoteButton={!!wallet}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
