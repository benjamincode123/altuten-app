import { config } from '../config';
import {
  AppError,
  appErrorFromHttp,
  readApiErrorMessage,
} from '../errors/appError';

export interface LeaderboardEntry {
  rank: number;
  /** Present only when the user is public; otherwise null. */
  userId: number | null;
  username: string;
  xpGained: number;
  isPublic: boolean;
  /** True when this row belongs to the logged-in viewer (set server-side). */
  isViewer: boolean;
}

export interface LeaderboardPeriod {
  period: 'day' | 'week' | 'month' | string;
  windowStartUtc: string;
  entries: LeaderboardEntry[];
}

export interface LeaderboardPrizes {
  day: string;
  week: string;
  month: string;
}

export interface LeaderboardSnapshot {
  generatedAtUtc: string;
  nextRefreshUtc: string;
  prizes: LeaderboardPrizes;
  day: LeaderboardPeriod;
  week: LeaderboardPeriod;
  month: LeaderboardPeriod;
}

function leaderboardUrl(): string {
  return `${config.apiBaseUrl.replace(/\/+$/, '')}/api/leaderboard`;
}

function parsePrizes(value: unknown): LeaderboardPrizes {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    day: typeof raw.day === 'string' ? raw.day : '',
    week: typeof raw.week === 'string' ? raw.week : '',
    month: typeof raw.month === 'string' ? raw.month : '',
  };
}

export async function fetchLeaderboard(token: string): Promise<LeaderboardSnapshot> {
  let response: Response;
  try {
    response = await fetch(leaderboardUrl(), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    const apiError = await readApiErrorMessage(response);
    throw appErrorFromHttp(response.status, apiError, 'unauthorized');
  }
  const body = (await response.json()) as LeaderboardSnapshot;
  return { ...body, prizes: parsePrizes(body.prizes) };
}
