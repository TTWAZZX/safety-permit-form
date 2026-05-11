import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// ============================================================
// Supabase Edge Function: notify-violation-line
// ส่ง LINE Flex Message แจ้งเตือนไปกลุ่มเมื่อมีการบันทึก Violation
//
// Secrets ที่ต้อง set ใน Supabase Dashboard → Edge Functions → Secrets:
//   LINE_VIOLATION_TOKEN   = Channel Access Token ของ LINE OA
//   LINE_VIOLATION_GROUP_ID = Group ID ของกลุ่มที่ต้องการส่ง
// ============================================================

const LINE_TOKEN    = Deno.env.get('LINE_VIOLATION_TOKEN')   ?? ''
const LINE_GROUP_ID = Deno.env.get('LINE_VIOLATION_GROUP_ID') ?? ''
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── helpers ────────────────────────────────────────────────
function severityColor(level: string): string {
  switch (level) {
    case 'Critical': return '#7f1d1d'
    case 'High':     return '#dc2626'
    case 'Medium':   return '#d97706'
    default:         return '#059669'
  }
}

function severityEmoji(level: string): string {
  switch (level) {
    case 'Critical': return '🚨'
    case 'High':     return '🔴'
    case 'Medium':   return '🟡'
    default:         return '🟢'
  }
}

function thaiDateTime(iso: string | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

function row(label: string, value: string) {
  return {
    type: 'box', layout: 'horizontal', spacing: 'sm',
    contents: [
      { type: 'text', text: label, color: '#64748b', size: 'sm', flex: 4, wrap: true },
      { type: 'text', text: value || '-', color: '#0f172a', size: 'sm', flex: 6, wrap: true, weight: 'bold' }
    ]
  }
}

// ─── build LINE Flex Message ─────────────────────────────────
function buildFlexMessage(d: Record<string, unknown>) {
  const severityLevel = String(d.severity_level ?? 'Low')
  const color         = severityColor(severityLevel)
  const emoji         = severityEmoji(severityLevel)
  const isRepeat      = d.repeat_offender === true
  const violationCount = Number(d.recent_violation_count_30d ?? 1)
  const reportedAt    = thaiDateTime(d.client_reported_at as string)

  const hasGps = d.gps_latitude && d.gps_longitude
  const mapUrl = hasGps
    ? `https://www.google.com/maps?q=${d.gps_latitude},${d.gps_longitude}`
    : null

  return {
    type: 'flex',
    altText: `${emoji} Violation: ${d.violation_type} | ${d.fullname} | ${severityLevel}`,
    contents: {
      type: 'bubble',
      size: 'giga',
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: color, paddingAll: '16px',
        contents: [
          {
            type: 'box', layout: 'horizontal', alignItems: 'center',
            contents: [
              { type: 'text', text: `${emoji} Violation Report`, color: '#ffffff', weight: 'bold', size: 'xl', flex: 1 },
              { type: 'text', text: severityLevel, color: '#ffffff', size: 'sm', align: 'end', weight: 'bold' }
            ]
          },
          { type: 'text', text: String(d.case_id ?? '-'), color: 'rgba(255,255,255,0.75)', size: 'sm', margin: 'xs' }
        ]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px',
        contents: [
          ...(isRepeat ? [{
            type: 'box', layout: 'horizontal',
            backgroundColor: '#fee2e2', cornerRadius: '6px', paddingAll: '10px',
            borderWidth: '1px', borderColor: '#fca5a5',
            contents: [{ type: 'text', text: `⚠️  REPEAT OFFENDER — ${violationCount} ครั้งใน 30 วัน`, color: '#991b1b', weight: 'bold', size: 'sm', wrap: true }]
          }] : []),
          { type: 'separator' },
          {
            type: 'box', layout: 'vertical', spacing: 'sm',
            contents: [
              row('👤 พนักงาน',      `${d.fullname} (${d.emp_id})`),
              row('🏭 แผนก',         String(d.section ?? '-')),
              row('❗ ข้อหา',        String(d.violation_type ?? '-')),
              row('📍 จุดเกิดเหตุ',  String(d.location_ref  ?? '-')),
              row('✅ การดำเนินการ', String(d.action_taken  ?? '-')),
              row('🕐 กะงาน',        String(d.guard_shift   ?? '-')),
              row('👮 รายงานโดย',    String(d.reported_by   ?? '-')),
              row('⏰ เวลา',          reportedAt),
            ]
          }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px',
        contents: [
          ...(mapUrl ? [{
            type: 'button',
            action: { type: 'uri', label: '📍 ดูพิกัด GPS', uri: mapUrl },
            style: 'primary', color: '#0284c7', height: 'sm'
          }] : []),
          ...(d.evidence_url ? [{
            type: 'button',
            action: { type: 'uri', label: '🖼️ ดูหลักฐานภาพ', uri: String(d.evidence_url) },
            style: 'secondary', height: 'sm'
          }] : []),
          { type: 'text', text: `Workflow: ${d.workflow_status ?? '-'}`, color: '#64748b', size: 'xs', align: 'center', margin: 'sm' }
        ]
      }
    }
  }
}

// ─── main handler ────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (!LINE_TOKEN || !LINE_GROUP_ID) {
    console.error('Missing LINE_VIOLATION_TOKEN or LINE_VIOLATION_GROUP_ID secrets')
    return new Response(
      JSON.stringify({ error: 'LINE credentials not configured' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  let data: Record<string, unknown>
  try {
    data = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  const message = buildFlexMessage(data)

  const lineRes = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ to: LINE_GROUP_ID, messages: [message] })
  })

  const lineBody = await lineRes.text()

  if (!lineRes.ok) {
    console.error('LINE API error:', lineBody)
    return new Response(
      JSON.stringify({ error: 'LINE API error', detail: lineBody }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ ok: true }),
    { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
  )
})
