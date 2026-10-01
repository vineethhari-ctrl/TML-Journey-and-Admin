import { useEffect } from 'react';
import { useApp } from '../context/AppContext';

/**
 * Applies `?search=<value>` from the current route (e.g. `/admin/users?search=amit`)
 * to a page's local search box, so the command palette can deep-link into filtered lists.
 */
export function useRouteSearchParam(apply: (value: string) => void) {
  const { currentRoute } = useApp();
  useEffect(() => {
    const value = new URLSearchParams(currentRoute.split('?')[1] || '').get('search');
    if (value !== null) apply(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoute]);
}
