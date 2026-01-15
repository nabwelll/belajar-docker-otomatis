import http from 'k6/http';
import { check, sleep } from 'k6';

// KONFIGURASI SERANGAN
export const options = {
  // Kita bikin 3 tahap serangan
  stages: [
    { duration: '10s', target: 50 },  // Pemanasan: Naik ke 50 user dalam 10 detik
    { duration: '30s', target: 200 }, // Puncak: Tahan 200 user barengan selama 30 detik
    { duration: '10s', target: 0 },   // Pendinginan: Turun ke 0
  ],
};

export default function () {
  // Data user palsu
  const payload = JSON.stringify({
    nama: 'User Robot',
    umur: 25,
    perokok: 'tidak',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // TEMBAK!
  const res = http.post('http://localhost:8080/hitung', payload, params);

  // Cek hasilnya
  check(res, {
    'status 200 (Berhasil)': (r) => r.status === 200,
    'status 429 (Kena Blokir Satpam)': (r) => r.status === 429,
  });

  sleep(1); // Istirahat 1 detik sebelum nembak lagi
}