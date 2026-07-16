import { createBrowserRouter, RouterProvider } from 'react-router';

import { routes } from './routes';

const router = createBrowserRouter(routes);

export const AppRoutes = () => {
  return <RouterProvider router={router} />;
};
