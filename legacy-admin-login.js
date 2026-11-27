(() => {
    function mount({ page, apiUrl, openDashboard }) {
        const form = document.getElementById('legacyAdminLoginForm');
        const button = document.getElementById('legacyAdminLoginButton');
        const input = document.getElementById('legacyAdminPin');
        const field = document.getElementById('legacyAdminPinField');
        const status = document.getElementById('legacyAdminLoginStatus');
        const key = 'legacyAdminLoginToken:' + page;
        let token = sessionStorage.getItem(key) || '';
        sessionStorage.removeItem(key);
        input.value = '';
        let adminPin = '';

        function render(message = '', error = false) {
            field.hidden = !token;
            input.disabled = !token;
            button.textContent = token ? 'ยืนยัน PIN / Verify PIN' : 'เข้าสู่ระบบด้วย LINE / Sign in with LINE';
            status.classList.toggle('text-danger', error);
            status.textContent = message || (token
                ? 'ยืนยัน LINE แล้ว กรุณากรอก PIN กลาง / Enter the shared PIN'
                : 'เข้าสู่ระบบด้วย LINE ก่อนยืนยัน PIN');
        }

        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (button.disabled) return;
            if (!token) {
                const login = new URL('safety-dashboard.html', location.href);
                login.searchParams.set('legacy_admin', page);
                location.assign(login);
                return;
            }

            const pin = input.value.trim();
            input.value = '';
            if (!/^[0-9]{10,32}$/.test(pin)) {
                render('กรุณากรอก PIN กลางเป็นตัวเลข 10–32 หลัก / Enter 10–32 digits', true);
                input.focus();
                return;
            }

            button.disabled = true;
            render('กำลังตรวจสอบ PIN…');
            try {
                const result = await request('guard-admin-login', {}, pin);
                if (result?.ok !== true) throw new Error('ตรวจสอบสิทธิ์ไม่สำเร็จ / Sign-in failed');
                adminPin = pin;
                openDashboard();
            } catch (error) {
                render(error.message, true);
                if (token) input.focus();
            } finally {
                button.disabled = false;
            }
        });
        render();

        async function request(action, values, pin = adminPin) {
            if (!token || !pin) throw new Error('กรุณาเข้าสู่ระบบใหม่ / Sign in again');
            const response = await fetch(new URL('/functions/v1/legacy-safety-access', apiUrl), {
                method: 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error',
                headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...values, action, pin }),
                signal: AbortSignal.timeout(20000)
            });
            const result = await response.json().catch(() => null);
            if (response.status === 401) {
                token = adminPin = '';
                throw new Error('กรุณาเข้าสู่ระบบ LINE อีกครั้ง / Sign in with LINE again');
            }
            if (response.status === 403 && result?.error === 'Invalid admin PIN') throw new Error('PIN กลางไม่ถูกต้อง / Incorrect PIN');
            if (response.status === 429) throw new Error('ลองหลายครั้งเกินไป กรุณารอสักครู่ / Try again shortly');
            if (response.status === 409) throw new Error('รายการถูกเปลี่ยนหรือลบไปแล้ว กรุณารีเฟรชข้อมูล');
            if (!response.ok || !result) throw new Error('ดำเนินการไม่สำเร็จ / Request failed');
            return result;
        }

        return {
            async read(view, filters = {}) {
                try {
                    const { rows } = await request(page + '-admin-read', { ...filters, view });
                    return { data: rows, error: null };
                } catch (error) {
                    return { data: null, error };
                }
            },
            async mutate(table, operation, rows = null, id = null) {
                try {
                    const result = await request('legacy-admin-mutate', { table, operation, rows, id: id === null ? null : String(id) });
                    return { data: result, error: null };
                } catch (error) {
                    return { data: null, error };
                }
            },
            showAudit: () => showAudit((month, filter, offset) => request('legacy-admin-logs', { area: page, month, filter, offset }))
        };
    }

    function showAudit(load) {
        const create = (tag, text) => {
            const node = document.createElement(tag);
            if (text) node.textContent = text;
            return node;
        };
        const panel = create('div');
        panel.className = 'text-start';
        const controls = create('div');
        controls.className = 'd-flex gap-2 flex-wrap align-items-center mb-3';
        const month = create('input');
        month.type = 'month';
        month.className = 'form-control w-auto';
        month.setAttribute('aria-label', 'เดือน');
        month.value = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).format(new Date());
        const filter = create('select');
        filter.className = 'form-select w-auto';
        filter.setAttribute('aria-label', 'ประเภทการเปลี่ยนแปลง');
        for (const [value, name] of [['ALL', 'ทั้งหมด'], ['INSERT', 'เพิ่ม'], ['UPDATE', 'แก้ไข'], ['DELETE', 'ลบ']]) {
            filter.add(new Option(name, value));
        }
        const label = create('p');
        label.setAttribute('role', 'status');
        const records = create('div');
        const date = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'medium' });
        const previous = create('button', 'ก่อนหน้า');
        const next = create('button', 'ถัดไป');
        for (const button of [previous, next]) {
            button.type = 'button';
            button.className = 'btn btn-outline-secondary btn-sm';
        }
        let start = 0;
        let version = 0;
        async function render() {
            const requestVersion = ++version;
            previous.disabled = next.disabled = true;
            label.textContent = 'กำลังโหลด…';
            records.replaceChildren();
            if (!month.value) {
                label.textContent = 'กรุณาเลือกเดือน';
                return;
            }
            try {
                const { data, count } = await load(month.value, filter.value, start);
                if (requestVersion !== version) return;
                label.textContent = count ? `แสดง ${start + 1}–${start + data.length} จาก ${count} รายการ` : 'ไม่มีประวัติในเดือนนี้';
                previous.disabled = start === 0;
                next.disabled = start + data.length >= count;
                for (const row of data) {
                    const entry = create('details');
                    entry.className = 'border rounded p-2 mb-2';
                    const actor = row.actor_line_display_name || row.actor_line_user_id || 'ไม่มีบัญชี LINE ที่ยืนยัน';
                    entry.append(create('summary', [date.format(new Date(row.created_at)), row.action, actor, row.detail].filter(Boolean).join(' · ')));
                    if (row.actor_line_display_name && row.actor_line_user_id) entry.append(create('small', row.actor_line_user_id));
                    for (const [heading, value] of [['ก่อนแก้ไข', row.before_data], ['หลังแก้ไข', row.after_data]]) {
                        if (!value) continue;
                        const snapshot = create('pre', JSON.stringify(value, null, 2));
                        snapshot.className = 'bg-light rounded p-2 small text-wrap';
                        entry.append(create('div', heading), snapshot);
                    }
                    records.append(entry);
                }
            } catch (error) {
                if (requestVersion === version) label.textContent = error.message;
            }
        }
        month.addEventListener('change', () => { start = 0; render(); });
        filter.addEventListener('change', () => { start = 0; render(); });
        previous.addEventListener('click', () => { start = Math.max(0, start - 20); render(); });
        next.addEventListener('click', () => { start += 20; render(); });
        controls.append(month, filter, previous, next);
        panel.append(controls, label, records);
        Swal.fire({ title: 'ประวัติแก้ไข', html: panel, width: 850, confirmButtonText: 'ปิด', didOpen: render });
    }

    window.LEGACY_ADMIN_LOGIN = Object.freeze({ mount });
})();
