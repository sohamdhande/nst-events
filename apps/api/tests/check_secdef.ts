import { adminPrisma } from './helpers/adminDb';

async function main() {
  const result = await adminPrisma.$queryRaw`
    SELECT 
        proname, 
        prosecdef,
        pg_get_functiondef(oid)
    FROM pg_proc 
    WHERE prosecdef = true AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  `;
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
