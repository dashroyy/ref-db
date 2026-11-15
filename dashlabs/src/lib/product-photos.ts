// Product photos: drop files into src/photos/products/<product-slug>/ and they
// appear on the product page and card, in filename order (01-front.jpg,
// 02-side.jpg…). At build time each one is resized and converted to modern
// formats, so full-size phone photos are fine. The name after the number
// becomes the description for screen readers: "02-on-the-desk.jpg" →
// "Pen Launcher, on the desk".
//
// Paths listed in a product's `images` (files in /public) still work and come
// after the folder's photos.
import type { ImageMetadata } from 'astro';
import type { Product } from '../data/catalog.ts';
import { captionFromFile } from './caption.ts';

const files = import.meta.glob<{ default: ImageMetadata }>('/src/photos/products/*/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}', {
  eager: true,
});

export interface ProductPhoto {
  src: ImageMetadata | string; // optimised (folder) or as-is (public path)
  alt: string;
  caption?: string; // shown under it full screen (defaults to alt)
}


export function photosFor(p: Product): ProductPhoto[] {
  const prefix = `/src/photos/products/${p.slug}/`;
  const local = Object.keys(files)
    .filter((k) => k.startsWith(prefix))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((k, i) => {
      const c = captionFromFile(k);
      return { src: files[k].default, alt: c ? `${p.name}, ${c}` : `${p.name}, photo ${i + 1}` };
    });
  const legacy = (p.images ?? []).map((src, i) => ({ src, alt: `${p.name}, photo ${local.length + i + 1}` }));
  return [...local, ...legacy];
}
