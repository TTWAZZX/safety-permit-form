import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// ============================================================
// Supabase Edge Function: notify-violation-line
// Secrets required:
//   LINE_VIOLATION_TOKEN    = Channel Access Token
//   LINE_VIOLATION_GROUP_ID = Target Group ID
// ============================================================

const LINE_TOKEN    = Deno.env.get('LINE_VIOLATION_TOKEN')    ?? ''
const LINE_GROUP_ID = Deno.env.get('LINE_VIOLATION_GROUP_ID') ?? ''
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── helpers ────────────────────────────────────────────────
const SEVERITY_THEME: Record<string, { header: string; accent: string; label: string }> = {
  Critical: { header: '#7f1d1d', accent: '#991b1b', label: 'CRITICAL' },
  High:     { header: '#991b1b', accent: '#b91c1c', label: 'HIGH'     },
  Medium:   { header: '#92400e', accent: '#b45309', label: 'MEDIUM'   },
  Low:      { header: '#14532d', accent: '#166534', label: 'LOW'      },
}

function getTheme(level: string) {
  return SEVERITY_THEME[level] ?? SEVERITY_THEME['Low']
}

function thaiDateTime(iso: string | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── layout components ───────────────────────────────────────

/** Section header — gray pill label */
function sectionHeader(text: string) {
  return {
    type: 'box', layout: 'vertical',
    backgroundColor: '#f1f5f9',
    paddingAll: '8px',
    margin: 'md',
    contents: [{
      type: 'text', text,
      color: '#64748b', size: 'xs', weight: 'bold',
      letterSpacing: '2px',
    }],
  }
}

/** Data row — LABEL : Value */
function dataRow(label: string, value: string) {
  return {
    type: 'box', layout: 'horizontal',
    paddingTop: '6px', paddingBottom: '2px',
    paddingStart: '4px', paddingEnd: '4px',
    contents: [
      {
        type: 'text', text: label,
        color: '#94a3b8', size: 'sm',
        flex: 4, wrap: false,
        weight: 'regular',
      },
      {
        type: 'text', text: value || '-',
        color: '#0f172a', size: 'sm',
        flex: 6, wrap: true, weight: 'bold',
      },
    ],
  }
}

/** Thin separator line */
function divider() {
  return { type: 'separator', color: '#e2e8f0', margin: 'sm' }
}

// ─── main flex builder ───────────────────────────────────────
function buildFlexMessage(d: Record<string, unknown>) {
  const severityLevel  = String(d.severity_level ?? 'Low')
  const theme          = getTheme(severityLevel)
  const isRepeat       = d.repeat_offender === true
  const violationCount = Number(d.recent_violation_count_30d ?? 1)
  const reportedAt     = thaiDateTime(d.client_reported_at as string)

  const hasGps = d.gps_latitude && d.gps_longitude
  const mapUrl = hasGps
    ? `https://www.google.com/maps?q=${d.gps_latitude},${d.gps_longitude}`
    : null

  return {
    type: 'flex',
    altText: `[${theme.label}] Violation: ${d.violation_type} — ${d.fullname}`,
    contents: {
      type: 'bubble',
      size: 'giga',

      // ── Header ─────────────────────────────────────────────
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: theme.header,
        paddingAll: '18px',
        contents: [
          {
            type: 'box', layout: 'horizontal',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: 'VIOLATION REPORT',
                color: '#ffffff',
                weight: 'bold',
                size: 'lg',
                flex: 1,
                letterSpacing: '1px',
              },
              {
                type: 'box', layout: 'vertical',
                backgroundColor: '#00000040',
                cornerRadius: '4px',
                paddingAll: '5px',
                width: '80px',
                contents: [{
                  type: 'text',
                  text: theme.label,
                  color: '#ffffff',
                  size: 'sm',
                  weight: 'bold',
                  align: 'center',
                  letterSpacing: '1px',
                }],
              },
            ],
          },
          {
            type: 'text',
            text: String(d.case_id ?? 'N/A'),
            color: '#ffffff99',
            size: 'xs',
            margin: 'sm',
            letterSpacing: '0.5px',
          },
        ],
      },

      // ── Body ───────────────────────────────────────────────
      body: {
        type: 'box', layout: 'vertical',
        paddingAll: '0px', spacing: 'none',
        contents: [

          // Repeat offender banner
          ...(isRepeat ? [{
            type: 'box', layout: 'vertical',
            backgroundColor: '#fef2f2',
            borderWidth: '1px',
            borderColor: '#fca5a5',
            paddingAll: '12px',
            contents: [
              {
                type: 'text',
                text: 'REPEAT OFFENDER',
                color: '#991b1b',
                size: 'sm',
                weight: 'bold',
                letterSpacing: '1px',
              },
              {
                type: 'text',
                text: `${violationCount} cases in the last 30 days`,
                color: '#b91c1c',
                size: 'xs',
                margin: 'xs',
              },
            ],
          }] : []),

          // EMPLOYEE INFORMATION
          sectionHeader('EMPLOYEE INFORMATION'),
          {
            type: 'box', layout: 'vertical',
            paddingStart: '8px', paddingEnd: '8px', paddingBottom: '8px',
            contents: [
              dataRow('NAME',    `${d.fullname}`),
              dataRow('EMP ID',  String(d.emp_id   ?? '-')),
              dataRow('SECTION', String(d.section  ?? '-')),
            ],
          },

          divider(),

          // INCIDENT DETAILS
          sectionHeader('INCIDENT DETAILS'),
          {
            type: 'box', layout: 'vertical',
            paddingStart: '8px', paddingEnd: '8px', paddingBottom: '12px',
            contents: [
              dataRow('VIOLATION',   String(d.violation_type ?? '-')),
              dataRow('LOCATION',    String(d.location_ref   ?? '-')),
              dataRow('ACTION',      String(d.action_taken   ?? '-')),
              dataRow('SHIFT',       String(d.guard_shift    ?? '-')),
              dataRow('REPORTED BY', String(d.reported_by    ?? '-')),
              dataRow('DATE / TIME', reportedAt),
            ],
          },

        ],
      },

      // ── Footer ─────────────────────────────────────────────
      footer: {
        type: 'box', layout: 'vertical',
        spacing: 'sm',
        backgroundColor: '#f8fafc',
        paddingAll: '14px',
        contents: [
          ...(mapUrl ? [{
            type: 'button',
            action: { type: 'uri', label: 'VIEW GPS LOCATION', uri: mapUrl },
            style: 'primary',
            color: theme.accent,
            height: 'sm',
          }] : []),
          ...(d.evidence_url ? [{
            type: 'button',
            action: { type: 'uri', label: 'VIEW EVIDENCE', uri: String(d.evidence_url) },
            style: 'secondary',
            height: 'sm',
          }] : []),
          {
            type: 'text',
            text: `WORKFLOW: ${String(d.workflow_status ?? '-').toUpperCase()}`,
            color: '#94a3b8',
            size: 'xs',
            align: 'center',
            margin: 'sm',
            letterSpacing: '1px',
          },
        ],
      },
    },
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
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  let data: Record<string, unknown>
  try {
    data = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const message = buildFlexMessage(data)

  const lineRes = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({ to: LINE_GROUP_ID, messages: [message] }),
  })

  const lineBody = await lineRes.text()

  if (!lineRes.ok) {
    console.error('LINE API error:', lineBody)
    return new Response(
      JSON.stringify({ error: 'LINE API error', detail: lineBody }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({ ok: true }),
    { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  )
})
