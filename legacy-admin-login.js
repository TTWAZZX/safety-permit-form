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
                const response = await fetch(new URL('/functions/v1/legacy-safety-access', apiUrl), {
                    method: 'POST',
                    cache: 'no-store',
                    credentials: 'omit',
                    redirect: 'error',
                    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'guard-admin-login', pin }),
                    signal: AbortSignal.timeout(20000)
                });
                const result = await response.json().catch(() => null);
                if (response.status === 401) {
                    token = '';
                    throw new Error('กรุณาเข้าสู่ระบบ LINE อีกครั้ง / Sign in with LINE again');
                }
                if (response.status === 403 && result?.error === 'Invalid admin PIN') {
                    throw new Error('PIN กลางไม่ถูกต้อง / Incorrect PIN');
                }
                if (response.status === 429) throw new Error('ลองหลายครั้งเกินไป กรุณารอสักครู่ / Try again shortly');
                if (!response.ok || result?.ok !== true) throw new Error('ตรวจสอบสิทธิ์ไม่สำเร็จ / Sign-in failed');
                token = '';
                openDashboard();
            } catch (error) {
                render(error.message, true);
                if (token) input.focus();
            } finally {
                button.disabled = false;
            }
        });
        render();
    }
    window.LEGACY_ADMIN_LOGIN = Object.freeze({ mount });
})();
