import type { SupabaseService } from '../database/supabase.service';
import { PlanningRecommendationsService } from './planning-recommendations.service';

const candidate = {
  agent_id: '00000000-0000-4000-8000-000000000101',
  employee_number: 'CL-101',
  display_name: 'Candidate recommandé',
  recommendation_rank: 1,
  preference_level: 'preferred',
  weekly_target_minutes: 2100,
  scheduled_week_minutes: 900,
  projected_week_minutes: 1350,
  weekly_deficit_minutes: 1200,
  recent_load_minutes: 1800,
  explanation: 'Poste apprécié · 20,0 h sous l’objectif',
  total_count: 7,
};

describe('PlanningRecommendationsService', () => {
  it('transmet les intervalles exacts et renvoie une page sans fuite interne', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [candidate], error: null });
    const service = new PlanningRecommendationsService({
      forUser: () => ({ rpc }),
    } as unknown as SupabaseService);

    await expect(
      service.findCandidates(
        'access-token',
        '00000000-0000-4000-8000-000000000010',
        {
          startsAt: '2026-08-11T06:00:00.000Z',
          endsAt: '2026-08-11T14:00:00.000Z',
          segments: [
            {
              positionId: '00000000-0000-4000-8000-000000000020',
              startsAt: '2026-08-11T06:00:00.000Z',
              endsAt: '2026-08-11T14:00:00.000Z',
            },
          ],
          breaks: [
            {
              startsAt: '2026-08-11T10:00:00.000Z',
              endsAt: '2026-08-11T10:30:00.000Z',
            },
          ],
          excludedShiftId: '00000000-0000-4000-8000-000000000030',
          q: 'Martin',
          limit: 10,
          offset: 0,
        },
      ),
    ).resolves.toEqual({
      items: [
        {
          agent_id: candidate.agent_id,
          employee_number: candidate.employee_number,
          display_name: candidate.display_name,
          recommendation_rank: candidate.recommendation_rank,
          preference_level: candidate.preference_level,
          weekly_target_minutes: candidate.weekly_target_minutes,
          scheduled_week_minutes: candidate.scheduled_week_minutes,
          projected_week_minutes: candidate.projected_week_minutes,
          weekly_deficit_minutes: candidate.weekly_deficit_minutes,
          recent_load_minutes: candidate.recent_load_minutes,
          explanation: candidate.explanation,
        },
      ],
      limit: 10,
      offset: 0,
      total: 7,
      hasMore: true,
    });

    expect(rpc).toHaveBeenCalledWith('get_planning_agent_candidates', {
      target_schedule_version_id: '00000000-0000-4000-8000-000000000010',
      shift_starts_at: '2026-08-11T06:00:00.000Z',
      shift_ends_at: '2026-08-11T14:00:00.000Z',
      shift_segments: [
        {
          positionId: '00000000-0000-4000-8000-000000000020',
          startsAt: '2026-08-11T06:00:00.000Z',
          endsAt: '2026-08-11T14:00:00.000Z',
        },
      ],
      shift_breaks: [
        {
          startsAt: '2026-08-11T10:00:00.000Z',
          endsAt: '2026-08-11T10:30:00.000Z',
        },
      ],
      excluded_shift_id: '00000000-0000-4000-8000-000000000030',
      search_query: 'Martin',
      result_limit: 10,
      result_offset: 0,
    });
  });
});
