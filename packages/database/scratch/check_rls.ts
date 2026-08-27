import { adminPrisma } from '../../apps/api/tests/helpers/adminDb';

async function main() {
  const result = await adminPrisma.$queryRaw`
    SELECT 
        c.relname as table_name,
        c.relrowsecurity as rls_enabled,
        c.relforcerowsecurity as rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
    AND c.relkind = 'r'
    ORDER BY c.relname;
  `;
  console.log(JSON.stringify(result, null, 2));
  
  const policies = await adminPrisma.$queryRaw`
    SELECT * FROM pg_policies WHERE schemaname = 'public';
  `;
  console.log(JSON.stringify(policies, null, 2));

  // Also check nst_app user
  const roles = await adminPrisma.$queryRaw`
    SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls
    FROM pg_roles WHERE rolname = 'nst_app';
  `;
  console.log('Roles:', JSON.stringify(roles, null, 2));

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
