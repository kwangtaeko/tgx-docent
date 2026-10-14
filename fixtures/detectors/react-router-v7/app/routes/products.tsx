import { PRODUCTS } from '../catalog';

export default function Products() {
  return <ul>{PRODUCTS.map((p) => <li key={p.id}>{p.name}</li>)}</ul>;
}
