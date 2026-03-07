import * as React from 'react';

function matchesDialogValue(dialogValue: string, paramName: string) {
  if (typeof window === 'undefined') return false;
  return new URL(window.location.href).searchParams.get(paramName) === dialogValue;
}

function updateDialogUrl(dialogValue: string, isOpen: boolean, paramName: string) {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const currentValue = url.searchParams.get(paramName);

  if (isOpen) {
    url.searchParams.set(paramName, dialogValue);
  } else if (currentValue === dialogValue) {
    url.searchParams.delete(paramName);
  }

  const qs = url.searchParams.toString();
  window.history.replaceState({}, '', qs ? `${url.pathname}?${qs}` : url.pathname);
}

export function useUrlDialog(dialogValue: string, paramName = 'dialog') {
  const [open, setOpen] = React.useState(() => matchesDialogValue(dialogValue, paramName));

  React.useEffect(() => {
    const syncFromUrl = () => {
      setOpen(matchesDialogValue(dialogValue, paramName));
    };

    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, [dialogValue, paramName]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      updateDialogUrl(dialogValue, nextOpen, paramName);
    },
    [dialogValue, paramName],
  );

  return [open, handleOpenChange] as const;
}