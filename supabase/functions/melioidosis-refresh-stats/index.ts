import { corsHeaders } from "../_shared/cors.ts";
import { callGemini, extractJsonObject, jsonResponse } from "../_shared/gemini.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const result = await callGemini({
      preferredModels: body?.preferredModels,
      prompt:
        "ค้นหาข้อมูลล่าสุดเกี่ยวกับโรคเมลิออยโดสิสหรือโรคไข้ดินในประเทศไทย แล้วสรุปเฉพาะยอดผู้ป่วยสะสมและยอดผู้เสียชีวิตล่าสุดที่ยืนยันได้ พร้อมช่วงข้อมูล วันที่อัปเดต และสรุปสั้น ๆ",
      systemInstruction:
        'คุณเป็นผู้ช่วยตรวจสอบข้อมูลสาธารณสุขไทย ใช้ Google Search เพื่อค้นหาข้อมูลล่าสุดเกี่ยวกับโรคเมลิออยโดสิสในประเทศไทย โดยให้ความสำคัญกับหน่วยงานรัฐไทยและแหล่งข่าวที่น่าเชื่อถือ ตอบเป็น JSON เท่านั้น ในรูปแบบ {"cases": number, "deaths": number, "asOf": "string", "range": "string", "summary": "string"} ห้ามใส่ markdown หรือข้อความอื่นนอก JSON',
    });

    const stats = extractJsonObject(result.text);
    return jsonResponse({
      success: true,
      model: result.model,
      stats,
      sources: result.sources,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});
