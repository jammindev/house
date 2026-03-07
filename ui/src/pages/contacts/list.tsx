import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import DirectoryPage from '../../../../apps/directory/react/DirectoryPage';

type DirectoryPageProps = {
  initialView?: string;
};

onDomReady(() => {
  mountWithJsonScriptProps<DirectoryPageProps>('directory-root', 'directory-props', DirectoryPage, { withToaster: true });
});
