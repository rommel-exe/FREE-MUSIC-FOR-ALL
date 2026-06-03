import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EQPreset =
  | 'flat'
  | 'bass-boost'
  | 'vocal-boost'
  | 'rock'
  | 'pop'
  | 'electronic'
  | 'jazz'
  | 'classical'
  | 'hip-hop'
  | 'acoustic'
  | 'custom';

export interface EQBands {
  preamp: number;   // -12 to +12 dB
  bass: number;     // 60 Hz
  lowMid: number;   // 250 Hz
  mid: number;      // 1 kHz
  highMid: number;  // 4 kHz
  treble: number;   // 12 kHz
}

export const PRESET_BANDS: Record<Exclude<EQPreset, 'custom'>, EQBands> = {
  flat:         { preamp: 0,  bass: 0,  lowMid: 0,  mid: 0,  highMid: 0,  treble: 0  },
  'bass-boost': { preamp: 2,  bass: 9,  lowMid: 4,  mid: 0,  highMid: -2, treble: -3 },
  'vocal-boost':{ preamp: 0,  bass: -2, lowMid: -1, mid: 5,  highMid: 6,  treble: 2  },
  rock:         { preamp: 3,  bass: 7,  lowMid: 4,  mid: -2, highMid: 4,  treble: 6  },
  pop:          { preamp: 1,  bass: 3,  lowMid: 1,  mid: 4,  highMid: 5,  treble: 3  },
  electronic:   { preamp: 4,  bass: 8,  lowMid: 1,  mid: -3, highMid: 2,  treble: 5  },
  jazz:         { preamp: 1,  bass: 3,  lowMid: 2,  mid: 1,  highMid: 3,  treble: 4  },
  classical:    { preamp: 0,  bass: 2,  lowMid: 1,  mid: 0,  highMid: 2,  treble: 4  },
  'hip-hop':    { preamp: 4,  bass: 8,  lowMid: 5,  mid: -1, highMid: 2,  treble: 3  },
  acoustic:     { preamp: 0,  bass: 3,  lowMid: 2,  mid: 1,  highMid: 2,  treble: 3  },
};

export const PRESET_LABELS: Record<EQPreset, string> = {
  flat: 'Flat',
  'bass-boost': 'Bass Boost',
  'vocal-boost': 'Vocal Boost',
  rock: 'Rock',
  pop: 'Pop',
  electronic: 'Electronic',
  jazz: 'Jazz',
  classical: 'Classical',
  'hip-hop': 'Hip-Hop',
  acoustic: 'Acoustic',
  custom: 'Custom',
};

export const BAND_LABELS: Record<keyof Omit<EQBands, 'preamp'>, { label: string; freq: string }> = {
  bass:     { label: 'Bass',     freq: '60 Hz'   },
  lowMid:   { label: 'Low Mid',  freq: '250 Hz'  },
  mid:      { label: 'Mid',      freq: '1 kHz'   },
  highMid:  { label: 'High Mid', freq: '4 kHz'   },
  treble:   { label: 'Treble',   freq: '12 kHz'  },
};

interface EQState {
  enabled: boolean;
  preset: EQPreset;
  bands: EQBands;
  setEnabled: (enabled: boolean) => void;
  setPreset: (preset: EQPreset) => void;
  setBand: (band: keyof EQBands, value: number) => void;
  setBands: (bands: EQBands) => void;
  reset: () => void;
}

const initialBands = PRESET_BANDS.flat;

export const useEQStore = create<EQState>()(
  persist(
    (set) => ({
      enabled: false,
      preset: 'flat',
      bands: { ...initialBands },
      setEnabled: (enabled) => set({ enabled }),
      setPreset: (preset) => {
        if (preset === 'custom') {
          set({ preset });
        } else {
          set({ preset, bands: { ...PRESET_BANDS[preset] } });
        }
      },
      setBand: (band, value) => {
        set((s) => {
          const newBands = { ...s.bands, [band]: value };
          // If the user is now adjusting bands manually, switch to custom preset
          // (only if the new bands don't match any preset exactly)
          const matchesPreset = (Object.entries(PRESET_BANDS) as [EQPreset, EQBands][]).some(
            ([_, p]) =>
              p.preamp === newBands.preamp &&
              p.bass === newBands.bass &&
              p.lowMid === newBands.lowMid &&
              p.mid === newBands.mid &&
              p.highMid === newBands.highMid &&
              p.treble === newBands.treble,
          );
          return {
            bands: newBands,
            preset: matchesPreset ? s.preset : 'custom',
          };
        });
      },
      setBands: (bands) => set({ bands }),
      reset: () => set({ enabled: false, preset: 'flat', bands: { ...initialBands } }),
    }),
    { name: 'fmp-eq-settings' }
  )
);
