import { z, ZodSchema } from 'zod';

/**
 * Validate incoming IPC data against a Zod schema.
 * Throws a descriptive error if validation fails.
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid ${label}: ${issues}`);
  }
  return result.data;
}

// --- Reusable schema fragments ---

export const TrackSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional().default(''),
  artist: z.string().optional().default(''),
  album: z.string().optional().default(''),
  duration: z.number().optional().default(0),
  path: z.string().optional().default(''),
  thumbnail: z.string().optional().default(''),
  youtubeId: z.string().optional().default(''),
  youtube_id: z.string().optional().default(''),
  source: z.string().optional().default('local'),
  playCount: z.number().optional().default(0),
  play_count: z.number().optional().default(0),
  isFavorite: z.boolean().optional().default(false),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const PlaylistUpdateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional().default(''),
  thumbnail: z.string().optional().default(''),
  trackCount: z.number().optional(),
});

export const PlaylistCreateSchema = z.object({
  name: z.string().min(1, 'Playlist name cannot be empty').max(200),
  description: z.string().optional().default(''),
});

export const IdSchema = z.string().min(1, 'ID cannot be empty');

export const SettingsPartialSchema = z.record(z.string(), z.unknown());

export const SessionSchema = z.record(z.string(), z.unknown());

export const SearchQuerySchema = z.string().min(1).max(500);

export const VolumeSchema = z.number().min(0).max(1);

export const ReorderSchema = z.object({
  from: z.number().int().min(0),
  to: z.number().int().min(0),
});
