import { AlertFrequency } from '../models/alert.model';

const FREQUENCY_LABELS: Record<AlertFrequency, string> = {
  instant: 'Inmediata',
  daily:   'Diaria',
  weekly:  'Semanal',
};

export function getFrequencyLabel(frequency: AlertFrequency | string): string {
  return FREQUENCY_LABELS[frequency as AlertFrequency] ?? frequency;
}
