import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import PhotosPage from './PhotosPage';

type PhotosPageProps = Record<string, never>;

onDomReady(() => {
  mountWithJsonScriptProps<PhotosPageProps>('photos-root', 'photos-props', PhotosPage, { withToaster: true });
});
