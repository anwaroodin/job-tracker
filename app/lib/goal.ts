const HISTORY_WEEKS = 8;

export const MAX_WEEKLY_GOAL = 100;
export const GOAL_PRESETS = [3, 5, 10, 15];

export interface Week {
  weekStart: string;
  count: number;
}

export function cleanWeeklyGoal(value: unknown) {
  const goal = Math.round(Number(value));
  return Number.isFinite(goal) && goal >= 1 && goal <= MAX_WEEKLY_GOAL ? goal : null;
}

export function goalProgress(weeks: Week[], goal: number, now = new Date()) {
  const thisWeek = weeks.at(-1)?.count ?? 0;
  const dayOfWeek = (now.getUTCDay() + 6) % 7;
  const daysLeft = 7 - dayOfWeek;
  const remaining = Math.max(0, goal - thisWeek);
  const past = weeks.slice(0, -1);
  let streak = 0;
  for (let i = past.length - 1; i >= 0 && past[i].count >= goal; i--) streak++;
  const hit = remaining === 0;

  return {
    goal,
    thisWeek,
    remaining,
    daysLeft,
    perDay: Math.ceil(remaining / daysLeft),
    hit,
    streak: hit ? streak + 1 : streak,
    streakAtLimit: streak === past.length,
    onTrack: thisWeek >= Math.floor((goal * (dayOfWeek + 1)) / 7),
    history: weeks.slice(-HISTORY_WEEKS).map((week) => ({ ...week, hit: week.count >= goal })),
  };
}

export type GoalProgress = ReturnType<typeof goalProgress>;

export const STALE_SAVED_DAYS = 14;

export interface Notice {
  key: string;
  title: string;
  body: string;
  href: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function goalNotice(weeks: Week[], goal: number | null, now = new Date()): Notice | null {
  const week = weeks.at(-1)?.weekStart.slice(0, 10);
  const lastWeek = weeks.at(-2);
  if (!week) return null;
  const dayOfWeek = (now.getUTCDay() + 6) % 7;

  if (dayOfWeek === 0 && lastWeek) {
    const result = goal ? `${lastWeek.count} of ${goal}` : String(lastWeek.count);
    return { key: `review-${week}`, title: "Your week in review", body: `You applied to ${result} last week`, href: "/overview#review" };
  }
  if (!goal) return null;
  const p = goalProgress(weeks, goal, now);
  if (p.hit) return { key: `hit-${week}`, title: "Weekly goal hit", body: p.streak > 1 ? `${p.streak} weeks in a row` : "Start of a new streak", href: "/overview" };
  if (dayOfWeek === 6) return { key: `last-day-${week}`, title: "Last day for your weekly goal", body: `${plural(p.remaining, "more")} to hit ${goal}`, href: "/overview" };
  if (dayOfWeek >= 3 && !p.onTrack) return { key: `behind-${week}`, title: "Behind on your weekly goal", body: `${p.thisWeek} of ${goal} with ${plural(p.daysLeft, "day")} left`, href: "/overview" };
  return null;
}
