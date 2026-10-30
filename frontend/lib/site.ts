// The public address of the site, used for canonical URLs, share images and
// structured data. Set NEXT_PUBLIC_SITE_URL once the app has a real domain;
// until then links in metadata point at the local dev server.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
