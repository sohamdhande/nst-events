const { prisma } = require('@nst/database');
const sinon = require('sinon');
sinon.stub(prisma.attendanceSession, 'findMany').resolves([{ id: 'test', qrSecret: 'SECRET' }]);
prisma.attendanceSession.findMany().then(console.log);
