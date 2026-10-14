import { type RouteConfig, index, layout, prefix, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('login', 'routes/login.tsx'),
  layout('routes/shell.tsx', [
    ...prefix('products', [
      index('routes/products.tsx'),
      route(':productId', 'routes/product.tsx'),
    ]),
  ]),
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
