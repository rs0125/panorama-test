// One-off: show active Postgres sessions so we can identify what's eating the
// session-pool budget. Uses DATABASE_URL (transaction pooler, port 6543) which
// still works while the session pooler (5432) is saturated.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      pid,
      usename            AS user,
      application_name   AS app,
      client_addr::text  AS client_ip,
      state,
      (now() - backend_start)::text AS connected_for,
      (now() - state_change)::text  AS in_state_for,
      backend_type,
      LEFT(query, 120)   AS last_query
    FROM pg_stat_activity
    WHERE backend_type = 'client backend'
    ORDER BY backend_start ASC;
  `);
  console.log(`Active client backends: ${rows.length}\n`);
  for (const r of rows) {
    console.log(
      `pid=${r.pid}  user=${r.user}  app=${r.app || '-'}  ip=${r.client_ip || '-'}  state=${r.state}`
    );
    console.log(`  connected_for=${formatInterval(r.connected_for)}  in_state_for=${formatInterval(r.in_state_for)}`);
    if (r.last_query) console.log(`  last_query: ${r.last_query}`);
    console.log();
  }
} finally {
  await prisma.$disconnect();
}

function formatInterval(iv) {
  if (!iv) return '-';
  // Prisma returns intervals as { milliseconds: N } in some versions, or as
  // an object with hours/minutes/seconds. Coerce to string.
  if (typeof iv === 'string') return iv;
  return JSON.stringify(iv);
}
