# Supabase Edge Functions For Melioidosis

ฟังก์ชันที่เพิ่มเข้ามา:

- `melioidosis-ai-risk`
- `melioidosis-refresh-stats`

## 1. ตั้งค่า secret

ตั้ง `GEMINI_API_KEY` ใน Supabase project ก่อน deploy

```bash
supabase secrets set GEMINI_API_KEY=YOUR_REAL_GEMINI_API_KEY
```

หรือใส่ผ่าน Supabase Dashboard:

- `Project Settings`
- `Edge Functions`
- `Secrets`

## 2. Deploy functions

```bash
supabase functions deploy melioidosis-ai-risk
supabase functions deploy melioidosis-refresh-stats
```

## 3. หลัง deploy

หน้า `Melioidosis.html` จะเรียกผ่าน Supabase โดยใช้ `anon key` เดิมของโปรเจกต์

ไม่ต้องใส่ `gemini-api-key` ใน HTML อีก

## 4. หมายเหตุ

- ฟังก์ชันทั้งสองใช้ Google Search grounding
- มี model fallback ตามลำดับที่หน้าเว็บส่งไป
- ถ้า `gemini-3.1-flash-lite` ไม่มีในโปรเจกต์ ระบบจะพยายามข้ามไปตาม fallback ที่ใช้ได้
