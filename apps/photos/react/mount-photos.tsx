import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';

import PhotosNode from './PhotosNode';

type PhotosProps = {
  section?: string;
};

onDomReady(() => {
  mountWithJsonScriptProps<PhotosProps>('photos-root', 'photos-props', PhotosNode, { withToaster: true });
});
