import { Icon } from '../_ui/icons';
import { panel } from '../_ui/look';

// Access refused: an error, so in red (red marks Delete and errors only; the admin-wide clean-up, 2026-11-06).
export function Forbidden({ what = 'this venue' }: { what?: string }) {
  return (
    <p role="alert" className={`${panel} flex items-start gap-3 px-4 py-3 text-base text-danger`}>
      <Icon name="shield" className="mt-0.5 h-5 w-5" /><span>Your PIN does not give access to {what}.</span>
    </p>
  );
}
