import request from 'supertest';
import { createApp } from './src/app';
import { adminPrisma } from './tests/helpers/adminDb';
import { signJwt } from './src/lib/jwt';
import { generateTotp } from './src/modules/attendance/totp.utils';

async function main() {
  const app = createApp();
  const student = 'f74c7c5b-7b00-4b6c-8c01-8b01c0c0c994';
  const studentToken = signJwt(student);
  const sessionId = 'f74c7c5b-7b00-4b6c-8c01-8b01c0c0c991';
  
  const res = await request(app).post('/v1/attendance/mark').set('Authorization', `Bearer ${studentToken}`).send({
    session_id: sessionId, totp_token: generateTotp('SECRET'), latitude: 91, longitude: 10, device_id: 'd1', device_os: 'iOS', gps_accuracy: 5, mock_location_detected: false, app_version: '1.0'
  });
  
  console.log(res.status, res.body);
  process.exit(0);
}
main();
