export type Tier = "Nascent" | "Emerging" | "Established";
export type Track = "mainstream" | "frontier";
export type DimensionId = "talent" | "attention" | "policy";

export interface TalentMainstream {
  t1_ai_works: number | null;
  t1_total_works: number | null;
  t1_ai_share: number | null;
  g20_median_share: number | null;
  tier: Tier | null;
  insufficient_data: boolean;
}

export interface WorkSample { title: string | null; year: number | null; link: string | null }

export interface TalentFrontier {
  t2_works: number | null;
  t2_sample?: WorkSample[];
  t3_orgs: number;
  t3_university_groups: number;
  t3_capped: boolean;
  tier: Tier | null;
  insufficient_data: boolean;
}

export interface AttentionTrack {
  a1_latest_month_pct?: number | null;
  a1_trend_ratio?: number | null;
  alignment_article_exists_in_principal_language?: boolean | null;
  tier: Tier | null;
  insufficient_data: boolean;
}

export interface PolicyMainstream {
  p1_oecd_initiative_count: number | null;
  p1_activity_level: "low" | "medium" | "high";
  p1_latest_initiative: { name: string; year: number; source: string };
  tier: Tier | null;
  insufficient_data: boolean;
}

export interface PolicyFrontier {
  p2_score: number;
  p2_items: Record<string, boolean>;
  tier: Tier | null;
  insufficient_data: boolean;
}

export interface TrackReadiness {
  /** true when all three dimensions have a stage (nothing Collecting) */
  complete: boolean;
  missing: DimensionId[];
  stage_floor: Tier | null;
  /** dimensions at the lowest observed stage (empty when consolidated) */
  focus: DimensionId[];
  profile: "single" | "balanced" | "consolidated" | "none";
}

export interface CountrySnapshot {
  name: string;
  talent: { mainstream: TalentMainstream; frontier: TalentFrontier };
  attention: { mainstream: AttentionTrack; frontier: AttentionTrack };
  policy: { mainstream: PolicyMainstream; frontier: PolicyFrontier };
  readiness: { mainstream: TrackReadiness; frontier: TrackReadiness };
  binding_constraint: { mainstream: DimensionId | null; frontier: DimensionId | null };
  provenance: { curated: string[]; raw: string[] };
}

export interface SnapshotV2 {
  snapshot: string;
  schema_version: number;
  provisional_thresholds: boolean;
  tier_order: Tier[];
  countries: Record<string, CountrySnapshot>;
}
