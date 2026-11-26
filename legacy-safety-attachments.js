(() => {
    const buckets = Object.freeze({
        'violation-evidence': 'violation-evidence',
        'medical-certificate': 'medical_certs'
    });

    function acceptsRecord(kind, id) {
        return Object.hasOwn(buckets, kind) && /^[1-9]\d{0,18}$/.test(String(id));
    }

    function buildLink(kind, id) {
        const liffId = window.SAFETY_DASHBOARD_CONFIG?.liffId;
        if (!/^[0-9]+-[A-Za-z0-9]+$/.test(liffId || '') || !acceptsRecord(kind, id)) return '';
        const url = new URL('/' + liffId, 'https://liff.line.me');
        url.searchParams.set('attachment_kind', kind);
        url.searchParams.set('attachment_id', String(id));
        return url.href;
    }

    function fromLocation(search) {
        const params = new URLSearchParams(search);
        if (!params.has('attachment_kind') && !params.has('attachment_id')) return null;
        const kind = params.get('attachment_kind');
        const recordId = params.get('attachment_id');
        if (!acceptsRecord(kind, recordId)) throw new Error('ข้อมูลอ้างอิงไฟล์ไม่ถูกต้อง');
        return { kind, recordId };
    }

    async function getSignedUrl(apiUrl, token, attachment, pin) {
        const endpoint = new URL('/functions/v1/legacy-safety-access', apiUrl);
        const response = await fetch(endpoint, {
            method: 'POST',
            cache: 'no-store',
            redirect: 'error',
            credentials: 'omit',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'attachment', ...attachment, pin }),
            signal: AbortSignal.timeout(18000)
        });
        if (response.status === 401) throw new Error('กรุณาเข้าสู่ระบบ LINE ใหม่');
        if (response.status === 403) throw new Error('PIN ไม่ถูกต้อง');
        if (response.status === 429) throw new Error('ลองหลายครั้งเกินไป กรุณารอสักครู่');
        if (response.status === 503) throw new Error('ระบบเปิดเอกสารยังตั้งค่าไม่ครบ');
        if (response.status === 404) throw new Error('ไม่พบไฟล์แนบของรายการนี้');
        if (!response.ok) throw new Error('เปิดไฟล์แนบไม่สำเร็จ กรุณาลองใหม่');
        const result = await response.json();
        const url = new URL(result.url);
        if (url.origin !== endpoint.origin || !url.pathname.startsWith('/storage/v1/object/sign/' + buckets[attachment.kind] + '/')) {
            throw new Error('ปลายทางไฟล์ไม่ถูกต้อง');
        }
        return url.href;
    }

    window.LEGACY_SAFETY_ATTACHMENTS = Object.freeze({ buildLink, fromLocation, getSignedUrl });
})();
