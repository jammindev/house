import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/design-system/dialog';
import { Button } from '@/design-system/button';

interface Props {
  open: boolean;
  onAccept: () => void;
}

export default function PrivacyNotice({ open, onAccept }: Props) {
  const { t } = useTranslation();
  return (
    <Dialog open={open}>
      <DialogContent
        hideDefaultCloseButton
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        data-testid="agent-privacy-notice"
      >
        <DialogHeader>
          <DialogTitle>{t('agent.privacy.title')}</DialogTitle>
          <DialogDescription>{t('agent.privacy.intro')}</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
          <li>{t('agent.privacy.point_provider')}</li>
          <li>{t('agent.privacy.point_scope')}</li>
          <li>{t('agent.privacy.point_retention')}</li>
        </ul>
        <DialogFooter>
          <Button onClick={onAccept} data-testid="agent-privacy-accept">
            {t('agent.privacy.accept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
