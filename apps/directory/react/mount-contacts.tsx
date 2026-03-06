import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import DirectoryPage from './DirectoryPage';

type DirectoryPageProps = {
  householdId?: string | null;
  initialView?: string;
};

onDomReady(() => {
  mountWithJsonScriptProps<DirectoryPageProps>('directory-root', 'directory-props', DirectoryPage, { withToaster: true });
});
