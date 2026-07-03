import { InlineNotification, Button } from '@carbon/react';
import { Renew } from '@carbon/icons-react';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onClose?: () => void;
}

export default function ErrorMessage({
  title = 'Error',
  message,
  onRetry,
  onClose,
}: ErrorMessageProps) {
  return (
    <div>
      <InlineNotification
        kind="error"
        title={title}
        subtitle={message}
        lowContrast
        onCloseButtonClick={onClose}
        hideCloseButton={!onClose}
      />
      {onRetry && (
        <Button
          kind="tertiary"
          size="sm"
          renderIcon={Renew}
          onClick={onRetry}
          style={{ marginTop: '0.75rem' }}
          aria-label="Retry loading"
        >
          Retry
        </Button>
      )}
    </div>
  );
}

// Made with Bob
