export type Stage = "Closed" | "Latent" | "Opening" | "Open" | "Closing";
export type Confidence = "High" | "Medium" | "Low";

export interface Evidence {
  label: string;
  value: string;
  definition: string;
  source: string;
  sourceUrl: string;
  period: string;
  confidence: Confidence;
}

export interface Pillar {
  id: string;
  name: string;
  question: string;
  score: number;
  confidence: Confidence;
  trend: "up" | "flat" | "down";
  note: string;
  evidence: Evidence[];
}

export interface CountryProfile {
  id: string;
  name: string;
  code: string;
  region: string;
  stage: Stage;
  stageConfidence: Confidence;
  summary: string;
  signal: string;
  missingIngredients: string[];
  lastUpdated: string;
  expertReview: string;
  lowDataWarning?: string;
  pillars: Pillar[];
  momentum: { month: string; search: number; media: number }[];
}

export interface Dataset {
  version: string;
  publishedAt: string;
  methodologyNote: string;
  countries: CountryProfile[];
}
