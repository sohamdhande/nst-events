import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.$queryRaw`
    SELECT
      e.id as event_id,
      COUNT(t.id)::int as below_minimum_team_count
    FROM events e
    JOIN teams t ON t.event_id = e.id
    WHERE t.status = 'REGISTERED'
      AND t.deleted_at IS NULL
      AND (
        SELECT COUNT(*) FROM event_registrations er
        WHERE er.team_id = t.id AND er.deleted_at IS NULL
      ) < (e.metadata->>'minimum_team_size')::int
    GROUP BY e.id
  `;
  console.log(result);
}
main().catch(console.error).finally(() => prisma.$disconnect());
