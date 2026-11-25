const guardShifts = {
    morning: { label: 'กะเช้า', startsAt: '06:00', endsAt: '18:00', startMinute: 360 },
    night: { label: 'กะดึก', startsAt: '18:00', endsAt: '06:00', startMinute: 1080 }
};

function getGuardShift(shift) {
    if (shift?.includes('เช้า')) return 'morning';
    if (shift?.includes('ดึก')) return 'night';
    return null;
}

function getGuardLateness(shift, timeIn, remarkType) {
    const shiftKey = getGuardShift(shift);
    const remark = remarkType?.trim() ?? '';
    if (!shiftKey || remark.startsWith('ลา') || remark === 'ขาดงาน') return null;

    // Older rows may include seconds. Attendance is reported to the minute.
    const time = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(timeIn?.trim() ?? '');
    if (!time) return null;

    let actualMinute = Number(time[1]) * 60 + Number(time[2]);
    const { startMinute } = guardShifts[shiftKey];
    // Times before 06:00 on the night shift belong to the following morning.
    if (shiftKey === 'night' && actualMinute < guardShifts.morning.startMinute) {
        actualMinute += 24 * 60;
    }
    return Math.max(0, actualMinute - startMinute);
}
