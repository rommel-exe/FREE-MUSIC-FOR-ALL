import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Monitor, Music, FolderOpen, Info, RefreshCw, Download, Sliders, RotateCcw } from 'lucide-react';
import { useEQStore, PRESET_LABELS, BAND_LABELS, type EQPreset, type EQBands } from '@/store/eqStore';
import { useUIStore } from '@/store/uiStore';
import { ipc } from '@/utils/ipc';
import type { Settings as SettingsType } from '@/types';
import { Button } from '@/components/common/Button';

export function SettingsPage() {
  const { theme, toggleTheme } = useUIStore();
  const { addToast } = useUIStore();
  const { enabled: eqEnabled, preset: eqPreset, bands: eqBands, setEnabled: setEqEnabled, setPreset: setEqPreset, setBand: setEqBand, reset: resetEq } = useEQStore();
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [settings, setSettings] = useState<SettingsType>({
    downloadPath: '',
    downloadFormat: 'mp3',
    audioQuality: 'high',
    crossfadeDuration: 0,
    theme: 'dark',
    miniPlayerOnClose: false,
    startupAction: 'none',
    equalizerPreset: 'flat',
    volume: 0.8,
  });

  useEffect(() => {
    ipc.settings.getSettings().then(setSettings).catch(() => {});
    ipc.update.getVersion().then(setAppVersion).catch(() => {});
  }, []);

  const checkForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const state = await ipc.update.check();
      if (state.status === 'available') {
        addToast(`Update v${state.version} available`, 'info');
      } else if (state.status === 'not-available') {
        addToast("You're on the latest version", 'success');
      } else if (state.status === 'error') {
        addToast(`Update check failed: ${state.error || 'unknown'}`, 'error');
      }
    } catch (e: any) {
      addToast(`Update check failed: ${e.message}`, 'error');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const updateSetting = async <K extends keyof SettingsType>(key: K, value: SettingsType[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await ipc.settings.updateSettings({ [key]: value });
  };

  return (
    <div className="h-full overflow-y-auto p-5">
      <h1 className="text-mac-title-1 text-surface-50 mb-5">Settings</h1>

      <div className="max-w-2xl space-y-5">
        {/* General */}
        <section className="bg-mac-fill/15 rounded-mac-lg border border-mac-separator/50 p-4">
          <h2 className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-3">General</h2>
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-surface-100">Theme</p>
                <p className="text-[11px] text-surface-400">Switch between dark and light mode</p>
              </div>
              <button
                type="button"
                onClick={() => { toggleTheme(); updateSetting('theme', theme === 'dark' ? 'light' : 'dark'); }}
                className="relative w-[38px] h-[22px] rounded-full transition-colors duration-200 cursor-pointer"
                style={{ background: theme === 'dark' ? '#0A84FF' : 'rgba(120, 120, 128, 0.36)' }}
              >
                <div
                  className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${theme === 'dark' ? 'translate-x-[18px]' : 'translate-x-[2px]'}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-surface-100">Mini Player on Close</p>
                <p className="text-[11px] text-surface-400">Show mini player when closing main window</p>
              </div>
              <button
                type="button"
                onClick={() => updateSetting('miniPlayerOnClose', !settings.miniPlayerOnClose)}
                className="relative w-[38px] h-[22px] rounded-full transition-colors duration-200 cursor-pointer"
                style={{ background: settings.miniPlayerOnClose ? '#0A84FF' : 'rgba(120, 120, 128, 0.36)' }}
              >
                <div
                  className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${settings.miniPlayerOnClose ? 'translate-x-[18px]' : 'translate-x-[2px]'}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-surface-100">Startup Action</p>
                <p className="text-[11px] text-surface-400">What to do when the app starts</p>
              </div>
              <select
                value={settings.startupAction}
                onChange={(e) => updateSetting('startupAction', e.target.value as any)}
                className="bg-mac-fill/50 border border-mac-separator rounded-mac-sm px-2.5 py-1 text-[13px] text-surface-200 focus:outline-none cursor-pointer"
              >
                <option value="none">Do nothing</option>
                <option value="resume">Resume last track</option>
                <option value="lastPlaylist">Open last playlist</option>
              </select>
            </div>
          </div>
        </section>

        {/* Downloads */}
        <section className="bg-mac-fill/15 rounded-mac-lg border border-mac-separator/50 p-4">
          <h2 className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-3">Downloads</h2>
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-surface-100">Download Format</p>
                <p className="text-[11px] text-surface-400">Audio format for downloads</p>
              </div>
              <select
                value={settings.downloadFormat}
                onChange={(e) => updateSetting('downloadFormat', e.target.value as any)}
                className="bg-mac-fill/50 border border-mac-separator rounded-mac-sm px-2.5 py-1 text-[13px] text-surface-200 focus:outline-none cursor-pointer"
              >
                <option value="mp3">MP3</option>
                <option value="flac">FLAC</option>
                <option value="ogg">OGG</option>
                <option value="m4a">M4A</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-surface-100">Audio Quality</p>
                <p className="text-[11px] text-surface-400">Higher quality = larger files</p>
              </div>
              <select
                value={settings.audioQuality}
                onChange={(e) => updateSetting('audioQuality', e.target.value as any)}
                className="bg-mac-fill/50 border border-mac-separator rounded-mac-sm px-2.5 py-1 text-[13px] text-surface-200 focus:outline-none cursor-pointer"
              >
                <option value="low">Low (128 kbps)</option>
                <option value="medium">Medium (192 kbps)</option>
                <option value="high">High (320 kbps)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Playback */}
        <section className="bg-mac-fill/15 rounded-mac-lg border border-mac-separator/50 p-4">
          <h2 className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-3">Playback</h2>
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-surface-100">Crossfade Duration</p>
                <p className="text-[11px] text-surface-400">Seconds between track transitions (0 = off)</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={12}
                  value={settings.crossfadeDuration}
                  onChange={(e) => updateSetting('crossfadeDuration', Number(e.target.value))}
                  className="w-32 accent-mac-blue"
                />
                <span className="text-[13px] text-surface-400 w-8">{settings.crossfadeDuration}s</span>
              </div>
            </div>
          </div>
        </section>

        {/* Equalizer */}
        <section className="bg-mac-fill/15 rounded-mac-lg border border-mac-separator/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sliders size={13} className="text-mac-blue" />
              <h2 className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">Equalizer</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetEq}
                className="px-2 py-0.5 rounded-mac-sm text-[11px] text-surface-400 hover:text-surface-100 hover:bg-white/5 flex items-center gap-1 cursor-pointer"
                title="Reset to Flat"
              >
                <RotateCcw size={11} /> Reset
              </button>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-surface-400">{eqEnabled ? 'On' : 'Off'}</span>
                <button
                  type="button"
                  onClick={() => setEqEnabled(!eqEnabled)}
                  className="relative w-[38px] h-[22px] rounded-full transition-colors duration-200 cursor-pointer"
                  style={{ background: eqEnabled ? '#0A84FF' : 'rgba(120, 120, 128, 0.36)' }}
                  role="switch"
                  aria-checked={eqEnabled}
                >
                  <div
                    className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${eqEnabled ? 'translate-x-[18px]' : 'translate-x-[2px]'}`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Preset selector */}
          <div className="mb-4">
            <label className="text-[11px] text-surface-500 block mb-1.5">Preset</label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(PRESET_LABELS) as EQPreset[]).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setEqPreset(p)}
                  className={`px-2.5 py-1 rounded-mac-sm text-[11px] font-medium transition-colors duration-150 cursor-pointer ${
                    eqPreset === p
                      ? 'bg-mac-blue text-white'
                      : 'glass-control text-surface-300 hover:bg-mac-fill-hover'
                  }`}
                >
                  {PRESET_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* 5-band sliders */}
          <div className={`space-y-2.5 ${eqEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
            <EQSlider
              label="Preamp"
              freq=""
              value={eqBands.preamp}
              onChange={(v) => setEqBand('preamp', v)}
            />
            {(Object.keys(BAND_LABELS) as Array<keyof typeof BAND_LABELS>).map((band) => (
              <EQSlider
                key={band}
                label={BAND_LABELS[band].label}
                freq={BAND_LABELS[band].freq}
                value={eqBands[band]}
                onChange={(v) => setEqBand(band, v)}
              />
            ))}
          </div>
          <p className="text-[11px] text-surface-500 mt-3">
            Changes apply live while music is playing. The preamp adjusts overall volume to prevent clipping.
          </p>
        </section>

        {/* About */}
        <section className="bg-mac-fill/15 rounded-mac-lg border border-mac-separator/50 p-4">
          <h2 className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-3">About</h2>
          <div className="space-y-2.5">
            <p className="text-[13px] text-surface-400">Free Music Player v{appVersion}</p>
            <p className="text-[11px] text-surface-500">Stream and download music for free using YouTube. Import playlists from Spotify and YouTube Music.</p>
            <div className="pt-1">
              <button
                type="button"
                onClick={checkForUpdates}
                disabled={checkingUpdate}
                className="px-3 py-1.5 glass-control rounded-mac-sm hover:bg-mac-fill-hover disabled:opacity-40 text-surface-200 text-[13px] flex items-center gap-2 transition-colors duration-150 cursor-pointer"
              >
                <RefreshCw size={13} className={checkingUpdate ? 'animate-spin' : ''} />
                {checkingUpdate ? 'Checking…' : 'Check for updates'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function EQSlider({
  label,
  freq,
  value,
  onChange,
}: {
  label: string;
  freq: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0">
        <p className="text-[13px] text-surface-100">{label}</p>
        {freq && <p className="text-[10px] text-surface-500">{freq}</p>}
      </div>
      <input
        type="range"
        min={-12}
        max={12}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-mac-blue"
      />
      <span
        className={`text-[13px] font-mono w-14 text-right tabular-nums ${
          value > 0
            ? 'text-mac-green'
            : value < 0
            ? 'text-mac-red'
            : 'text-surface-500'
        }`}
      >
        {value > 0 ? '+' : ''}
        {value.toFixed(1)} dB
      </span>
    </div>
  );
}
