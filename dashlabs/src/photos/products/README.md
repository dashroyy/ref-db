# Product photos

Make a folder here named after the product's page address (its slug), and put the photos in it:

```
src/photos/products/pen-launcher/01-on-the-desk.jpg
src/photos/products/pen-launcher/02-mid-launch.jpg
src/photos/products/custom-pet-figurine/01-golden-retriever.jpg
```

- **Order** follows the file names, so start them with 01, 02, 03… The first one is the main photo on the card,
  the product page, search results and the link-preview card.
- **Descriptions** for screen readers come from the name after the number: `02-mid-launch.jpg` becomes
  "Pen Launcher, mid launch". Camera names like `IMG_4512.jpg` work too ("photo 2"), but a short description is better.
- **Any size is fine.** Full-resolution phone photos are resized and converted to fast modern formats when the site
  is built. JPG, PNG and WebP work. **iPhone HEIC photos don't**: set Settings → Camera → Formats → *Most Compatible*,
  or export as JPG.
- **Square-ish works best** (product pages show photos square; cards crop to 4:3). Keep the product in the middle.
- The 3D model is always one tap away on the product page, so photos and the model sit side by side.

Slugs: `custom-person-figurine`, `custom-pet-figurine`, `pen-launcher`, `printed-business-cards`,
`desk-cable-dock`, `articulated-dragon`, `spiral-vase`, `name-keychain` (the end of each product's web address).

After adding photos, run `npm run og` so link previews use them.
