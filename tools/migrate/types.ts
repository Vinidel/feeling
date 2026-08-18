export type CollectionName = "feelings" | "weekly_trackers";

export interface SourceException {
  collection: CollectionName;
  source_id: string;
  user_hash?: string;
  reason_code:
    | "duplicate_source_id"
    | "duplicate_user_week"
    | "invalid_identifier"
    | "invalid_type"
    | "invalid_value"
    | "missing_identity"
    | "target_conflict"
    | "unknown_field";
  field?: string;
}

export interface FeelingRecord {
  legacyMongoId: string;
  userId: string;
  userHash: string;
  status: number;
  createdAt: string;
  comment: string;
  activityBow: boolean;
  activityLift: boolean;
  activityRun: boolean;
  activityCycle: boolean;
  activitySwim: boolean;
  createdAtNormalization?: "go_zero_time_to_object_id_time";
}

export interface SourceTransformation {
  collection: "feelings";
  source_id: string;
  user_hash: string;
  transformation_code: "go_zero_time_to_object_id_time";
  field: "createdat";
}

export interface WeeklyTrackerRecord {
  legacyMongoId: string;
  userId: string;
  userHash: string;
  weekOf: string;
  mood: "rough" | "low" | "steady" | "good" | "great";
  trackerVersion: number;
  checkCardio: boolean;
  checkStrength: boolean;
  checkMobility: boolean;
  checkBuild: boolean;
  checkArchery: boolean;
  checkHunt: boolean;
  noteWin: string;
  noteChallenge: string;
  noteNextWeek: string;
  updatedAt: string;
}

export interface MigrationAnalysis {
  feelings: FeelingRecord[];
  weeklyTrackers: WeeklyTrackerRecord[];
  exceptions: SourceException[];
  transformations: SourceTransformation[];
  sourceCounts: {
    feelings: number;
    weeklyTrackers: number;
  };
}

export interface CollectionSummary {
  source: number;
  accepted: number;
  rejected: number;
  structural_hash: string;
}

export interface MigrationReport {
  format_version: 1;
  mode: "dry-run" | "import" | "reconcile";
  collections: {
    feelings: CollectionSummary;
    weekly_trackers: CollectionSummary;
  };
  users: Array<{
    user_hash: string;
    feelings: number;
    weekly_trackers: number;
  }>;
  exceptions: {
    total: number;
    by_reason: Record<string, number>;
  };
  transformations: {
    total: number;
    by_code: Record<string, number>;
  };
  database?: {
    inserted_feelings: number;
    inserted_weekly_trackers: number;
    matched_feelings: number;
    matched_weekly_trackers: number;
    target_only_feelings: number;
    target_only_weekly_trackers: number;
  };
}
