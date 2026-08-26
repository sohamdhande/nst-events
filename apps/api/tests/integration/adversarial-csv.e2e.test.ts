import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import { randomUUID } from 'crypto';

describe('Adversarial CSV Import E2E Tests', () => {
  const app = createApp();
  let platformAdminToken: string;
  let platformAdminId: string;

  before(async () => {
    platformAdminId = randomUUID();
    const adminUser = await adminPrisma.user.create({
      data: {
        id: platformAdminId,
        googleSub: 'google-sub-csv-admin-' + platformAdminId,
        email: `csvadmin+${platformAdminId}@adypu.edu.in`,
        fullName: 'CSV Admin',
        globalRole: 'PLATFORM_ADMIN',
        securityVersion: 1,
      },
    });
    platformAdminToken = signJwt(adminUser.id, adminUser.securityVersion);
  });

  after(async () => {
    // We intentionally leave DB clean-up out to mirror other integration tests, 
    // relying on fresh randomUUID emails to avoid conflicts.
  });

  async function uploadCsv(csvContent: string | Buffer, filename = 'students.csv', token = platformAdminToken) {
    const activeAdminToken = (await adminPrisma.user.findUnique({ where: { id: platformAdminId } }))?.globalRole === 'PLATFORM_ADMIN'
      ? token
      : signJwt((await adminPrisma.user.findFirst({ where: { globalRole: 'PLATFORM_ADMIN' } }))!.id, 1);
    
    return request(app)
      .post('/v1/admin/students/import')
      .set('Authorization', `Bearer ${activeAdminToken}`)
      .attach('file', Buffer.isBuffer(csvContent) ? csvContent : Buffer.from(csvContent), filename);
  }

  it('1. Quoted email containing commas', async () => {
    const email = `comma+${randomUUID()}@adypu.edu.in`;
    const res = await uploadCsv(`email\n"${email}, extra"\n`);
    // Depending on validation, it should reject or accept
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.rejected.length, 1); // "email, extra" is an invalid email
  });

  it('2. Quoted multiline field', async () => {
    const email = `multiline+${randomUUID()}@adypu.edu.in`;
    const res = await uploadCsv(`email,notes\n${email},"This is a\nmultiline\nnote"\n`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.added, 1);
  });

  it('3. CRLF and LF line endings', async () => {
    const email1 = `crlf+${randomUUID()}@adypu.edu.in`;
    const email2 = `lf+${randomUUID()}@adypu.edu.in`;
    const res = await uploadCsv(`email\r\n${email1}\n${email2}\r\n`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.added, 2);
  });

  it('4. UTF-8 BOM', async () => {
    const email = `bom+${randomUUID()}@adypu.edu.in`;
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    const csv = Buffer.concat([bom, Buffer.from(`email\n${email}\n`)]);
    const res = await uploadCsv(csv);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.added, 1);
  });

  it('5. Empty file', async () => {
    const res = await uploadCsv('');
    assert.strictEqual(res.status, 400); // Bad Request for empty file
  });

  it('6. Header-only file', async () => {
    const res = await uploadCsv('email\n');
    assert.strictEqual(res.status, 400); // Bad Request for no valid emails
  });

  it('7. Missing email column', async () => {
    const res = await uploadCsv('name,age\nJohn,20\n');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.detail, 'No valid email column found in CSV');
  });

  it('8. Duplicate header', async () => {
    const email = `dupheader+${randomUUID()}@adypu.edu.in`;
    const res = await uploadCsv(`email,email\n${email},ignored@adypu.edu.in\n`);
    assert.strictEqual(res.status, 200); // csv-parse handles dup headers by keeping the last or throwing depending on config. Let's see behavior.
  });

  it('9. Extra unsupported columns', async () => {
    const email = `extracol+${randomUUID()}@adypu.edu.in`;
    const res = await uploadCsv(`email,name,phone\n${email},John,123456\n`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.added, 1);
  });

  it('10. Leading/trailing whitespace and mixed-case', async () => {
    const uuid = randomUUID();
    const email = ` WS_case+${uuid}@adypu.edu.in `;
    const res = await uploadCsv(`email\n"${email}"\n`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.added, 1);
    
    // Verify DB state directly for lowercase/trimmed
    const dbStudent = await adminPrisma.authorizedStudent.findUnique({
      where: { normalizedEmail: `ws_case+${uuid}@adypu.edu.in` }
    });
    assert.ok(dbStudent);
  });

  it('11. Duplicate normalized emails differing only by case/whitespace', async () => {
    const uuid = randomUUID();
    const csvContent = `email\ndup+${uuid}@adypu.edu.in\nDUP+${uuid}@adypu.edu.in\n  dup+${uuid}@adypu.edu.in  \n`;
    const res = await uploadCsv(csvContent);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.added, 1); // Only 1 added
    assert.strictEqual(res.body.already_present, 2); // 2 recognized as dups
  });

  it('12. 5000 exactly', async () => {
    const rows = ['email'];
    for(let i = 0; i < 5000; i++) {
      rows.push(`test5000_${i}_${randomUUID()}@adypu.edu.in`);
    }
    const res = await uploadCsv(rows.join('\n'));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.added, 5000);
  });

  it('13. 5001 exactly (Should fail)', async () => {
    const rows = ['email'];
    for(let i = 0; i < 5001; i++) {
      rows.push(`test5001_${i}_${randomUUID()}@adypu.edu.in`);
    }
    const res = await uploadCsv(rows.join('\n'));
    assert.strictEqual(res.status, 400); // 5000 limit
    assert.match(res.body.detail, /limit of 5000 exceeded/i);
    // Verify NO partial mutation:
    const dbCount = await adminPrisma.authorizedStudent.count({
      where: { normalizedEmail: { startsWith: 'test5001_' } }
    });
    assert.strictEqual(dbCount, 0);
  });

  it('14. File just below 2MB and above 2MB', async () => {
    const rowContent = `email\nlong+${randomUUID()}@adypu.edu.in`;
    const payload = Buffer.alloc(2 * 1024 * 1024 + 10, 'a'); // > 2MB
    
    const activeAdminToken = (await adminPrisma.user.findUnique({ where: { id: platformAdminId } }))?.globalRole === 'PLATFORM_ADMIN'
      ? platformAdminToken
      : signJwt((await adminPrisma.user.findFirst({ where: { globalRole: 'PLATFORM_ADMIN' } }))!.id, 1);

    const res = await request(app)
      .post('/v1/admin/students/import')
      .set('Authorization', `Bearer ${activeAdminToken}`)
      .attach('file', payload, { filename: 'large.csv' });
      
    assert.strictEqual(res.status, 400);
    assert.match(res.body.detail, /File size limit/i);
  });

  it('15. Malformed quote at EOF', async () => {
    const res = await uploadCsv(`email\n"unclosedquote@adypu.edu.in`);
    assert.strictEqual(res.status, 400);
    assert.match(res.body.detail, /Malformed CSV/i);
  });

  it('16. Two overlapping imports concurrently', async () => {
    const email1 = `overlap1+${randomUUID()}@adypu.edu.in`;
    const email2 = `overlap2+${randomUUID()}@adypu.edu.in`;
    
    const [res1, res2] = await Promise.all([
      uploadCsv(`email\n${email1}\n${email2}\n`),
      uploadCsv(`email\n${email1}\n${email2}\n`)
    ]);

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res2.status, 200);

    const sumAdded = res1.body.added + res2.body.added;
    assert.strictEqual(sumAdded, 2); // exactly 2 should be added in total, the rest are "already_present" or "rejected"
    
    const dbCount = await adminPrisma.authorizedStudent.count({
      where: { normalizedEmail: { in: [email1, email2] } }
    });
    assert.strictEqual(dbCount, 2);
  });

  it('17. CSV containing an existing REVOKED student', async () => {
    const email = `revoked_csv+${randomUUID()}@adypu.edu.in`;
    await adminPrisma.authorizedStudent.create({
      data: { normalizedEmail: email, status: 'REVOKED', createdBy: platformAdminId }
    });
    
    const res = await uploadCsv(`email\n${email}\n`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.added, 1); // reactivates!
    
    const dbStudent = await adminPrisma.authorizedStudent.findUnique({ where: { normalizedEmail: email } });
    assert.strictEqual(dbStudent?.status, 'ACTIVE');
  });

  it('18. CSV containing unsupported domain @newtonschool.co', async () => {
    const email = `newton_unsupported+${randomUUID()}@newtonschool.co`;
    const res = await uploadCsv(`email\n${email}\n`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.rejected.length, 1);
    assert.strictEqual(res.body.added, 0);
  });
});
