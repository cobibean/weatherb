-- Epic 7 Database Constraints
-- Run manually after Prisma migrations
-- These constraints ensure data integrity beyond Prisma's capabilities

-- Ensure voteCount never goes negative
ALTER TABLE "Suggestion"
ADD CONSTRAINT vote_count_non_negative
CHECK ("voteCount" >= 0);

-- Ensure recentVoteCount never exceeds total voteCount
ALTER TABLE "Suggestion"
ADD CONSTRAINT recent_votes_valid
CHECK ("recentVoteCount" <= "voteCount");

-- Ensure either cityId or customCityName is present (Issue #4)
ALTER TABLE "Suggestion"
ADD CONSTRAINT city_required
CHECK (
  ("cityId" IS NOT NULL) OR
  ("customCityName" IS NOT NULL AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL)
);

-- Ensure recentVoteCount is non-negative
ALTER TABLE "Suggestion"
ADD CONSTRAINT recent_vote_count_non_negative
CHECK ("recentVoteCount" >= 0);
