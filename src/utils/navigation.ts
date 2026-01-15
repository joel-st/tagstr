// Simple navigation utilities for hash-based routing
import { createSignal } from 'solid-js';

const [currentPath, setCurrentPath] = createSignal(window.location.hash || '#/');

// Navigation function
export const navigate = (path: string) => {
  const hash = path.startsWith('#') ? path : `#${path}`;
  window.location.hash = hash;
  setCurrentPath(hash);
};

// Get current path
export const getCurrentPath = () => currentPath();

// Extract route parameters
export const getRouteParams = () => {
  const hash = currentPath().replace('#', '');
  const segments = hash.split('/');
  
  if (hash.startsWith('/hashtag/') && segments.length >= 3) {
    return {
      tag: decodeURIComponent(segments[2])
    };
  }
  
  return {};
};

// Check if current route matches
export const isRoute = (path: string) => {
  const current = currentPath().replace('#', '');
  
  if (path === '/' && current === '/') return true;
  if (path === '/hashtag/:tag' && current.startsWith('/hashtag/')) return true;
  
  return false;
};

// Initialize navigation
export const initNavigation = () => {
  const handleHashChange = () => {
    setCurrentPath(window.location.hash || '#/');
  };

  window.addEventListener('hashchange', handleHashChange);
  
  // Set initial path
  if (!window.location.hash) {
    navigate('/');
  }
  
  return () => {
    window.removeEventListener('hashchange', handleHashChange);
  };
};

// Get current route component key
export const getCurrentRoute = () => {
  const hash = currentPath().replace('#', '');
  
  if (hash.startsWith('/hashtag/')) {
    return 'hashtag';
  }
  
  return 'home';
};