export interface FileItem {
  id: string
  name: string
  kind: 'file' | 'folder'
  parentId: string
  size: string
  children: FileItem[]
}
