'use client';

import { type Suggestion, type City } from '@prisma/client';
import { MapPin, Clock, MessageSquare, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type SuggestionWithRelations = Suggestion & {
  city: City | null;
  _count?: {
    votes: number;
  };
};

interface SuggestionCardProps {
  suggestion: SuggestionWithRelations;
  onVote?: (suggestionId: string) => void;
  isVoted?: boolean;
  showVoteButton?: boolean;
}

const TIME_WINDOW_LABELS = {
  MORNING: '6am-12pm',
  AFTERNOON: '12pm-6pm',
  EVENING: '6pm-12am',
  NIGHT: '12am-6am',
};

export function SuggestionCard({
  suggestion,
  onVote,
  isVoted = false,
  showVoteButton = true,
}: SuggestionCardProps) {
  const cityName = suggestion.city?.name || suggestion.customCityName || 'Unknown City';
  const voteCount = suggestion.voteCount || 0;
  const recentVoteCount = suggestion.recentVoteCount || 0;
  const isTrending = recentVoteCount > 5; // Simple trending threshold

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              {cityName}
              {isTrending && (
                <Badge variant="secondary" className="ml-2">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Trending
                </Badge>
              )}
            </CardTitle>
          </div>

          <div className="flex flex-col items-end">
            <div className="text-2xl font-bold">{voteCount}</div>
            <div className="text-xs text-muted-foreground">
              {voteCount === 1 ? 'vote' : 'votes'}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {suggestion.timeWindow && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Clock className="h-4 w-4" />
            <span>{TIME_WINDOW_LABELS[suggestion.timeWindow]}</span>
          </div>
        )}

        {suggestion.comment && (
          <div className="flex items-start gap-2 text-sm mb-3">
            <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-muted-foreground italic">{suggestion.comment}</p>
          </div>
        )}

        {showVoteButton && onVote && (
          <button
            onClick={() => onVote(suggestion.id)}
            disabled={isVoted}
            className={`w-full mt-4 py-2 px-4 rounded-md font-medium transition-colors ${
              isVoted
                ? 'bg-green-100 text-green-700 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isVoted ? '✓ Voted' : 'Vote'}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
