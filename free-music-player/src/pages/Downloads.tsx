import React from 'react';
import { Download, X, CheckCircle, AlertCircle, Clock, Music, Play, FolderOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDownloadStore } from '@/store/downloadStore';
import { useLibraryStore } from '@/store/libraryStore';
import { usePlayerStore } from '@/store/playerStore';
import { EmptyState } from '@/components/common/EmptyState';
import { Tabs } from '@/components/common/Tabs';
import { ipc } from '@/utils/ipc';
import type { Download as DownloadType } from '@/types';

export function DownloadsPage() {
  const { downloads, loading, loadDownloads, cancelDownload } = useDownloadStore();
  const { tracks: libraryTracks, loadTracks } = useLibraryStore();
  const { playTracks } = usePlayerStore();
  const [activeTab, setActiveTab] = React.useState('all');

  const activeDownloads = downloads;

  const completedDownloads: DownloadType[] = React.useMemo(() => {
    return libraryTracks
      .filter((t) => t.path && t.path.trim() !== '')
      .map((t) => ({
        id: `completed-${t.id}`,
        trackId: t.id,
        title: t.title || 'Unknown',
        artist: t.artist || '',
        progress: 100,
        status: 'completed' as const,
        outputPath: t.path,
        thumbnail: t.thumbnail || '',
        speed: '',
        eta: '',
      }));
  }, [libraryTracks]);

  React.useEffect(() => {
    loadDownloads();
    loadTracks();
    const interval = setInterval(() => {
      loadDownloads();
    }, 2000);
    return () => clearInterval(interval);
  }, [loadDownloads, loadTracks]);

  const activeIds = new Set(activeDownloads.map((d) => d.id));
  const allDownloads = [
    ...activeDownloads,
    ...completedDownloads.filter((d) => !activeIds.has(d.id)),
  ];

  const filtered = allDownloads.filter((d) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'downloading') return d.status === 'downloading' || d.status === 'pending';
    if (activeTab === 'completed') return d.status === 'completed';
    return true;
  });

  const statusIcons: Record<string, React.ReactNode> = {
    pending: <Clock size={14} className="text-surface-400" />,
    downloading: <Download size={14} className="text-mac-blue animate-pulse" />,
    completed: <CheckCircle size={14} className="text-mac-green" />,
    failed: <AlertCircle size={14} className="text-mac-red" />,
    cancelled: <X size={14} className="text-surface-400" />,
  };

  const activeCount = activeDownloads.filter((d) => d.status === 'downloading' || d.status === 'pending').length;
  const completedCount = completedDownloads.length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-5 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-mac-title-1 text-surface-50">Downloads</h1>
          <button
            type="button"
            onClick={() => ipc.app.openDownloadsFolder()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-mac-sm text-[13px] text-surface-400 hover:text-surface-100 hover:bg-white/5 transition-colors duration-150 cursor-pointer"
            title="Open downloads folder in Finder"
          >
            <FolderOpen size={13} /> Open Folder
          </button>
        </div>
        <Tabs
          tabs={[
            { id: 'all', label: `All (${allDownloads.length})` },
            { id: 'downloading', label: `Downloading (${activeCount})` },
            { id: 'completed', label: `Completed (${completedCount})` },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Download size={28} />}
            title={activeTab === 'completed' ? 'No completed downloads' : 'No downloads yet'}
            description={
              activeTab === 'completed'
                ? 'Downloaded tracks will appear here. Use "Download All" on a playlist to start.'
                : 'Search for music and download tracks for offline listening'
            }
          />
        ) : (
          <div className="space-y-1.5">
            {filtered.map((dl) => (
              <div
                key={dl.id}
                className="flex items-center gap-3 p-2.5 rounded-mac bg-mac-fill/15 border border-mac-separator/30 hover:bg-mac-fill/25 transition-colors duration-150"
              >
                <div className="w-9 h-9 rounded-mac-sm bg-surface-700 overflow-hidden flex-shrink-0">
                  {dl.thumbnail ? (
                    <img src={dl.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-surface-500">
                      <Music size={14} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-surface-100 truncate">{dl.title}</p>
                  <p className="text-[11px] text-surface-400 truncate">{dl.artist}</p>
                  {dl.status === 'downloading' && (
                    <div className="mt-1.5">
                      <div className="w-full h-1 bg-mac-fill/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-mac-blue rounded-full transition-all duration-300"
                          style={{ width: `${dl.progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-surface-500">{dl.speed}</span>
                        <span className="text-[10px] text-surface-500">{dl.eta}</span>
                      </div>
                    </div>
                  )}
                  {dl.status === 'completed' && dl.outputPath && (
                    <p className="text-[10px] text-surface-500 truncate mt-0.5" title={dl.outputPath}>
                      {dl.outputPath.split('/').pop()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {statusIcons[dl.status]}
                  {dl.status === 'completed' && (
                    <button
                      type="button"
                      onClick={() => {
                        const track = libraryTracks.find((t) => t.id === dl.trackId);
                        if (track) playTracks([track]);
                      }}
                      className="p-1 rounded-mac-sm hover:bg-white/5 text-surface-400 hover:text-mac-blue transition-colors duration-150 cursor-pointer"
                      title="Play this track"
                    >
                      <Play size={13} />
                    </button>
                  )}
                  {dl.status === 'completed' && dl.outputPath && (
                    <button
                      type="button"
                      onClick={() => ipc.app.revealInFolder(dl.outputPath)}
                      className="p-1 rounded-mac-sm hover:bg-white/5 text-surface-400 hover:text-surface-100 transition-colors duration-150 cursor-pointer"
                      title="Show in Finder"
                    >
                      <FolderOpen size={13} />
                    </button>
                  )}
                  {(dl.status === 'downloading' || dl.status === 'pending') && (
                    <button
                      type="button"
                      onClick={() => cancelDownload(dl.id)}
                      className="p-1 rounded-mac-sm hover:bg-white/5 text-surface-400 hover:text-mac-red transition-colors duration-150 cursor-pointer"
                      title="Cancel"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
