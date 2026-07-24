export const WEEK_DAYS = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
] as const;

export type WeekDayValue = (typeof WEEK_DAYS)[number]['value'];

export const formatWeekOffDays = (days?: string[] | null): string => {
  if (!days?.length) return 'None';
  const labels = WEEK_DAYS.filter((day) => days.includes(day.value)).map((day) => day.label);
  return labels.join(', ');
};
