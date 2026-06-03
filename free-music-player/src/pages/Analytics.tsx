import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Clock,
  Music,
  User,
  Disc3,
  Flame,
  Play,
  CheckCircle2,
} from 'lucide-react';
import { ipc, type AnalyticsOverview, type TopArtist, type TopAlbum, type TopTrack, type DayStat, type HourStat, type RecentPlay } from '@/utils/ipc';

function formatSeconds(secs: number): string {
  if (secs < 60) return `${Math.round(secs)}s`;
  const hours = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatMinutes(secs: number): string {
  const hours = Math.floor(secs / 3600);
  const mins = Math.round((secs % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function Bar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-4 bg-mac-fill/30 rounded-mac-sm overflow-hidden relative">
      <div
        className="h-full bg-mac-blue/60 rounded-mac-sm transition-all duration-500"
        style={{ width: `${Math.min(100, pct)}%` }}
      />
      {label && (
        <span className="absolute inset-0 flex items-center px-2 text-[10px] text-surface-200/80 truncate">
          {label}
        </span>
      )}
    </div>
  );
}

function HourHeatmap({ data }: { data: HourStat[] }) {
  const hours = new Array(24).fill(0);
  data.forEach((h) => { hours[h.hour] = h.seconds; });
  const max = Math.max(...hours, 1);

  const labels = Array.from({ length: 24 }, (_, i) => {
    if (i === 0) return '12a';
    if (i === 12) return '12p';
    if (i < 12) return `${i}a`;
    return `${i - 12}p`;
  });

  return (
    <div className="flex gap-0.5 items-end h-24">
      {hours.map((val, i) => {
        const pct = max > 0 ? (val / max) * 100 : 0;
        const opacity = pct > 0 ? 0.25 + (pct / 100) * 0.75 : 0.08;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className="w-full rounded-t transition-all"
              style={{
                height: `${Math.max(2, pct)}%`,
                backgroundColor: `rgba(10, 132, 255, ${opacity})`,
              }}
            />
            <span className="text-[7px] text-surface-500 hidden md:block">{labels[i]}</span>
            <div className="hidden group-hover:block absolute bottom-full mb-2 glass-elevated text-[11px] text-surface-200 px-2 py-1 rounded-mac-sm shadow-lg z-10 whitespace-nowrap">
              {labels[i]}: {formatMinutes(val)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [topArtists, setTopArtists] = useState<TopArtist[]>([]);
  const [topAlbums, setTopAlbums] = useState<TopAlbum[]>([]);
  const [topTracks, setTopTracks] = useState<TopTrack[]>([]);
  const [listeningByDay, setListeningByDay] = useState<DayStat[]>([]);
  const [listeningByHour, setListeningByHour] = useState<HourStat[]>([]);
  const [streak, setStreak] = useState<{ current: number; longest: number }>({ current: 0, longest: 0 });
  const [recentPlays, setRecentPlays] = useState<RecentPlay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [o, artists, albums, tracks, day, hour, s, recent] = await Promise.all([
        ipc.analytics.getOverview(),
        ipc.analytics.getTopArtists(10),
        ipc.analytics.getTopAlbums(10),
        ipc.analytics.getTopTracks(10),
        ipc.analytics.getListeningByDay(30),
        ipc.analytics.getListeningByHour(),
        ipc.analytics.getStreak(),
        ipc.analytics.getRecentPlays(15),
      ]);
      setOverview(o);
      setTopArtists(artists);
      setTopAlbums(albums);
      setTopTracks(tracks);
      setListeningByDay(day);
      setListeningByHour(hour);
      setStreak(s);
      setRecentPlays(recent);
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-surface-400 text-[13px]">Loading analytics…</div>
      </div>
    );
  }

  const totalHours = overview ? overview.totalSeconds / 3600 : 0;
  const maxDaySeconds = Math.max(...listeningByDay.map((d) => d.seconds), 1);

  return (
    <div className="h-full overflow-y-auto p-5 pb-24">
      <h1 className="text-mac-title-1 text-surface-50 mb-5">Analytics</h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-6">
        <StatCard icon={<Play size={14} />} label="Total Plays" value={overview?.totalPlays?.toLocaleString() ?? '0'} />
        <StatCard icon={<Clock size={14} />} label="Listening Time" value={totalHours >= 1 ? `${totalHours.toFixed(1)}h` : formatMinutes(overview?.totalSeconds ?? 0)} />
        <StatCard icon={<Music size={14} />} label="Unique Tracks" value={String(overview?.uniqueTracks ?? 0)} />
        <StatCard icon={<User size={14} />} label="Unique Artists" value={String(overview?.uniqueArtists ?? 0)} />
        <StatCard icon={<Disc3 size={14} />} label="Unique Albums" value={String(overview?.uniqueAlbums ?? 0)} />
        <StatCard icon={<Flame size={14} />} label="Current Streak" value={`${streak.current} days`} />
        <StatCard icon={<Flame size={14} />} label="Longest Streak" value={`${streak.longest} days`} />
        <StatCard icon={<CheckCircle2 size={14} />} label="Completion Rate" value={
          overview && overview.totalPlays > 0
            ? `${Math.round((overview.completedPlays / overview.totalPlays) * 100)}%`
            : '—'
        } />
      </div>

      {/* Listening Over Time */}
      <Section title="Listening Over Time" subtitle="Last 30 days">
        {listeningByDay.length === 0 ? (
          <p className="text-surface-500 text-[13px]">No listening data yet.</p>
        ) : (
          <div className="flex gap-0.5 items-end h-32">
            {listeningByDay.map((d) => {
              const pct = maxDaySeconds > 0 ? (d.seconds / maxDaySeconds) * 100 : 0;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div
                    className="w-full rounded-t bg-mac-blue/50 transition-all"
                    style={{ height: `${Math.max(2, pct)}%` }}
                  />
                  <span className="text-[7px] text-surface-500 hidden md:block">
                    {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="hidden group-hover:block absolute bottom-full mb-2 glass-elevated text-[11px] text-surface-200 px-2 py-1 rounded-mac-sm shadow-lg z-10 whitespace-nowrap">
                    {d.date}: {formatMinutes(d.seconds)} ({d.plays} plays)
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Listening by Hour */}
      <Section title="Listening by Hour" subtitle="When do you listen?">
        <HourHeatmap data={listeningByHour} />
        <div className="flex justify-between text-[9px] text-surface-500 mt-1 px-1">
          <span>12 AM</span>
          <span>6 AM</span>
          <span>12 PM</span>
          <span>6 PM</span>
          <span>11 PM</span>
        </div>
      </Section>

      {/* Top Artists */}
      <Section title="Top Artists" subtitle="By listening time">
        {topArtists.length === 0 ? (
          <p className="text-surface-500 text-[13px]">No artist data yet.</p>
        ) : (
          <div className="space-y-2">
            {topArtists.map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[11px] text-surface-500 w-5 text-right tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-surface-100 truncate">{a.artist}</p>
                  <Bar value={a.total_seconds} max={topArtists[0]?.total_seconds || 1} />
                  <p className="text-[10px] text-surface-500 mt-0.5">
                    {a.track_count} tracks · {a.play_count} plays · {formatMinutes(a.total_seconds)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Top Albums */}
      <Section title="Top Albums" subtitle="By listening time">
        {topAlbums.length === 0 ? (
          <p className="text-surface-500 text-[13px]">No album data yet.</p>
        ) : (
          <div className="space-y-2">
            {topAlbums.map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[11px] text-surface-500 w-5 text-right tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-surface-100 truncate">{a.album}</p>
                  <p className="text-[10px] text-surface-400">{a.artist}</p>
                  <Bar value={a.total_seconds} max={topAlbums[0]?.total_seconds || 1} />
                  <p className="text-[10px] text-surface-500 mt-0.5">
                    {a.track_count} tracks · {a.play_count} plays · {formatMinutes(a.total_seconds)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Top Tracks */}
      <Section title="Top Tracks" subtitle="By listening time">
        {topTracks.length === 0 ? (
          <p className="text-surface-500 text-[13px]">No track data yet.</p>
        ) : (
          <div className="space-y-2">
            {topTracks.map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[11px] text-surface-500 w-5 text-right tabular-nums">{i + 1}</span>
                <div className="w-9 h-9 rounded-mac-sm bg-surface-700 shrink-0 overflow-hidden">
                  {t.thumbnail ? (
                    <img src={t.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music size={13} className="text-surface-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-surface-100 truncate">{t.title}</p>
                  <p className="text-[10px] text-surface-400">{t.artist}</p>
                  <Bar value={t.total_seconds} max={topTracks[0]?.total_seconds || 1} />
                  <p className="text-[10px] text-surface-500 mt-0.5">
                    {t.play_count} plays · {formatMinutes(t.total_seconds)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Recent Plays */}
      <Section title="Recent Plays" subtitle="Last 15 plays">
        {recentPlays.length === 0 ? (
          <p className="text-surface-500 text-[13px]">No recent plays.</p>
        ) : (
          <div className="space-y-0.5">
            {recentPlays.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-1.5 hover:bg-white/5 rounded-mac-sm px-2 -mx-2 transition-colors duration-150">
                <div className="w-8 h-8 rounded-mac-sm bg-surface-700 shrink-0 overflow-hidden">
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music size={12} className="text-surface-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-surface-100 truncate">{p.title || 'Unknown'}</p>
                  <p className="text-[10px] text-surface-400">{p.artist || 'Unknown'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-surface-400">{formatTime(p.played_at)}</p>
                  <p className="text-[10px] text-surface-500">{formatSeconds(p.seconds_played)} · {p.completed ? '✓' : '→'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-mac-fill/15 rounded-mac-lg border border-mac-separator/50 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-mac-blue">{icon}</span>
        <span className="text-[10px] text-surface-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-[17px] font-bold text-surface-50 tabular-nums">{value}</p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-mac-fill/15 rounded-mac-lg border border-mac-separator/50 p-4 mb-3">
      <div className="mb-3">
        <h2 className="text-[13px] font-semibold text-surface-200">{title}</h2>
        {subtitle && <p className="text-[10px] text-surface-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
