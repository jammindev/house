import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import PhotosPage from './PhotosPage';

type PhotosPageProps = {
  householdId?: string | null;
};

onDomReady(() => {
  mountWithJsonScriptProps<PhotosPageProps>('photos-root', 'photos-props', PhotosPage, { withToaster: true });
});
