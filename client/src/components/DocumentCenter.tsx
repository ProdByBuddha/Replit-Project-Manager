"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Download, FileIcon, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface Document {
  id: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
}

interface DocumentCenterProps {
  familyId?: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  error?: string;
}

export default function DocumentCenter({ familyId }: DocumentCenterProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  // Fetch documents
  const { data: documents = [], isLoading, refetch } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) {
      return <FileIcon className="w-5 h-5 text-red-500" />;
    }
    if (mimeType.includes('word') || mimeType.includes('document')) {
      return <FileIcon className="w-5 h-5 text-blue-500" />;
    }
    if (mimeType.includes('image')) {
      return <FileIcon className="w-5 h-5 text-green-500" />;
    }
    return <FileText className="w-5 h-5 text-gray-500" />;
  };

  const handleGetUploadParameters = async () => {
    const response = await fetch('/api/objects/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Failed to get upload URL');
    }

    const data = await response.json();
    // Transform response to match ObjectUploader expected format
    return {
      method: 'PUT' as const,
      url: data.uploadURL,
    };
  };

  const validateFiles = (files: FileList | File[]): { valid: File[], errors: string[] } => {
    const fileArray = Array.from(files);
    const errors: string[] = [];
    const valid: File[] = [];

    // Check total number of files
    if (fileArray.length + uploadingFiles.length > 5) {
      errors.push(`Cannot upload more than 5 files total. Currently ${uploadingFiles.length} uploading.`);
      return { valid, errors };
    }

    for (const file of fileArray) {
      // Check file size (10MB)
      if (file.size > 10485760) {
        errors.push(`${file.name} is too large (${formatFileSize(file.size)}). Maximum size is 10MB.`);
        continue;
      }

      // Check file type (basic check)
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
      const hasValidType = allowedTypes.includes(file.type) || allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      
      if (!hasValidType) {
        errors.push(`${file.name} is not a supported file type. Please upload PDF, DOC, DOCX, or TXT files.`);
        continue;
      }

      valid.push(file);
    }

    return { valid, errors };
  };

  const uploadFile = async (file: File) => {
    try {
      // Get upload parameters
      const uploadParams = await handleGetUploadParameters();
      
      // Update progress
      setUploadingFiles(prev => 
        prev.map(f => f.file === file ? { ...f, progress: 10 } : f)
      );

      // Upload to S3
      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 90 + 10; // 10-100%
            setUploadingFiles(prev => 
              prev.map(f => f.file === file ? { ...f, progress } : f)
            );
          }
        });

        xhr.addEventListener('load', async () => {
          if (xhr.status === 200 || xhr.status === 204) {
            // Complete progress
            setUploadingFiles(prev => 
              prev.map(f => f.file === file ? { ...f, progress: 100 } : f)
            );

            // Save document metadata
            try {
              const response = await fetch('/api/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fileName: file.name,
                  originalFileName: file.name,
                  fileSize: file.size,
                  mimeType: file.type,
                  uploadURL: uploadParams.url.split('?')[0], // Remove query params
                  familyTaskId: null,
                }),
              });
              
              if (!response.ok) {
                throw new Error('Failed to save document metadata');
              }

              resolve({ success: true, file });
            } catch (error) {
              console.error('Error saving document metadata:', error);
              setUploadingFiles(prev => 
                prev.map(f => f.file === file ? { ...f, error: 'Failed to save metadata' } : f)
              );
              reject(error);
            }
          } else {
            setUploadingFiles(prev => 
              prev.map(f => f.file === file ? { ...f, error: 'Upload failed' } : f)
            );
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          setUploadingFiles(prev => 
            prev.map(f => f.file === file ? { ...f, error: 'Upload failed' } : f)
          );
          reject(new Error('Upload failed'));
        });

        xhr.open(uploadParams.method, uploadParams.url);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });
    } catch (error) {
      console.error('Upload error:', error);
      setUploadingFiles(prev => 
        prev.map(f => f.file === file ? { ...f, error: 'Upload failed' } : f)
      );
      throw error;
    }
  };

  const handleFileSelection = async (files: FileList | File[]) => {
    const { valid, errors } = validateFiles(files);
    
    if (errors.length > 0) {
      toast({
        title: "File Validation Error",
        description: errors.join('\n'),
        variant: "destructive",
      });
      return;
    }

    if (valid.length === 0) return;

    // Add files to uploading state
    const newUploadingFiles = valid.map(file => ({ file, progress: 0 }));
    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Upload files concurrently
    const uploadPromises = valid.map(uploadFile);
    
    try {
      await Promise.all(uploadPromises);
      
      // Remove completed uploads
      setUploadingFiles(prev => prev.filter(f => !valid.includes(f.file)));
      
      // Refresh documents list
      refetch();
      
      toast({
        title: "Success",
        description: `${valid.length} file(s) uploaded successfully!`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Error",
        description: "Some files failed to upload. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelection(files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelection(files);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const removeUploadingFile = (file: File) => {
    setUploadingFiles(prev => prev.filter(f => f.file !== file));
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-card-foreground" data-testid="text-document-center-title">
          Document Center
        </CardTitle>
        <p className="text-muted-foreground mt-1">Upload and manage your documents</p>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* File Upload Area */}
        <div className="mb-6" data-testid="container-upload-area">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={handleFileInputChange}
            className="hidden"
            data-testid="input-file-upload"
          />
          
          {/* Custom drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
            className={`cursor-pointer transition-colors ${
              isDragOver ? 'border-primary bg-primary/5' : ''
            }`}
          >
            {/* Mobile optimized layout */}
            <div className="block sm:hidden">
              <div className={`flex items-center justify-center gap-3 rounded-lg border-2 border-dashed p-4 text-center hover:border-primary/50 transition-colors cursor-pointer min-h-16 ${
                isDragOver ? 'border-primary bg-primary/5' : 'border-border'
              }`}>
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center pointer-events-none">
                  <Upload className="text-primary text-base" />
                </div>
                <span className="text-card-foreground font-medium text-sm pointer-events-none">
                  {uploadingFiles.length > 0 ? 'Uploading...' : 'Upload Files'}
                </span>
              </div>
            </div>
            
            {/* Desktop layout */}
            <div className={`hidden sm:flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center hover:border-primary/50 transition-colors cursor-pointer min-h-40 overflow-hidden ${
              isDragOver ? 'border-primary bg-primary/5' : 'border-border'
            }`}>
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-3 pointer-events-none">
                <Upload className="text-primary text-xl" />
              </div>
              <p className="text-card-foreground font-medium mb-1 pointer-events-none">
                {uploadingFiles.length > 0 ? 'Files uploading...' : 'Drop files here or click to browse'}
              </p>
              <p className="text-sm text-muted-foreground pointer-events-none">PDF, DOC, DOCX up to 10MB</p>
            </div>
          </div>

          {/* Upload Progress */}
          {uploadingFiles.length > 0 && (
            <div className="mt-4 space-y-2" data-testid="container-upload-progress">
              {uploadingFiles.map((uploadingFile, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                  data-testid={`upload-progress-${index}`}
                >
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-card-foreground truncate" data-testid={`text-uploading-file-${index}`}>
                      {uploadingFile.file.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress 
                        value={uploadingFile.progress} 
                        className="flex-1 h-1.5" 
                        data-testid={`progress-upload-${index}`}
                      />
                      <span className="text-xs text-muted-foreground" data-testid={`text-progress-${index}`}>
                        {Math.round(uploadingFile.progress)}%
                      </span>
                    </div>
                    {uploadingFile.error && (
                      <p className="text-xs text-destructive mt-1" data-testid={`text-error-${index}`}>
                        {uploadingFile.error}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeUploadingFile(uploadingFile.file);
                    }}
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    data-testid={`button-cancel-upload-${index}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Recent Documents */}
        <div className="space-y-3">
          <h3 className="font-medium text-card-foreground" data-testid="text-recent-documents-title">
            Recent Documents
          </h3>
          
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-documents">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No documents uploaded yet</p>
              <p className="text-sm">Upload your first document to get started</p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="container-documents-list">
              {documents.map((document: any) => (
                <div
                  key={document.id}
                  className="grid grid-cols-[auto,1fr,auto] items-center gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors"
                  data-testid={`document-item-${document.id}`}
                >
                  {getFileIcon(document.mimeType)}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-card-foreground truncate break-all" data-testid={`text-document-name-${document.id}`}>
                      {document.originalFileName}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span data-testid={`text-document-size-${document.id}`}>
                        {formatFileSize(document.fileSize)}
                      </span>
                      <span data-testid={`text-document-date-${document.id}`}>
                        {new Date(document.uploadedAt).toLocaleDateString()}
                      </span>
                      <span data-testid={`text-document-uploader-${document.id}`}>
                        by {document.uploadedBy}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary hover:text-primary/80"
                    data-testid={`button-download-${document.id}`}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}