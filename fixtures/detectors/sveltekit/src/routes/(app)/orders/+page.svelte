<script>
  let { data } = $props();
</script>

<h1>주문 목록</h1>
{#each data.orders as order}<p>{order.customer}</p>{/each}
