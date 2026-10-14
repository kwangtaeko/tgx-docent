import { createBrowserRouter, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Orders from '@/pages/orders/Orders';
import { OrderNew } from './pages/orders/OrderNew';
import NotFound from './pages/NotFound';

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      {
        path: 'orders',
        children: [
          { index: true, element: <Orders /> },
          { path: 'new', element: <OrderNew /> },
          { path: ':orderId', lazy: () => import('./pages/orders/OrderDetail') },
        ],
      },
      { path: 'old-orders', element: <Navigate to="/orders" replace /> },
    ],
  },
  { path: '*', element: <NotFound /> },
]);
