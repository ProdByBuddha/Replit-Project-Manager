import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Upload, FileText, Download, Calendar } from "lucide-react";
import type { UploadResult } from "@uppy/core";
import type { DocumentWithUploader } from "@/lib/types";

interface DocumentCenterProps {
  familyId?: string;
}

export default function DocumentCenter({ familyId }: DocumentCenterProps) {
  const { toast } = useToast();

  const { data: documents = [], isLoading, refetch } = useQuery<DocumentWithUploader[]>({
    queryKey: ["/api/documents"],
    enabled: !!familyId,
    retry: false,
  });

  const handleGetUploadParameters = async () => {
    try {
      const response = await fetch("/api/objects/upload", {
        method: "POST",
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }
      
      const data = await response.json();
      return {
        method: "PUT" as const,
        url: data.uploadURL,
      };
    } catch (error) {
      console.error("Error getting upload parameters:", error);
      toast({
        title: "Error",
        description: "Failed to prepare file upload",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    try {
      if (result.successful && result.successful.length > 0) {
        const file = result.successful[0];
        
        // Create document record
        const response = await fetch("/api/documents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            fileName: file.name,
            originalFileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/octet-stream",
            uploadURL: file.uploadURL,
            familyId,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save document record");
        }

        toast({
          title: "Success",
          description: "Document uploaded successfully",
        });
        
        // Refresh document list
        refetch();
      }
    } catch (error) {
      console.error("Error completing upload:", error);
      
      if (error instanceof Error && /^401: .*Unauthorized/.test(error.message)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to complete document upload",
        variant: "destructive",
      });
    }
  };

  const handleDownload = (document: any) => {
    // Open document in new tab for download
    window.open(document.objectPath, "_blank");
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("pdf")) {
      return <FileText className="w-5 h-5 text-red-500" />;
    } else if (mimeType.includes("word") || mimeType.includes("document")) {
      return <FileText className="w-5 h-5 text-blue-500" />;
    }
    return <FileText className="w-5 h-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-card-foreground">Document Center</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <div className="w-12 h-12 bg-muted rounded-lg mx-auto mb-3" />
              <div className="h-4 bg-muted rounded w-3/4 mx-auto mb-1" />
              <div className="h-3 bg-muted rounded w-1/2 mx-auto" />
            </div>
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
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Upload className="text-primary text-xl" />
              </div>
              <p className="text-card-foreground font-medium mb-1">Drop files here or click to browse</p>
              <p className="text-sm text-muted-foreground">PDF, DOC, DOCX up to 10MB</p>
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
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors"
                  data-testid={`document-item-${document.id}`}
                >
                  <div className="flex items-center flex-1">
                    {getFileIcon(document.mimeType)}
                    <div className="ml-3 flex-1 min-w-0">
                      <p className="text-sm font-medium text-card-foreground truncate" data-testid={`text-document-name-${document.id}`}>
                        {document.originalFileName}
                      </p>
                      <div className="flex items-center text-xs text-muted-foreground space-x-3">
                        <span data-testid={`text-document-size-${document.id}`}>
                          {formatFileSize(document.fileSize)}
                        </span>
                        <span className="flex items-center" data-testid={`text-document-date-${document.id}`}>
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(document.createdAt).toLocaleDateString()}
                        </span>
                        <span data-testid={`text-document-uploader-${document.id}`}>
                          by {document.uploader.firstName || document.uploader.email}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(document)}
                    className="text-primary hover:text-primary/80 hover:bg-primary/10"
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
