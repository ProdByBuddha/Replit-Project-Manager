"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Download, FileIcon } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";

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

export default function DocumentCenter({ familyId }: DocumentCenterProps) {
  const { toast } = useToast();

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

  const handleUploadComplete = async (result: any) => {
    console.log('Upload complete:', result);
    
    // Save document metadata to database
    if (result.successful && result.successful.length > 0) {
      for (const file of result.successful) {
        try {
          // Extract file information
          const uploadURL = file.uploadURL || file.xhrUpload?.endpoint;
          const fileName = file.name;
          const fileSize = file.size;
          const mimeType = file.type;
          
          // Save document metadata
          const response = await fetch('/api/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName,
              originalFileName: fileName,
              fileSize,
              mimeType,
              uploadURL,
              familyTaskId: null, // Optional: can be linked to a task
            }),
          });
          
          if (!response.ok) {
            console.error('Failed to save document metadata');
            toast({
              title: "Warning",
              description: "File uploaded but metadata not saved",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error('Error saving document metadata:', error);
        }
      }
    }
    
    // Refresh the documents list
    refetch();
    
    toast({
      title: "Success",
      description: "Document uploaded successfully!",
    });
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
          <ObjectUploader
            maxNumberOfFiles={5}
            maxFileSize={10485760} // 10MB
            onGetUploadParameters={handleGetUploadParameters}
            onComplete={handleUploadComplete}
            buttonClassName="w-full"
          >
            {/* Mobile optimized layout */}
            <div className="block sm:hidden">
              <div className="flex items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border p-4 text-center hover:border-primary/50 transition-colors cursor-pointer min-h-16">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center pointer-events-none">
                  <Upload className="text-primary text-base" />
                </div>
                <span className="text-card-foreground font-medium text-sm pointer-events-none">Upload Files</span>
              </div>
            </div>
            
            {/* Desktop layout */}
            <div className="hidden sm:flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-primary/50 transition-colors cursor-pointer min-h-40 overflow-hidden">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-3 pointer-events-none">
                <Upload className="text-primary text-xl" />
              </div>
              <p className="text-card-foreground font-medium mb-1 pointer-events-none">Drop files here or click to browse</p>
              <p className="text-sm text-muted-foreground pointer-events-none">PDF, DOC, DOCX up to 10MB</p>
            </div>
          </ObjectUploader>
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