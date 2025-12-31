import { z } from 'zod';

/**
 * Validation schemas for Epic 7 Suggestion API
 */

// TimeWindow enum from Prisma
export const timeWindowSchema = z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT']);

// Create suggestion input
export const createSuggestionSchema = z.object({
  // Either cityId OR custom city details required
  cityId: z.string().cuid().optional(),
  customCityName: z.string().min(1).max(100).optional(),

  timeWindow: timeWindowSchema.optional(),
  comment: z.string().max(500).optional(),
}).refine(
  (data) => {
    // Either cityId OR custom city name required
    const hasCity = !!data.cityId;
    const hasCustomCity = !!data.customCityName;
    return hasCity || hasCustomCity;
  },
  {
    message: 'Either cityId or customCityName is required',
  }
);

// Query params for listing suggestions
export const listSuggestionsSchema = z.object({
  sort: z.enum(['votes', 'recent', 'trending']).default('votes'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'IMPLEMENTED']).optional(),
});

// Export types
export type CreateSuggestionInput = z.infer<typeof createSuggestionSchema>;
export type ListSuggestionsQuery = z.infer<typeof listSuggestionsSchema>;
