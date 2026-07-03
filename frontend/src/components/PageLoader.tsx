import { InlineLoading } from '@carbon/react';

interface PageLoaderProps {
  description?: string;
}

export default function PageLoader({ description = 'Loading...' }: PageLoaderProps) {
  return (
    <div style={{ padding: '2rem' }} aria-busy="true" aria-live="polite">
      <InlineLoading description={description} />
    </div>
  );
}

// Made with Bob
