import { about, aboutSchema, type AboutContent } from '@/content/about';

// Loads the About page content: validated against its schema (a mistake
// fails the build instead of breaking the page), with a warning for any
// [placeholder] text still waiting to be filled in.

/** "[Your Name]" style text the developer hasn't replaced yet. */
export function isPlaceholder(value: string | undefined): boolean {
  return value !== undefined && /\[[^\]]*\]/.test(value);
}

/**
 * Paths of every string still holding a [placeholder], e.g.
 * "developer.name" or "developer.links.1.href".
 */
export function findPlaceholders(value: unknown, path = ''): string[] {
  if (typeof value === 'string') return isPlaceholder(value) ? [path] : [];

  if (Array.isArray(value)) {
    return value.flatMap((item, i) => findPlaceholders(item, path ? `${path}.${i}` : String(i)));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => findPlaceholders(item, path ? `${path}.${key}` : key));
  }

  return [];
}

let warned = false;

/**
 * The checked About content. Called while the page is statically built, so
 * the warning shows up in `next build` output (once per build worker).
 */
export function loadAbout(content: unknown = about): AboutContent {
  const result = aboutSchema.safeParse(content);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`content/about.ts is invalid:\n${issues}`);
  }

  const placeholders = findPlaceholders(result.data);

  if (placeholders.length > 0 && !warned) {
    warned = true;
    console.warn(
      `⚠ About page: ${placeholders.length} placeholder value(s) in content/about.ts are hidden until filled in:\n` +
        placeholders.map((path) => `  - ${path}`).join('\n')
    );
  }

  return result.data;
}

/** The developer's links that have real values (placeholders are hidden). */
export function filledLinks(content: AboutContent): AboutContent['developer']['links'] {
  return content.developer.links.filter((entry) => !isPlaceholder(entry.href));
}

/** "2026-10-30" → "Oct 30, 2026". Read as UTC so the build machine's timezone can't shift the day. */
export function formatAboutDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(isoDate));
}

/** Whether the developer card has enough real content to show at all. */
export function hasDeveloper(content: AboutContent): boolean {
  return !isPlaceholder(content.developer.name);
}
