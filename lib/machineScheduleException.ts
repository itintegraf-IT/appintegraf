export type MachineScheduleException = {
  id: number;
  machine: string;
  date: string;
  startHour: number;
  endHour: number;
  isActive: boolean;
  label: string | null;
};
