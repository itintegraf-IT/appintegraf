export type MachineWorkHours = {
  id: number;
  machine: string;
  dayOfWeek: number;
  startHour: number;
  endHour: number;
  isActive: boolean;
};
