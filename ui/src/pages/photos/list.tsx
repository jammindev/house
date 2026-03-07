import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import PhotosPage from '../../../../apps/photos/react/PhotosPage';

type PhotosPageProps = Record<string, never>;

onDomReady(() => {
  mountWithJsonScriptProps<PhotosPageProps>('photos-root', 'photos-props', PhotosPage, { withToaster: true });
});
