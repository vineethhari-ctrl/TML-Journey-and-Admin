import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.location.hash = '';
});

// jsdom doesn't implement these; components call them on navigation / list scrolling
window.scrollTo = () => {};
Element.prototype.scrollTo = function () {};
Element.prototype.scrollIntoView = function () {};
