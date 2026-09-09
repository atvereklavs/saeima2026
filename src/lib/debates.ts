// Typed access to the curated debates file, mirroring src/lib/data.ts.
import debatesJson from "../../data/curated/debates.json";

export type DebateInsight = {
  list: string;
  speaker: string | null;
  summary: { lv: string; en: string };
  quote: string | null;
  source_url: string | null;
};

export type DebateEvent = {
  id: string;
  date: string;
  kind: "debate" | "interview" | "series" | "article";
  title: { lv: string; en: string };
  organiser: string;
  source: { name: string; url: string };
  video_url: string | null;
  topics: string[];
  insights: DebateInsight[];
};

export const debateEvents = ((debatesJson as { events?: DebateEvent[] }).events ?? [])
  .slice()
  .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));

/** Events touching one list, each with only that list's insights. */
export function eventsForList(slug: string): { event: DebateEvent; insights: DebateInsight[] }[] {
  return debateEvents
    .map((event) => ({ event, insights: event.insights.filter((i) => i.list === slug) }))
    .filter((x) => x.insights.length > 0);
}
