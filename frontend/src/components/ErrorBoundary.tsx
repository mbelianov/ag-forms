import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Tile, Button } from '@carbon/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', maxWidth: '600px', margin: '4rem auto' }}>
          <Tile>
            <h2 style={{ marginBottom: '1rem' }}>Something went wrong</h2>
            <p style={{ color: '#525252', marginBottom: '1.5rem' }}>
              An unexpected error occurred. Please reload the page to continue.
            </p>
            <Button onClick={this.handleReload}>Reload Page</Button>
          </Tile>
        </div>
      );
    }
    return this.props.children;
  }
}

// Made with Bob
