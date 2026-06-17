export function parseDateTime(isoString: string): Date {
  return new Date(isoString);
}

export function formatDateTime(date: Date): string {
  return date.toISOString();
}

export function getDurationMinutes(startTime: string, endTime: string): number {
  const start = parseDateTime(startTime);
  const end = parseDateTime(endTime);
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}

export function getDurationHours(startTime: string, endTime: string): number {
  return getDurationMinutes(startTime, endTime) / 60;
}

export function roundUpToHalfHour(minutes: number): number {
  return Math.ceil(minutes / 30) * 30;
}

export function roundUpToHalfHourHours(minutes: number): number {
  return roundUpToHalfHour(minutes) / 60;
}

export function areSlotsAdjacent(
  slot1Start: string,
  slot1End: string,
  slot2Start: string,
  slot2End: string
): boolean {
  const end1 = parseDateTime(slot1End);
  const start2 = parseDateTime(slot2Start);
  const end2 = parseDateTime(slot2End);
  const start1 = parseDateTime(slot1Start);

  const gap1 = Math.abs(end1.getTime() - start2.getTime());
  const gap2 = Math.abs(end2.getTime() - start1.getTime());

  const threshold = 1000;
  return gap1 < threshold || gap2 < threshold;
}

export function areBookingsAdjacentOrOverlapping(
  startTime1: string,
  endTime1: string,
  startTime2: string,
  endTime2: string
): boolean {
  const s1 = parseDateTime(startTime1).getTime();
  const e1 = parseDateTime(endTime1).getTime();
  const s2 = parseDateTime(startTime2).getTime();
  const e2 = parseDateTime(endTime2).getTime();

  return s1 <= e2 && s2 <= e1;
}

export function isTimeOverlapping(
  existingStart: string,
  existingEnd: string,
  newStart: string,
  newEnd: string
): boolean {
  const es = parseDateTime(existingStart).getTime();
  const ee = parseDateTime(existingEnd).getTime();
  const ns = parseDateTime(newStart).getTime();
  const ne = parseDateTime(newEnd).getTime();

  return ns < ee && ne > es;
}

export function getDateString(isoString: string): string {
  const date = parseDateTime(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTimeString(isoString: string): string {
  const date = parseDateTime(isoString);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function addMinutes(isoString: string, minutes: number): string {
  const date = parseDateTime(isoString);
  date.setMinutes(date.getMinutes() + minutes);
  return formatDateTime(date);
}

export function addHours(isoString: string, hours: number): string {
  return addMinutes(isoString, hours * 60);
}

export function startOfDay(isoString: string): string {
  const date = parseDateTime(isoString);
  date.setHours(0, 0, 0, 0);
  return formatDateTime(date);
}

export function endOfDay(isoString: string): string {
  const date = parseDateTime(isoString);
  date.setHours(23, 59, 59, 999);
  return formatDateTime(date);
}

export function getWeekRange(isoString: string): { start: string; end: string } {
  const date = parseDateTime(isoString);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    start: formatDateTime(monday),
    end: formatDateTime(sunday),
  };
}

export function generateSlotKey(roomId: string, date: string, startTime: string): string {
  return `${roomId}-${date}-${startTime}`;
}
