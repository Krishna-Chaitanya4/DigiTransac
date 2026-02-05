// Label types
export interface Label {
  id: string;
  name: string;
  parentId: string | null;
  type: 'Folder' | 'Category';
  icon: string | null;
  color: string | null;
  order: number;
  isSystem: boolean;
  createdAt: string;
}

export interface LabelTree extends Label {
  children: LabelTree[];
}

export interface CreateLabelRequest {
  name: string;
  parentId?: string | null;
  type: 'Folder' | 'Category';
  icon?: string | null;
  color?: string | null;
}

export interface UpdateLabelRequest {
  name: string;
  parentId?: string | null;
  icon?: string | null;
  color?: string | null;
  order?: number;
}

// Tag types
export interface Tag {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface CreateTagRequest {
  name: string;
  color?: string | null;
}

export interface UpdateTagRequest {
  name: string;
  color?: string | null;
}
