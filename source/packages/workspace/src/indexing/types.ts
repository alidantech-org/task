export type WorkspaceContext = { root: string };
export type DocumentMetadata = {
  id: string;
  name: string;
  type: string;
  tags: readonly string[];
  status?: string;
  dates: Readonly<Record<string, string>>;
};
export type DocumentSummary = {
  path: string;
  metadata: DocumentMetadata;
  classification: "task-record" | "document";
  size: number;
  modifiedAt: number;
  contentHash: string;
  changeTime: number;
  fileId: string;
};
export type ValidationDiagnostic = { path: string; message: string };
export type WorkspaceIndex = {
  root: string;
  documents: ReadonlyMap<string, DocumentSummary>;
  diagnostics: readonly ValidationDiagnostic[];
  scannedAt: number;
  fingerprints: ReadonlyMap<string, string>;
};
