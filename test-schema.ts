import { CreateEventSchema } from './apps/api/src/modules/events/events.schema';

const payload = {
  title: 'Test',
  start_time: '2026-10-01T10:00:00.000Z',
  end_time: '2026-10-01T12:00:00.000Z',
  event_type: 'SEMINAR',
  club_ids: [{ club_id: '123e4567-e89b-12d3-a456-426614174000', is_primary: true }],
  minimum_team_size: 2,
  maximum_team_size: 4
};

const result = CreateEventSchema.parse({ body: payload });
console.log(result.body);
