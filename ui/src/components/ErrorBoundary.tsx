import * as React from 'react';
import { withTranslation, type WithTranslation } from 'react-i18next';
import { Button } from '@/design-system/button';

interface ErrorBoundaryProps extends WithTranslation {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundaryBase extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const { t } = this.props;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border border-destructive/30 bg-destructive/10 p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">{t('errors.unexpectedTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('errors.unexpectedDescription')}</p>
        <Button type="button" onClick={this.handleReload}>
          {t('errors.reload')}
        </Button>
      </div>
    );
  }
}

const ErrorBoundary = withTranslation()(ErrorBoundaryBase);
export default ErrorBoundary;
