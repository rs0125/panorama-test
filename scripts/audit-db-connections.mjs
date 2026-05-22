// Deeper audit: bucket the leaky sibling-app sessions by query pattern and
// connection age so we can pinpoint which app + which code path is leaking.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  // Per-table breakdown — which Prisma model is each idle connection sitting on
  const byTable = await prisma.$queryRawUnsafe(`
    SELECT
      regexp_replace(
        substring(query from '"public"\\."([A-Za-z_]+)"'),
        '"', '', 'g'
      ) AS table,
      COUNT(*)::int AS sessions,
      MIN((now() - backend_start)::text) AS youngest_conn,
      MAX((now() - backend_start)::text) AS oldest_conn,
      MIN((now() - state_change)::text)  AS shortest_idle,
      MAX((now() - state_change)::text)  AS longest_idle
    FROM pg_stat_activity
    WHERE backend_type = 'client backend'
      AND application_name = 'Supavisor'
      AND state = 'idle'
      AND query IS NOT NULL
    GROUP BY 1
    ORDER BY sessions DESC;
  `);
  console.log('=== Sessions grouped by last-touched table ===');
  console.table(byTable);

  // Distinct source addresses — is it really one deployment?
  const bySource = await prisma.$queryRawUnsafe(`
    SELECT
      client_addr::text AS client_ip,
      client_hostname,
      application_name  AS app,
      usename           AS user,
      COUNT(*)::int     AS sessions,
      MAX((now() - backend_start)::text) AS oldest
    FROM pg_stat_activity
    WHERE backend_type = 'client backend'
    GROUP BY 1, 2, 3, 4
    ORDER BY sessions DESC;
  `);
  console.log('\n=== Sessions grouped by source IP / app ===');
  console.table(bySource);

  // Statement-level: which exact queries are stuck idle?
  const byQuery = await prisma.$queryRawUnsafe(`
    SELECT
      LEFT(regexp_replace(query, E'[\\n\\r]+', ' ', 'g'), 160) AS query_head,
      COUNT(*)::int AS sessions,
      MAX((now() - state_change)::text) AS longest_idle
    FROM pg_stat_activity
    WHERE backend_type = 'client backend'
      AND application_name = 'Supavisor'
      AND state = 'idle'
    GROUP BY 1
    ORDER BY sessions DESC
    LIMIT 20;
  `);
  console.log('\n=== Top "last query" patterns across idle sessions ===');
  console.table(byQuery);

  // Idle distribution — is there one long-tail spike?
  const ageBuckets = await prisma.$queryRawUnsafe(`
    SELECT
      CASE
        WHEN now() - state_change < interval '1 minute'  THEN 'a: < 1 min'
        WHEN now() - state_change < interval '10 minute' THEN 'b: 1-10 min'
        WHEN now() - state_change < interval '1 hour'    THEN 'c: 10 min - 1 hr'
        WHEN now() - state_change < interval '6 hour'    THEN 'd: 1-6 hr'
        WHEN now() - state_change < interval '24 hour'   THEN 'e: 6-24 hr'
        ELSE                                                  'f: > 24 hr'
      END AS idle_bucket,
      COUNT(*)::int AS sessions
    FROM pg_stat_activity
    WHERE backend_type = 'client backend'
      AND application_name = 'Supavisor'
      AND state = 'idle'
    GROUP BY 1
    ORDER BY 1;
  `);
  console.log('\n=== Idle-duration buckets (Supavisor pool only) ===');
  console.table(ageBuckets);

  // pgbouncer counters — see what Supavisor itself thinks
  try {
    const stats = await prisma.$queryRawUnsafe(`SHOW pools;`);
    console.log('\n=== Supavisor pool stats ===');
    console.table(stats);
  } catch (e) {
    // Will fail when not connected to pgbouncer admin — fine.
  }
} finally {
  await prisma.$disconnect();
}
