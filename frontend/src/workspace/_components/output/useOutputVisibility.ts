import { useEffect, useRef, useState } from 'react';
import { scheduleOutputMount } from './outputMountScheduler';

type VisibilityListener = (visible: boolean) => void;

const listeners = new Map<Element, VisibilityListener>();
const intersections = new Map<Element, boolean>();
let observer: IntersectionObserver | null = null;
let visibilityListenerInstalled = false;

function publishVisibility() {
  const pageVisible = document.visibilityState !== 'hidden';
  listeners.forEach((listener, element) => {
    listener(pageVisible && Boolean(intersections.get(element)));
  });
}

function ensureObserver() {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        const pageVisible = document.visibilityState !== 'hidden';
        entries.forEach((entry) => {
          intersections.set(entry.target, entry.isIntersecting);
          listeners.get(entry.target)?.(pageVisible && entry.isIntersecting);
        });
      },
      {
        root: null,
        rootMargin: '200px',
        threshold: 0,
      },
    );
  }
  if (!visibilityListenerInstalled) {
    document.addEventListener('visibilitychange', publishVisibility);
    visibilityListenerInstalled = true;
  }
  return observer;
}

function releaseObserverIfIdle() {
  if (listeners.size) return;
  observer?.disconnect();
  observer = null;
  intersections.clear();
  if (visibilityListenerInstalled) {
    document.removeEventListener('visibilitychange', publishVisibility);
    visibilityListenerInstalled = false;
  }
}

export function useOutputVisibility<T extends HTMLElement>(enabled = true) {
  const elementRef = useRef<T | null>(null);
  const [intersecting, setIntersecting] = useState(false);
  const [mountReady, setMountReady] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!enabled || !element) {
      setIntersecting(false);
      return undefined;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setIntersecting(document.visibilityState !== 'hidden');
      return undefined;
    }
    const outputObserver = ensureObserver();
    const handleVisibility = (visible: boolean) => {
    if (visible) setIntersecting(true);
    };

    listeners.set(element, handleVisibility);
    intersections.set(element, false);
    outputObserver.observe(element);
    return () => {
      outputObserver.unobserve(element);
      listeners.delete(element);
      intersections.delete(element);
      releaseObserverIfIdle();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !intersecting) {
      setMountReady(false);
      return undefined;
    }
    return scheduleOutputMount(() => setMountReady(true));
  }, [enabled, intersecting]);

  return {
    elementRef,
    visible: enabled && intersecting && mountReady,
  };
}
