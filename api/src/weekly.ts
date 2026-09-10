import type { Database, QueryRow } from "./database.ts";
import type { WeeklyTrackerRequest } from "./schemas.ts";

export type WeeklyTrackerResponse = Readonly<{
  weekOf: string;
  mood: string;
  trackerVersion: 1;
  checks: Readonly<{
    cardio: boolean;
    strength: boolean;
    mobility: boolean;
    build: boolean;
    archery: boolean;
    hunt: boolean;
  }>;
  notes: Readonly<{
    win: string;
    challenge: string;
    nextWeek: string;
  }>;
  userID: string;
  updatedAt: string;
}>;

export interface WeeklyTrackersService {
  get(userId: string, weekOf: string): Promise<WeeklyTrackerResponse | null>;
  upsert(
    userId: string,
    tracker: WeeklyTrackerRequest,
  ): Promise<WeeklyTrackerResponse>;
}

function requiredString(row: QueryRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new Error(`Invalid weekly tracker ${key}`);
  }
  return value;
}

function requiredBoolean(row: QueryRow, key: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean") {
    throw new Error(`Invalid weekly tracker ${key}`);
  }
  return value;
}

function dateOnly(row: QueryRow, key: string): string {
  const value = row[key];
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  throw new Error(`Invalid weekly tracker ${key}`);
}

function timestamp(row: QueryRow, key: string): string {
  const value = row[key];
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  throw new Error(`Invalid weekly tracker ${key}`);
}

function weeklyTrackerResponse(row: QueryRow): WeeklyTrackerResponse {
  if (row.tracker_version !== 1) {
    throw new Error("Invalid weekly tracker tracker_version");
  }

  return {
    weekOf: dateOnly(row, "week_of"),
    mood: requiredString(row, "mood"),
    trackerVersion: 1,
    checks: {
      cardio: requiredBoolean(row, "check_cardio"),
      strength: requiredBoolean(row, "check_strength"),
      mobility: requiredBoolean(row, "check_mobility"),
      build: requiredBoolean(row, "check_build"),
      archery: requiredBoolean(row, "check_archery"),
      hunt: requiredBoolean(row, "check_hunt"),
    },
    notes: {
      win: requiredString(row, "note_win"),
      challenge: requiredString(row, "note_challenge"),
      nextWeek: requiredString(row, "note_next_week"),
    },
    userID: requiredString(row, "user_id"),
    updatedAt: timestamp(row, "updated_at"),
  };
}

export function createWeeklyTrackersService(
  database: Pick<Database, "withUserTransaction">,
): WeeklyTrackersService {
  return {
    async get(userId, weekOf): Promise<WeeklyTrackerResponse | null> {
      return await database.withUserTransaction(userId, async (transaction) => {
        const rows = await transaction.query`
          select
            user_id,
            week_of,
            mood,
            tracker_version,
            check_cardio,
            check_strength,
            check_mobility,
            check_build,
            check_archery,
            check_hunt,
            note_win,
            note_challenge,
            note_next_week,
            updated_at
          from steady.weekly_trackers
          where user_id = ${transaction.userId}
            and week_of = ${weekOf}
          limit 1
        `;
        if (rows.length > 1) {
          throw new Error("Weekly lookup returned duplicates");
        }
        return rows.length === 0 ? null : weeklyTrackerResponse(rows[0]);
      });
    },

    async upsert(userId, tracker): Promise<WeeklyTrackerResponse> {
      return await database.withUserTransaction(userId, async (transaction) => {
        const rows = await transaction.query`
          insert into steady.weekly_trackers (
            user_id,
            week_of,
            mood,
            tracker_version,
            check_cardio,
            check_strength,
            check_mobility,
            check_build,
            check_archery,
            check_hunt,
            note_win,
            note_challenge,
            note_next_week
          ) values (
            ${transaction.userId},
            ${tracker.weekOf},
            ${tracker.mood},
            ${tracker.trackerVersion},
            ${tracker.checks.cardio},
            ${tracker.checks.strength},
            ${tracker.checks.mobility},
            ${tracker.checks.build},
            ${tracker.checks.archery},
            ${tracker.checks.hunt},
            ${tracker.notes.win},
            ${tracker.notes.challenge},
            ${tracker.notes.nextWeek}
          )
          on conflict (user_id, week_of) do update set
            mood = excluded.mood,
            tracker_version = excluded.tracker_version,
            check_cardio = excluded.check_cardio,
            check_strength = excluded.check_strength,
            check_mobility = excluded.check_mobility,
            check_build = excluded.check_build,
            check_archery = excluded.check_archery,
            check_hunt = excluded.check_hunt,
            note_win = excluded.note_win,
            note_challenge = excluded.note_challenge,
            note_next_week = excluded.note_next_week,
            updated_at = statement_timestamp()
          returning
            user_id,
            week_of,
            mood,
            tracker_version,
            check_cardio,
            check_strength,
            check_mobility,
            check_build,
            check_archery,
            check_hunt,
            note_win,
            note_challenge,
            note_next_week,
            updated_at
        `;
        if (rows.length !== 1) {
          throw new Error("Weekly upsert did not return one row");
        }
        return weeklyTrackerResponse(rows[0]);
      });
    },
  };
}
