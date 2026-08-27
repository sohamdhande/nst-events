import { adminPrisma } from './helpers/adminDb';

async function main() {
  const result = await adminPrisma.$queryRaw`
    SELECT 
        proname, 
        prosecdef,
        pg_get_functiondef(oid)
    FROM pg_proc 
    WHERE proname IN ('current_user_id', 'current_user_global_role');
  `;
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
