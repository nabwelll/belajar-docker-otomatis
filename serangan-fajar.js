import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 50 },
    { duration: '30s', target: 200 },
    { duration: '10s', target: 0 },
  ],
};

export default function () {
  // Data form (URL-encoded, bukan JSON!)
  const payload = 'nama=Robot&umur=25&perokok=tidak';

  const params = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': 'token_vip=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6ImJvc3MiLCJpYXQiOjE3NjkwNTE0MDUsImV4cCI6MTc2OTA1MjMwNX0.xe-MJted9-lm0uanxqPXBS-LuBVvy5VV_y-QQ5tlwMk'
    },
  };

  const res = http.post('http://localhost:8080/hitung', payload, params);

  check(res, {
    'status 302 (Redirect Berhasil)': (r) => r.status === 302 || r.status === 200,
  });

  sleep(1);
}