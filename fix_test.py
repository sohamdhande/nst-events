import re

with open('apps/api/tests/integration/phase26e-device-collision-race.test.ts', 'r') as f:
    text = f.read()

text = text.replace(
    'await adminPrisma.leaderboardScore.deleteMany({ where: { userId: student4 } });\n    await adminPrisma.eventRegistration.deleteMany({ where: { userId: student4 } });\n    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users DISABLE ROW LEVEL SECURITY`);\n    await adminPrisma.user.deleteMany({ where: { id: student4 } });\n    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);',
    'await adminPrisma.leaderboardScore.deleteMany({ where: { userId: student5 } });\n    await adminPrisma.eventRegistration.deleteMany({ where: { userId: student5 } });\n    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users DISABLE ROW LEVEL SECURITY`);\n    await adminPrisma.user.deleteMany({ where: { id: student5 } });\n    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);'
)

with open('apps/api/tests/integration/phase26e-device-collision-race.test.ts', 'w') as f:
    f.write(text)
