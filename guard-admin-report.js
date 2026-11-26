const guardReportStatuses = {
    ALL: 'ทุกสถานะ',
    late: 'เฉพาะมาสาย',
    missingOut: 'ยังไม่ลงเวลาออก',
    noRecord: 'ไม่มีบันทึกเวลา',
    absent: 'ขาดงาน'
};

function guardReportDate(value) {
    const date = String(value ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const parsed = new Date(date + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

function guardRosterKey(date, shift, name) {
    return JSON.stringify([date, shift, name.trim().replace(/\s+/g, ' ').normalize('NFC')]);
}

function parseGuardRoster(rows, month, knownNames) {
    const [header, ...entries] = rows;
    if (['วันที่', 'กะ', 'ชื่อ-นามสกุล'].some((label, index) => String(header?.[index] ?? '').trim() !== label)) {
        throw new Error('ใช้หัวคอลัมน์ วันที่, กะ, ชื่อ-นามสกุล ตามไฟล์ตัวอย่าง');
    }
    const names = new Map([...knownNames].map(name => [guardRosterKey('', '', name), name]));
    const roster = new Map();
    entries.forEach(([date, shift, name], index) => {
        const workDate = guardReportDate(date);
        const shiftKey = { กะเช้า: 'morning', กะดึก: 'night', เช้า: 'morning', ดึก: 'night' }[String(shift ?? '').trim()];
        const fullName = names.get(guardRosterKey('', '', String(name ?? '')));
        if (!workDate?.startsWith(month + '-') || !Object.hasOwn(guardShifts, shiftKey) || !fullName) {
            throw new Error(`แถว ${index + 2}: ตรวจวันที่ให้ตรงเดือนที่เลือก กะ และชื่อในรายชื่อพนักงาน`);
        }
        const key = guardRosterKey(workDate, shiftKey, fullName);
        roster.set(key, { work_date: workDate, shift: guardShifts[shiftKey].label, fullname: fullName });
    });
    if (!roster.size) throw new Error('ไม่พบรายการเวรในไฟล์');
    return [...roster.values()];
}

function guardShiftHasEnded(date, shift, now) {
    const key = getGuardShift(shift);
    if (!key || !guardReportDate(date)) return false;
    const end = Date.parse(`${date}T${guardShifts[key].endsAt}:00+07:00`) + (key === 'night' ? 86400000 : 0);
    return now >= end;
}

function guardReportTimeRecorded(value) {
    return /^([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value?.trim() ?? '');
}

function buildGuardReport(records, roster, now) {
    const covered = new Set();
    const recorded = new Set();
    const rows = records.map(row => {
        const shift = getGuardShift(row.shift);
        const timeIn = guardReportTimeRecorded(row.time_in);
        const timeOut = guardReportTimeRecorded(row.time_out);
        const remark = row.remark_type?.trim() ?? '';
        const isLeave = remark.startsWith('ลา');
        const isAbsent = remark === 'ขาดงาน';
        if (shift) {
            recorded.add(guardRosterKey(row.work_date, shift, row.fullname));
            if (!isLeave && !isAbsent && (timeIn || timeOut) && remark.startsWith('แทน') && row.remark_detail?.trim()) {
                covered.add(guardRosterKey(row.work_date, shift, row.remark_detail));
            }
        }
        const lateMinutes = getGuardLateness(row.shift, row.time_in, remark);
        const flags = {
            absent: isAbsent,
            late: lateMinutes > 0,
            missingOut: !isLeave && !isAbsent && timeIn && !timeOut && guardShiftHasEnded(row.work_date, row.shift, now),
            noRecord: !isLeave && !isAbsent && !timeIn && !timeOut
        };
        const labels = [];
        if (isAbsent) labels.push('ขาดงาน (บันทึกไว้)');
        if (flags.missingOut) labels.push(guardReportStatuses.missingOut);
        if (flags.noRecord) labels.push(guardReportStatuses.noRecord);
        return { ...row, shiftKey: shift, lateMinutes, flags, labels };
    });
    for (const duty of roster) {
        const shiftKey = getGuardShift(duty.shift);
        const key = guardRosterKey(duty.work_date, shiftKey, duty.fullname);
        if (recorded.has(key) || !guardShiftHasEnded(duty.work_date, duty.shift, now)) continue;
        const isCovered = covered.has(key);
        rows.push({
            ...duty, id: 'absent_' + key, shiftKey, lateMinutes: null, flags: { absent: !isCovered },
            labels: [isCovered ? 'มีผู้ปฏิบัติงานแทน' : 'ขาดงานตามตารางเวร']
        });
    }

    // A scheduled duty with a blank attendance record also needs roster-based classification.
    const duties = new Set(roster.map(duty => guardRosterKey(duty.work_date, getGuardShift(duty.shift), duty.fullname)));
    const attended = new Set(rows.filter(row => !row.flags.absent && !row.remark_type?.trim().startsWith('ลา') &&
        [row.time_in, row.time_out].some(guardReportTimeRecorded))
        .map(row => guardRosterKey(row.work_date, row.shiftKey, row.fullname)));
    for (const row of rows) {
        if (!row.flags.noRecord || !guardShiftHasEnded(row.work_date, row.shift, now)) continue;
        const key = guardRosterKey(row.work_date, row.shiftKey, row.fullname);
        if (!duties.has(key) || attended.has(key)) continue;
        const isCovered = covered.has(key);
        row.flags.noRecord = false;
        row.flags.absent = !isCovered;
        row.labels = [isCovered ? 'มีผู้ปฏิบัติงานแทน' : 'ขาดงานตามตารางเวร'];
    }
    return rows;
}

function summarizeGuardLateness(rows) {
    const names = new Map();
    for (const row of rows) {
        if (!row.flags.late) continue;
        if (!names.has(row.fullname)) names.set(row.fullname, { name: row.fullname, count: 0, minutes: 0 });
        const summary = names.get(row.fullname);
        summary.count++;
        summary.minutes += row.lateMinutes;
    }
    return [...names.values()].sort((a, b) => b.count - a.count || b.minutes - a.minutes || a.name.localeCompare(b.name, 'th'));
}
