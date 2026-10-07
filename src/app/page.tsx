import { notFound } from 'next/navigation';

// Ruling 5: no umbrella landing page. Each venue lives at its own URL (/senso, /kebab-land).
export default function Root() { notFound(); }
