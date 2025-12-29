'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  customCityName: z.string().min(1, 'City name is required').max(100),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  timeWindow: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT']).optional(),
  comment: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface SuggestionFormProps {
  wallet: string | null;
  onSuccess?: () => void;
}

export function SuggestionForm({ wallet, onSuccess }: SuggestionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customCityName: '',
      latitude: 0,
      longitude: 0,
      timeWindow: undefined,
      comment: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!wallet) {
      toast({
        title: 'Wallet required',
        description: 'Please connect your wallet to submit a suggestion',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': wallet,
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create suggestion');
      }

      toast({
        title: 'Suggestion submitted!',
        description: 'Your suggestion has been added and is now open for voting.',
      });

      form.reset();
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit suggestion',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="customCityName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>City Name</FormLabel>
              <FormControl>
                <Input placeholder="New York" {...field} />
              </FormControl>
              <FormDescription>
                Which city would you like to see markets for?
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="latitude"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Latitude</FormLabel>
                <FormControl>
                  <Input type="number" step="0.0001" placeholder="40.7128" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="longitude"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Longitude</FormLabel>
                <FormControl>
                  <Input type="number" step="0.0001" placeholder="-74.0060" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="timeWindow"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preferred Time Window (Optional)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a time window" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="MORNING">Morning (6am-12pm)</SelectItem>
                  <SelectItem value="AFTERNOON">Afternoon (12pm-6pm)</SelectItem>
                  <SelectItem value="EVENING">Evening (6pm-12am)</SelectItem>
                  <SelectItem value="NIGHT">Night (12am-6am)</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                When would you prefer to see markets for this city?
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Comment (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Why would this make a great market?"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Share why you think this would be a great market (max 500 characters)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting || !wallet} className="w-full">
          {isSubmitting ? 'Submitting...' : 'Submit Suggestion'}
        </Button>
      </form>
    </Form>
  );
}
