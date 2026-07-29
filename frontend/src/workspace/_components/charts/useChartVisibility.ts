import { useEffect, useRef, useState } from 'react';
import { scheduleChartMount } from './chartMountScheduler';

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

function handleDocumentVisibility() {
  publishVisibility();
}

function ensureObserver() {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          intersections.set(entry.target, entry.isIntersecting);
          listeners.get(entry.target)?.(
            document.visibilityState !== 'hidden' && entry.isIntersecting,
          );
        });
      },
      {
        root: null,
        rootMargin: '500px',
        threshold: 0,
      },
    );
  }

  if (!visibilityListenerInstalled) {
    document.addEventListener('visibilitychange', handleDocumentVisibility);
    visibilityListenerInstalled = true;
  }

  return observer;
}

function releaseObserverIfIdle() {
  if (listeners.size !== 0) return;
  observer?.disconnect();
  observer = null;
  intersections.clear();
  if (visibilityListenerInstalled) {
    document.removeEventListener('visibilitychange', handleDocumentVisibility);
    visibilityListenerInstalled = false;
  }
}

export function useChartVisibility<T extends HTMLElement>() {
  const elementRef = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  const [mountReady, setMountReady] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(document.visibilityState !== 'hidden');
      return undefined;
    }

    const chartObserver = ensureObserver();
    listeners.set(element, setVisible);
    intersections.set(element, false);
    chartObserver.observe(element);

    return () => {
      chartObserver.unobserve(element);
      listeners.delete(element);
      intersections.delete(element);
      releaseObserverIfIdle();
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      setMountReady(false);
      return undefined;
    }
    return scheduleChartMount(() => setMountReady(true));
  }, [visible]);

  return {
    elementRef,
    visible: visible && mountReady,
  };
}
