export default function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      {label}: {value}
    </div>
  );
}
