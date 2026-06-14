export interface SelectedPdfFile {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  selectedPages: number[]; // 1-based indices of pages to include
  file: File;
  rangeMode: 'all' | 'custom';
  customRangeStr: string; // Range string, e.g. "1-3, 5"
}

export interface MergeHistoryItem {
  id: string;
  timestamp: string;
  fileName: string;
  filesMerged: number;
  totalPages: number;
  fileSize: number;
}

export type EditorElementType = 'text' | 'arrow' | 'balloon';

export interface BaseEditorElement {
  id: string;
  pageNumber: number; // 1-based page index
  type: EditorElementType;
  x: number; // units: original PDF points (top-left)
  y: number; // units: original PDF points (top-left)
  color: string; // hex color codes, e.g., #ef4444
}

export interface TextEditorElement extends BaseEditorElement {
  type: 'text';
  text: string;
  fontSize: number;
}

export interface ArrowEditorElement extends BaseEditorElement {
  type: 'arrow';
  x2: number; // end point X
  y2: number; // end point Y
  width: number;
}

export interface BalloonEditorElement extends BaseEditorElement {
  type: 'balloon';
  number: string; // editable text inside
  angle: number; // rotation in degrees around (x, y) tip anchor
  scale: number; // item size multiplier
  outlineOnly?: boolean; // toggle to draw as outline only (white filled with border color matching theme)
}

export type EditorElement = TextEditorElement | ArrowEditorElement | BalloonEditorElement;
