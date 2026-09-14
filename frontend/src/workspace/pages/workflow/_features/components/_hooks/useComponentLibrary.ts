import { useComponentDelete } from './component-library/useComponentDelete';
import { useComponentPackages } from './component-library/useComponentPackages';
import { useComponentVersions } from './component-library/useComponentVersions';
import type { ComponentLibraryOptions } from './component-library/types';
export function useComponentLibrary(o: ComponentLibraryOptions) { return { ...useComponentDelete(o), ...useComponentPackages(o), ...useComponentVersions(o) }; }
export type ComponentLibraryController = ReturnType<typeof useComponentLibrary>;
