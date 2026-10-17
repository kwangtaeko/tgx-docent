import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findImport, flattenRoutes, parseJsxRoutes, parseRouteConfig, parseRouteObjects, toDocentPath, unreadRoutes } from '../../skills/docent/scripts/src/detectors/route-tree.mjs';

const paths = (nodes) => flattenRoutes(nodes).map((r) => r.path);

test('객체 라우트의 중첩·index·lazy', () => {
  const src = `const r = createBrowserRouter([\n{ path: '/', element: <Layout />, children: [\n  { index: true, element: <Home /> },\n  { path: 'orders', children: [\n    { index: true, element: <Orders /> },\n    { path: ':id', lazy: () => import('./pages/OrderDetail') },\n  ] },\n] },\n]);`;
  const flat = flattenRoutes(parseRouteObjects(src));
  assert.deepEqual(flat.map((r) => [r.path, r.node.line]), [['/', 3], ['/orders', 5], ['/orders/:id', 6]]);
  assert.deepEqual(flat[0].node.component, { name: 'Home' });
  assert.deepEqual(flat[2].node.component, { importPath: './pages/OrderDetail' });
});

test('자식이 있는 라우트는 레이아웃이라 화면이 아니다', () => {
  const src = `[{ path: '/admin', element: <AdminLayout />, children: [{ path: 'users', element: <Users /> }] }]`;
  assert.deepEqual(paths(parseRouteObjects(src)), ['/admin/users']);
});

test('Navigate·redirect만 있는 라우트는 뺀다', () => {
  const src = `[{ path: '/old', element: <Navigate to="/new" /> }, { path: '/x', redirect: '/y' }, { path: '/new', element: <New /> }]`;
  assert.deepEqual(paths(parseRouteObjects(src)), ['/new']);
});

test('리터럴이 아닌 path는 그 라우트와 자식을 건너뛴다', () => {
  const src = "[{ path: ROUTES.a, element: <A /> }, { path: `/${x}`, children: [{ path: 'c', element: <C /> }] }, { path: '/b', element: <B /> }]";
  assert.deepEqual(paths(parseRouteObjects(src)), ['/b']);
});

test('Vue Router 객체(component, 동적 import, 자식)', () => {
  const src = `const routes = [\n  { path: '/', component: Home },\n  { path: '/orders/:id(\\\\d+)', component: () => import('../views/OrderView.vue') },\n  { path: '/me', component: MeLayout, children: [{ path: '', component: Profile }] },\n]`;
  const flat = flattenRoutes(parseRouteObjects(src));
  assert.deepEqual(flat.map((r) => r.path), ['/', '/orders/:id(\\\\d+)', '/me']);
  assert.deepEqual(flat[1].node.component, { importPath: '../views/OrderView.vue' });
});

test('JSX 라우트 중첩과 자기 닫힘', () => {
  const src = `<Routes>\n<Route path="/" element={<Layout />}>\n<Route index element={<Home />} />\n<Route path="users/:id" element={<User a={1} />} />\n</Route>\n<Route path="*" element={<NotFound />} />\n</Routes>`;
  const flat = flattenRoutes(parseJsxRoutes(src));
  assert.deepEqual(flat.map((r) => [r.path, r.node.line]), [['/', 3], ['/users/:id', 4], ['/*', 6]]);
  assert.deepEqual(flat[1].node.component, { name: 'User' });
});

test('JSX Component 속성', () => {
  assert.deepEqual(flattenRoutes(parseJsxRoutes('<Route path="/a" Component={PageA} />'))[0].node.component, { name: 'PageA' });
});

test('React Router v7 routes.ts', () => {
  const src = `export default [\n  index('routes/home.tsx'),\n  route('login', 'routes/login.tsx'),\n  layout('routes/shell.tsx', [\n    ...prefix('products', [\n      index('routes/products.tsx'),\n      route(':id', 'routes/product.tsx'),\n    ]),\n  ]),\n  route('*', 'routes/not-found.tsx'),\n] satisfies RouteConfig;`;
  const flat = flattenRoutes(parseRouteConfig(src));
  assert.deepEqual(flat.map((r) => [r.path, r.node.line, r.node.component.importPath]), [
    ['/', 2, 'routes/home.tsx'],
    ['/login', 3, 'routes/login.tsx'],
    ['/products', 6, 'routes/products.tsx'],
    ['/products/:id', 7, 'routes/product.tsx'],
    ['/*', 10, 'routes/not-found.tsx'],
  ]);
});

