export type Stage = "Closed" | "Latent" | "Opening" | "Open" | "Closing";
export type Confidence = "High" | "Medium" | "Low";
export type EvidenceStatus = "collection_pending" | "empirical" | "partially_reviewed" | "illustrative";

export interface ConfidenceProfile {
  dataCoverage: string;
  classificationQuality: string;
  expertAgreement: string;
}

export interface Evidence {
  id: string;
  label: string;
  value: string;
  definition: string;
  source: string;
  sourceUrl: string;
  period: string;
  confidence: string;
  rawValue?: number | string | null;
  normalizedValue?: number | null;
  transformation?: string;
  coverageWarning?: string | null;
  provenanceReferences: string[];
  status: EvidenceStatus;
}

export interface Pillar {
  id: string;
  name: string;
  question: string;
  status: EvidenceStatus;
  score: number | null;
  scoreLabel: string;
  rubricTotal: number;
  rubricMaximum: number;
  confidence: ConfidenceProfile;
  trend: "up" | "flat" | "down" | null;
  note: string;
  missingData: boolean;
  evidence: Evidence[];
}

export interface MomentumPoint {
  month: string;
  seriesType: "media_attention" | "political_attention" | "wikimedia_attention" | "google_trends_context";
  rawMeasure: number | null;
  indexedValue: number | null;
  coverageWarning?: string | null;
  provenanceReferences: string[];
  status: EvidenceStatus;
}

export interface CountryProfile {
  id: string;
  name: string;
  code: string;
  region: string;
  status: EvidenceStatus;
  stage: Stage | null;
  stageConfidence: string;
  summary: string;
  signal: string;
  missingIngredients: string[];
  lastUpdated: string;
  expertReview: string;
  lowDataWarning?: string;
  pillars: Pillar[];
  momentum: MomentumPoint[];
}

export interface Dataset {
  version: string;
  methodologyVersion: string;
  publishedAt: string;
  status: EvidenceStatus;
  methodologyNote: string;
  manifest: string;
  countries: CountryProfile[];
}
