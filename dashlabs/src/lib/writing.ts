// Owner-written content in src/writing/ (Markdown): the maker's note and the
// build log. Photos for them live in src/photos/about/ and src/photos/build-log/
// and are optimised at build time like product photos.
import type { ImageMetadata, MarkdownInstance } from 'astro';
import type { ProductPhoto } from './product-photos.ts';
import { formatLogDate } from './caption.ts';
export { formatLogDate };

const aboutPhotos = import.meta.glob<{ default: ImageMetadata }>('/src/photos/about/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG}', { eager: true });
const logPhotos = import.meta.glob<{ default: ImageMetadata }>('/src/photos/build-log/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG}', { eager: true });

const photoIn = (set: Record<string, { default: ImageMetadata }>, dir: string, file: string, alt: string): ProductPhoto | undefined => {
  const hit = set[`/src/photos/${dir}/${file}`];
  return hit ? { src: hit.default, alt } : undefined;
};

export interface MakerNote {
  draft?: boolean;
  signature?: string;
  photo?: string;
  photoAlt?: string;
}
export function makerPhoto(fm: MakerNote): ProductPhoto | undefined {
  return fm.photo ? photoIn(aboutPhotos, 'about', fm.photo, fm.photoAlt || 'The DashLabs workshop') : undefined;
}

export interface LogEntry {
  date: string; // "2026-10" or "2026-10-14"
  title: string;
  example: boolean;
  photos: ProductPhoto[];
  Content: MarkdownInstance<Record<string, unknown>>['Content'];
}

const files = import.meta.glob<MarkdownInstance<{ date: string | Date; title: string; example?: boolean; photos?: string[] }>>('/src/writing/build-log/*.md', {
  eager: true,
});

/** YAML turns 2026-10-14 into a Date and leaves 2026-10 as text: normalise to text. */
const isoDate = (d: string | Date) => (d instanceof Date ? d.toISOString() : String(d)).replace(/^(\d{4}-\d{2}-\d{2})T.*$/, '$1');


export function buildLog(): LogEntry[] {
  return Object.entries(files)
    .filter(([path]) => !/\/README\.md$/i.test(path))
    .map(([, f]) => {
      const date = isoDate(f.frontmatter.date);
      const title = f.frontmatter.title ?? 'Untitled';
      return {
        date,
        title,
        example: !!f.frontmatter.example,
        photos: (f.frontmatter.photos ?? [])
          .map((file, i) => photoIn(logPhotos, 'build-log', file, `${title}, photo ${i + 1}`))
          .filter((p): p is ProductPhoto => !!p),
        Content: f.Content,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
