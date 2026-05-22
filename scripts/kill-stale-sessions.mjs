// Terminate idle Supavisor sessions to free up the session-pool cap.
// Excludes our own pid and Supabase internal users.
// State='idle' only — never kills 'idle in transaction' or 'active'.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      pid,
      pg_terminate_backend(pid) AS terminated,
      (now() - state_change)::text AS was_idle_for,
      LEFT(query, 80) AS last_query
    FROM pg_stat_activity
    WHERE backend_type = 'client backend'
      AND application_name = 'Supavisor'
      AND usename = 'postgres'
      AND state = 'idle'
      AND pid <> pg_backend_pid();
  `);
  const ok = rows.filter((r) => r.terminated).length;
  const fail = rows.length - ok;
  console.log(`Terminated ${ok} idle Supavisor sessions${fail ? ` (${fail} failed)` : ''}.`);
  for (const r of rows) {
    console.log(
      `  pid=${r.pid}  terminated=${r.terminated}  was_idle_for=${r.was_idle_for}`
    );
  }
} finally {
  await prisma.$disconnect();
}
