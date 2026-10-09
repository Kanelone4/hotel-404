import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { Intro } from '@/features/intro/Intro';
import { useTitleEasterEgg } from '@/lib/motion/useTitleEasterEgg';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { TransitionLayer } from '@/components/ui/TransitionLayer';

/** The 3D experience (hall + rooms) shares one persistent Canvas — code-split from the intro. */
const Experience = lazy(() => import('@/features/hub/Experience'));
const Credits = lazy(() => import('@/features/outro/Credits'));
const Lite = lazy(() => import('@/features/lite/Lite'));

function Root() {
  useTitleEasterEgg();
  return (
    <>
      <Suspense fallback={<LoadingScreen />}>
        <Outlet />
      </Suspense>
      <TransitionLayer />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <Intro /> },
      {
        element: <Experience />,
        children: [
          { path: '/hall', element: null },
          { path: '/room/:id', element: null },
        ],
      },
      { path: '/credits', element: <Credits /> },
      { path: '/lite', element: <Lite /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
], {
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});
