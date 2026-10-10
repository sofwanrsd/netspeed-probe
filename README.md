# NetSpeed Probe

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js: 16](https://img.shields.io/badge/Next.js-16.4-black.svg?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS: v4](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4.svg?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

Tool web diagnostik jaringan dan uji kecepatan domain berperforma tinggi dengan pengukuran waktu mikrodetik (*high-resolution socket telemetry*). Didesain dengan antarmuka modern bernuansa *Vercel/Linear dark aesthetics*.

---

## Fitur Utama

- **Waterfall Connection Breakdown:** Visualisasi tahap demi tahap koneksi jaringan secara granular:
  - **DNS Lookup Time:** Waktu resolusi nama domain ke alamat IP Anycast.
  - **TCP Handshake Time:** Durasi pembentukan socket TCP koneksi awal.
  - **TLS Handshake Time:** Kecepatan negosiasi enkripsi SSL/TLS (protokol & cipher suite).
  - **TTFB (Time to First Byte):** Waktu respon awal server tujuan saat memproses request.
  - **Download / Content Transfer:** Waktu transfer payload dan perhitungan throughput bandwidth (Mbps).
- **Inteligensi Jaringan & Geolocation:**
  - Deteksi lokasi fisik server target (negara, kota, koordinat, zona waktu).
  - Informasi ISP dan Autonomous System Number (ASN / Organisasi).
  - Pencarian seluruh alamat IP yang terasosiasi (DNS A records).
- **Deteksi CDN Otomatis:** Mengidentifikasi jaringan pengantar konten (Cloudflare, Amazon CloudFront, Akamai, Fastly, Vercel Edge, Netlify) atau koneksi langsung ke server asal (*Origin*).
- **Inspektur Keamanan SSL/TLS:** Memeriksa versi protokol TLS aktif (TLSv1.3/TLSv1.2), cipher suite, penerbit sertifikat, dan hitung mundur sisa masa berlaku sertifikat.
- **SSRF Shield Guard:** Perlindungan keamanan tingkat aplikasi yang memblokir probing ke IP private/internal/loopback.

---

## Panduan Menjalankan Lokal

1. **Clone Repositori:**
   ```bash
   git clone https://github.com/sofwanrsd/netspeed-probe.git
   cd netspeed-probe
   ```

2. **Instalasi Dependensi:**
   ```bash
   npm install
   ```

3. **Jalankan Mode Pengembangan:**
   ```bash
   npm run dev
   ```
   Buka peramban di `http://localhost:3000`.

4. **Kompilasi Produksi:**
   ```bash
   npm run build
   npm run start
   ```

---

## Kontribusi

Kontribusi, perbaikan bug, saran fitur, issue, dan pull request sangat terbuka bebas bagi siapa saja yang ingin mengembangkan proyek ini lebih lanjut. Silakan fork repositori ini dan ajukan pull request.

---

## Lisensi

Proyek ini dilisensikan di bawah lisensi MIT. Lihat file [LICENSE](LICENSE) untuk detail lengkap.
