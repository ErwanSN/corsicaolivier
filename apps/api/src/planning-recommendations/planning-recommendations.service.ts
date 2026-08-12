import { Injectable } from '@nestjs/common';

import { throwForSupabaseError } from '../common/supabase-error';
import { nullableRpcArgs } from '../database/database.aliases';
import type { Database } from '../database/database.types';
import { SupabaseService } from '../database/supabase.service';
import type { FindPlanningCandidatesDto } from './planning-recommendations.dto';

type CandidateRow =
  Database['public']['Functions']['get_planning_agent_candidates']['Returns'][number];
export type PlanningCandidate = Omit<CandidateRow, 'total_count'>;
export type PlanningCandidatePage = Readonly<{
  items: PlanningCandidate[];
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}>;

const DEFAULT_LIMIT = 20;

@Injectable()
export class PlanningRecommendationsService {
  constructor(private readonly supabase: SupabaseService) {}

  async findCandidates(
    accessToken: string,
    scheduleVersionId: string,
    input: FindPlanningCandidatesDto,
  ): Promise<PlanningCandidatePage> {
    const limit = input.limit ?? DEFAULT_LIMIT;
    const offset = input.offset ?? 0;
    const { data, error } = await this.supabase.forUser(accessToken).rpc(
      'get_planning_agent_candidates',
      nullableRpcArgs<
        'get_planning_agent_candidates',
        'excluded_shift_id' | 'search_query'
      >({
        target_schedule_version_id: scheduleVersionId,
        shift_starts_at: input.startsAt,
        shift_ends_at: input.endsAt,
        shift_segments: input.segments.map((segment) => ({
          positionId: segment.positionId,
          startsAt: segment.startsAt,
          endsAt: segment.endsAt,
        })),
        shift_breaks: (input.breaks ?? []).map((pause) => ({
          startsAt: pause.startsAt,
          endsAt: pause.endsAt,
        })),
        excluded_shift_id: input.excludedShiftId ?? null,
        search_query: input.q ?? null,
        result_limit: limit,
        result_offset: offset,
      }),
    );

    throwForSupabaseError(error, 'recherche des candidats éligibles');
    const rows = data ?? [];
    const total = rows.at(0)?.total_count ?? 0;
    const items = rows.map(({ total_count: totalCount, ...candidate }) => {
      void totalCount;
      return candidate;
    });

    return {
      items,
      limit,
      offset,
      total,
      hasMore: offset + items.length < total,
    };
  }
}
