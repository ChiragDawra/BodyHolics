export type Crowd = {
  level: 'NOT_CROWDED' | 'MODERATE' | 'CROWDED' | 'VERY_CROWDED' | null;
  confidence: 'OK' | 'LOW' | 'INSUFFICIENT_DATA';
  updatedAt: string;
  source: string;
};
