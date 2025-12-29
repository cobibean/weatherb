'use client';

import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { SuggestionList } from '@/components/voting/suggestion-list';
import { SuggestionForm } from '@/components/voting/suggestion-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function VotingPage() {
  const account = useActiveAccount();
  const wallet = account?.address || null;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSuggestionSuccess = () => {
    setIsFormOpen(false);
    setRefreshKey((k) => k + 1); // Trigger list refresh
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Market Suggestions</h1>
          <p className="text-muted-foreground">
            Suggest new markets and vote on your favorites
          </p>
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="h-5 w-5 mr-2" />
              Suggest Market
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Suggest a New Market</DialogTitle>
              <DialogDescription>
                Help grow WeatherB by suggesting cities and times you'd like to bet on
              </DialogDescription>
            </DialogHeader>
            <SuggestionForm wallet={wallet} onSuccess={handleSuggestionSuccess} />
          </DialogContent>
        </Dialog>
      </div>

      <SuggestionList key={refreshKey} wallet={wallet} />
    </div>
  );
}
