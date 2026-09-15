import { signal } from '@preact/signals';

export type Route = {
  /** Path without the leading "#/" and without the query, e.g. "kids/abc" */
  path: string;
  /** Path split on "/" with empty segments removed */
  segments: string[];
  query: URLSearchParams;
};

function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = pathPart.replace(/\/+$/, '');
  return {
    path,
    segments: path.split('/').filter(Boolean),
    query: new URLSearchParams(queryPart),
  };
}

export const route = signal<Route>(parse(typeof location !== 'undefined' ? location.hash : ''));

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    route.value = parse(location.hash);
  });
}

/** Navigate to a hash route. `to` is written without the leading "#", e.g. "/kids/abc" or "/records?child=x". */
export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const target = '#' + (to.startsWith('/') ? to : '/' + to);
  if (opts.replace) {
    const url = location.pathname + location.search + target;
    history.replaceState(null, '', url);
    route.value = parse(target);
  } else {
    location.hash = target;
  }
}

export function back(fallback = '/kids'): void {
  if (history.length > 1) history.back();
  else navigate(fallback, { replace: true });
}

/** Build a route string from a path and query params (empty values are dropped). */
export function href(path: string, params: Record<string, string | string[] | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    const val = Array.isArray(v) ? v.join(',') : v;
    if (val !== '') q.set(k, val);
  }
  const qs = q.toString();
  return '#' + (path.startsWith('/') ? path : '/' + path) + (qs ? `?${qs}` : '');
}

export function useRoute(): Route {
  return route.value;
}
