export interface TimeFields {
  dayOfWeek:  number; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  hourUtc:    number; // 0–23
  weekOfYear: number; // 1–53
  month:      number; // 1–12
}

export function getTimeFields(isoTimestamp: string): TimeFields {
  const d = new Date(isoTimestamp);
  return {
    dayOfWeek:  d.getUTCDay(),
    hourUtc:    d.getUTCHours(),
    weekOfYear: getUTCWeek(d),
    month:      d.getUTCMonth() + 1,
  };
}

function getUTCWeek(d: Date): number {
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const daysSinceJan1 = Math.floor((d.getTime() - jan1.getTime()) / 86_400_000);
  return Math.ceil((daysSinceJan1 + jan1.getUTCDay() + 1) / 7);
}