test('주석·문자열 안의 라우트 비슷한 글자는 무시하고 CRLF 줄 번호를 센다', () => {
  const src = "// { path: '/fake', element: <F /> }\r\nconst s = \"{ path: '/str' }\";\r\n[{ path: '/real', element: <R /> }]";
  assert.deepEqual(flattenRoutes(parseRouteObjects(src)).map((r) => [r.path, r.node.line]), [['/real', 3]]);
});

test('toDocentPath', () => {
  assert.equal(toDocentPath('/orders/:id'), '/orders/[id]');
  assert.equal(toDocentPath('/p/:id(\\d+)'), '/p/[id]');
  assert.equal(toDocentPath('/docs/:page?'), '/docs/[[...page]]');
  assert.equal(toDocentPath('/files/*'), '/files/[...splat]');
  assert.equal(toDocentPath('/lang?/about'), '/lang/about');
  assert.equal(toDocentPath('/'), '/');
  assert.equal(toDocentPath('/*'), undefined);
  assert.equal(toDocentPath('/:pathMatch(.*)*'), undefined);
});

test('findImport', () => {
  assert.equal(findImport("import Orders from './pages/Orders';", 'Orders'), './pages/Orders');
  assert.equal(findImport("import { A as Orders, B } from '@/x';", 'Orders'), '@/x');
  assert.equal(findImport("import Def, { Orders } from './y';", 'Orders'), './y');
  assert.equal(findImport("const Orders = lazy(() => import('./o'));", 'Orders'), './o');
  assert.equal(findImport("const Orders = defineAsyncComponent(() => import('./o.vue'))", 'Orders'), './o.vue');
  assert.equal(findImport("import Other from './z';", 'Orders'), undefined);
});

test('JSX 글자 속 아포스트로피가 줄 번호와 뒤 라우트를 망가뜨리지 않는다', () => {
  const src = "<h1>Page doesn't exist</h1>\n<p>You haven't any</p>\n<Routes>\n<Route path=\"*\" element={<p>There's nothing here!</p>} />\n<Route path=\"/about\" element={<About />} />\n</Routes>";
  assert.deepEqual(flattenRoutes(parseJsxRoutes(src)).map((r) => [r.path, r.node.line]), [['/*', 4], ['/about', 5]]);
  const cr = src.replace(/\n/g, '\r');
  assert.deepEqual(flattenRoutes(parseJsxRoutes(cr)).map((r) => [r.path, r.node.line]), [['/*', 4], ['/about', 5]]);
});

test('감싸는 요소(인증·Suspense) 안의 실제 화면 컴포넌트를 고른다', () => {
  const src = "[{ path: '/a', element: <RequireAuth><Orders /></RequireAuth> }, { path: '/b', element: <Suspense fallback={<Spinner />}><Lazy /></Suspense> }]";
  assert.deepEqual(flattenRoutes(parseRouteObjects(src)).map((r) => r.node.component), [{ name: 'Orders' }, { name: 'Lazy' }]);
});

test('정규식이 (.*)·(.+)인 단독 파라미터도 Not-found catch-all', () => {
  assert.equal(toDocentPath('/:catchAll(.*)'), undefined);
  assert.equal(toDocentPath('/:all(.+)'), undefined);
  assert.equal(toDocentPath('/docs/:rest(.*)'), '/docs/[...rest]');
});

test('읽지 못한 라우트: 변수 자식, 맨 위 스프레드, routes.ts의 스프레드·변수 자식', () => {
  const childVar = parseRouteObjects("createBrowserRouter([\n{ path:'/admin', element:<L/>, children: adminRoutes },\n{ path:'/a', element:<A/> }])");
  assert.deepEqual(unreadRoutes(childVar), [2]);
  assert.deepEqual(paths(childVar), ['/a']); // 자식을 모르는 레이아웃은 화면이 아니다
  assert.deepEqual(unreadRoutes(parseRouteObjects("createBrowserRouter([\n...publicRoutes,\n{ path:'/a', element:<A/> }])")), [2]);
  assert.deepEqual(unreadRoutes(parseRouteObjects("const routes: RouteObject[] = [\n...x,\n{ path:'/a', element:<A/> }]")), [2]);
  // 라우트 목록이 아닌 배열의 스프레드는 무시
  assert.deepEqual(unreadRoutes(parseRouteObjects("foo([...bar]); const x = [...y]; createBrowserRouter([{ path:'/a', element:<A/> }])")), []);
  const cfg = parseRouteConfig("export default [\nindex('h.tsx'),\n...adminRoutes,\n...prefix('x', [route('y', 'y.tsx')]),\nroute('z', 'z.tsx', zRoutes)] satisfies RouteConfig;");
  assert.deepEqual(unreadRoutes(cfg), [3, 5]);
  assert.deepEqual(paths(cfg), ['/', '/x/y']);
});
