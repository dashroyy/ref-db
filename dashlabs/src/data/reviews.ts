// Customer reviews and customer-print photos. BOTH START EMPTY ON PURPOSE:
// only add real ones, with the customer's permission. The site shows "be the
// first" until there are some, and star ratings only appear in search results
// once real reviews exist.
//
// To add a review: copy the example below into REVIEWS and fill it in.
//   { productId: 'orig-pen-launcher', name: 'Sam R.', rating: 5, date: '2026-12-01',
//     text: 'Flew the whole length of the office.', photo: '/gallery/sam-launcher.jpg' }
// Photos go in public/gallery/.

export interface Review {
  productId: string; // a product id from the catalog
  name: string; // how the customer wants to be shown, e.g. "Sam R."
  rating: 1 | 2 | 3 | 4 | 5;
  date: string; // YYYY-MM-DD
  text: string;
  photo?: string; // optional, under /gallery/
}

export const REVIEWS: Review[] = [];

// Photos of finished prints for the gallery on /lab/ (with the customer's OK).
//   { src: '/gallery/pet-portrait-1.jpg', alt: 'Golden retriever figurine in silk gold', caption: 'Pet portrait, 10 cm', productId: 'cust-pet' }
export interface GalleryPhoto {
  src: string;
  alt: string; // describe the photo for people who can't see it
  caption: string;
  productId?: string; // links the photo to a product
}

export const GALLERY: GalleryPhoto[] = [];

export const reviewsFor = (productId: string, all: Review[] = REVIEWS) =>
  all.filter((r) => r.productId === productId).sort((a, b) => b.date.localeCompare(a.date));

/** Average to one decimal, or null when there are none. */
export function ratingSummary(list: Review[]): { average: number; count: number } | null {
  if (!list.length) return null;
  return { average: Math.round((list.reduce((s, r) => s + r.rating, 0) / list.length) * 10) / 10, count: list.length };
}
