export function OrderNew() {
  return (
    <form>
      <label>
        거래처 <input name="customer" required />
      </label>
      <button type="submit">저장</button>
    </form>
  );
}
