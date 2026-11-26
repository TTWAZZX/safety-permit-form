const guardBangkokFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', calendar: 'gregory', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});
const guardDutyDateFormatter = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function guardBangkokClock(now = new Date()) {
    const { year, month, day, hour, minute, second } = Object.fromEntries(
        guardBangkokFormatter.formatToParts(now).map(part => [part.type, part.value])
    );
    return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}:${second}` };
}

function guardDateOffset(date, days) {
    const day = new Date(date + 'T00:00:00Z');
    day.setUTCDate(day.getUTCDate() + days);
    return day.toISOString().slice(0, 10);
}

function guardSessionDates(date, shift, clock) {
    const key = getGuardShift(shift);
    // Keep yesterday's night shift available for checkout until the next night shift starts.
    const includePrevious = date === clock.date && (!key || key === 'night') &&
        clock.time.slice(0, 5) < guardShifts.night.startsAt;
    return includePrevious ? [date, guardDateOffset(date, -1)] : [date];
}

function chooseGuardSession(records, dates, selectedShift) {
    const shift = getGuardShift(selectedShift);
    const open = records.filter(row => {
        const remark = row.remark_type?.trim() || '';
        return row.time_in?.trim() && !remark.startsWith('ลา') && remark !== 'ขาดงาน';
    });
    return open.find(row => row.work_date === dates[0] && (!shift || getGuardShift(row.shift) === shift)) ||
        open.find(row => row.work_date === dates[1] && getGuardShift(row.shift) === 'night') || null;
}

function guardDutyLabel(date, shift) {
    const key = getGuardShift(shift);
    const duty = guardShifts[key];
    const displayDate = value => guardDutyDateFormatter.format(new Date(value + 'T00:00:00Z'));
    if (!duty) return displayDate(date);
    const endDate = key === 'night' ? guardDateOffset(date, 1) : date;
    return `${duty.label} ${displayDate(date)} ${duty.startsAt} → ${displayDate(endDate)} ${duty.endsAt}`;
}
