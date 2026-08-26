export type GymStatus = {
  status: 'OPEN' | 'CLOSED';
  source: 'SCHEDULE' | 'MANUAL_OVERRIDE';
  overrideReason: string | null;
  changesAt: string | null;
};
