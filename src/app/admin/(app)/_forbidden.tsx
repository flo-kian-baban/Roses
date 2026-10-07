import { Icon } from '../_ui/icons';

export function Forbidden({ what = 'this venue' }: { what?: string }) {
  return (
    <p role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-900">
      <Icon name="shield" className="mt-0.5 h-5 w-5 text-red-600" /><span>Your PIN does not give access to {what}.</span>
    </p>
  );
}
