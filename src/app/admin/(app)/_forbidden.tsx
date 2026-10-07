export function Forbidden({ what = 'this venue' }: { what?: string }) {
  return <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900">Your PIN does not give access to {what}.</p>;
}
