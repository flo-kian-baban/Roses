import type { Bi as BiText } from '@/lib/types';

// Renders bilingual text. Both languages are in the HTML; CSS shows the active one.
// Without Persian, the English span has no lang attribute and stays visible in both modes.
export function Bi({ text, as: Tag = 'span', className }: { text: BiText | null | undefined; as?: 'span' | 'h1' | 'h2' | 'h3' | 'p' | 'div'; className?: string }) {
  if (!text || (!text.en && !text.fa)) return null;
  if (!text.fa) return <Tag className={className}>{text.en}</Tag>;
  if (!text.en) return <Tag className={className} lang="fa" dir="rtl">{text.fa}</Tag>;
  return (
    <Tag className={className}>
      <span lang="en">{text.en}</span>
      <span lang="fa" dir="rtl">{text.fa}</span>
    </Tag>
  );
}
