import { corsHeaders } from "../_shared/cors.ts";
import { callGemini, jsonResponse } from "../_shared/gemini.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const prompt = String(body?.prompt ?? "").trim();
    if (!prompt) {
      return jsonResponse({ success: false, error: "Missing prompt" }, 400);
    }

    const result = await callGemini({
      preferredModels: body?.preferredModels,
      prompt,
      systemInstruction:
        "คุณคือผู้ช่วยด้านสาธารณสุขภาษาไทย ให้ประเมินความเสี่ยงโรคไข้ดินเบื้องต้นจากข้อมูลของผู้ใช้ โดยใช้ Google Search เพื่อค้นหาข้อมูลล่าสุดเมื่อจำเป็น ตอบเป็นภาษาไทยแบบสั้น กระชับ อ่านง่าย มีหัวข้อชัดเจน เน้นสิ่งที่ควรทำทันที และลงท้ายว่าการประเมินนี้ไม่ใช่การวินิจฉัยโรค",
    });

    return jsonResponse({
      success: true,
      model: result.model,
      text: result.text,
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

