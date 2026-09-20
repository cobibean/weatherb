'use client';

import { useState, useTransition } from 'react';
import { ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface VoteButtonProps {
  suggestionId: string;
  initialVoted: boolean;
  initialVoteCount: number;
  wallet: string | null;
  onVoteChange?: (voted: boolean) => void;
}

export function VoteButton({
  suggestionId,
  initialVoted,
  initialVoteCount,
  wallet,
  onVoteChange,
}: VoteButtonProps) {
  const [isVoted, setIsVoted] = useState(initialVoted);
  const [voteCount, setVoteCount] = useState(initialVoteCount);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleVote = async () => {
    if (!wallet) {
      toast({
        title: 'Wallet required',
        description: 'Please connect your wallet to vote',
        variant: 'destructive',
      });
      return;
    }

    // Optimistic update
    const previousVoted = isVoted;
    const previousCount = voteCount;
    setIsVoted(!isVoted);
    setVoteCount(isVoted ? voteCount - 1 : voteCount + 1);
    onVoteChange?.(!isVoted);

    startTransition(async () => {
      try {
        const method = previousVoted ? 'DELETE' : 'POST';
        const response = await fetch(`/api/suggestions/${suggestionId}/vote`, {
          method,
          headers: {
            'x-wallet-address': wallet,
          },
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update vote');
        }

        toast({
          title: previousVoted ? 'Vote removed' : 'Vote cast',
          description: previousVoted ? 'Your vote has been removed' : 'Thanks for voting!',
        });
      } catch (error) {
        // Revert optimistic update
        setIsVoted(previousVoted);
        setVoteCount(previousCount);
        onVoteChange?.(previousVoted);

        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to update vote',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Button
      onClick={handleVote}
      disabled={isPending || !wallet}
      variant={isVoted ? 'outline' : 'default'}
      className="w-full"
    >
      <ThumbsUp className={`h-4 w-4 mr-2 ${isVoted ? 'fill-current' : ''}`} />
      {isVoted ? 'Voted' : 'Vote'}
      <span className="ml-2 font-bold">({voteCount})</span>
    </Button>
  );
}
