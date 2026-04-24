import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_UID = Deno.env.get('ADMIN_UID') ?? '';

const VALID_ICONS = [
  'shield-check','shield-alert','shield','bug','droplet','thermometer','stethoscope',
  'heart-pulse','pill','syringe','activity','biohazard','hand','alert-triangle',
  'wind','leaf','cloud-rain','waves','spray-can',
  'flask-conical','test-tube','microscope','hospital','bandage','cross','virus',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { lineAccessToken, existingNames = [] } = await req.json();

    if (!lineAccessToken) {
      return Response.json({ error: 'Missing lineAccessToken' }, { status: 400, headers: CORS });
    }

    // Verify LINE token server-side — never trust UID from frontend
    const lineRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${lineAccessToken}` },
    });
    if (!lineRes.ok) {
      return Response.json({ error: 'Invalid LINE access token' }, { status: 401, headers: CORS });
    }
    const { userId } = await lineRes.json() as { userId: string };
    if (userId !== ADMIN_UID) {
      return Response.json({ error: 'Unauthorized' }, { status: 403, headers: CORS });
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500, headers: CORS });
    }

    const existingList = Array.isArray(existingNames) && existingNames.length
      ? `\n\nโรคที่มีอยู่แล้วในระบบ (ห้ามซ้ำ):\n${existingNames.join(', ')}`
      : '';

    const prompt = `คุณเป็นผู้เชี่ยวชาญด้านสาธารณสุขและอาชีวอนามัยในประเทศไทย

สร้างรายการโรคระบาด 10 โรคที่สำคัญสำหรับพนักงานในสถานที่ทำงานของไทย เหมาะสำหรับเก็บเป็นคลังข้อมูล (library) ให้พนักงานค้นหาและศึกษา${existingList}

ตอบกลับเป็น JSON array เท่านั้น ไม่มีข้อความอื่น รูปแบบดังนี้:
[
  {
    "name": "ชื่อโรค (ภาษาไทย · English name)",
    "icon": "ชื่อไอคอน",
    "category": "food|env|respiratory|other",
    "description": "คำอธิบายโรคและการป้องกันสำหรับพนักงาน ความยาว 1-2 ประโยค"
  }
]

ไอคอนที่ใช้ได้: ${VALID_ICONS.join(', ')}
เลือกไอคอนที่เหมาะสมที่สุดกับลักษณะของโรค
คำอธิบายต้องเป็นภาษาไทย เน้นการป้องกันในสถานที่ทำงาน`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error('Anthropic API error:', err);
      return Response.json({ error: 'AI service unavailable' }, { status: 502, headers: CORS });
    }

    const aiData = await aiRes.json();
    const text = (aiData?.content?.[0]?.text || '') as string;

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return Response.json({ error: 'AI returned unexpected format' }, { status: 502, headers: CORS });
    }

    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) {
      return Response.json({ error: 'AI returned invalid data' }, { status: 502, headers: CORS });
    }

    const diseases = parsed
      .map((d: Record<string, unknown>) => ({
        name: String(d.name || '').trim(),
        icon: VALID_ICONS.includes(String(d.icon || '').trim()) ? String(d.icon).trim() : 'shield-check',
        category: ['food', 'env', 'respiratory', 'other'].includes(String(d.category || '').trim())
          ? String(d.category).trim()
          : 'other',
        description: String(d.description || '').trim(),
      }))
      .filter((d) => d.name && d.description.length >= 10);

    return Response.json({ diseases }, { headers: CORS });

  } catch (err) {
    console.error('epidemics-ai-generate error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500, headers: CORS });
  }
});
