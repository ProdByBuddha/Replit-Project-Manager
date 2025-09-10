import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MessageSquare, Eye } from "lucide-react";
import FamilyDetailModal from "./FamilyDetailModal";
import MessageModal from "./MessageModal";
import type { FamilyWithStats } from "@/lib/types";
import type { Family } from "@shared/schema";

export default function FamilyManagement() {
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedFamilyForMessage, setSelectedFamilyForMessage] = useState<Family | null>(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

  const { data: families = [], isLoading } = useQuery<FamilyWithStats[]>({
    queryKey: ["/api/families"],
    retry: false,
  });

  const getStatusColor = (progress: number) => {
    if (progress === 100) return "bg-chart-2/20 text-chart-2";
    if (progress > 0) return "bg-chart-3/20 text-chart-3";
    return "bg-muted text-muted-foreground";
  };

  const getStatusText = (progress: number) => {
    if (progress === 100) return "Completed";
    if (progress > 0) return "In Progress";
    return "Not Started";
  };

  const handleViewFamily = (familyId: string) => {
    setSelectedFamilyId(familyId);
    setIsDetailModalOpen(true);
  };

  const handleMessageFamily = (family: FamilyWithStats) => {
    setSelectedFamilyForMessage({
      id: family.id,
      name: family.name,
      familyCode: family.familyCode,
      createdAt: family.createdAt,
      updatedAt: family.updatedAt,
    });
    setIsMessageModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedFamilyId(null);
  };

  const handleCloseMessageModal = () => {
    setIsMessageModalOpen(false);
    setSelectedFamilyForMessage(null);
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-card-foreground">Family Management</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="animate-pulse">
            <div className="space-y-4 p-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-muted rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/4" />
                    <div className="h-3 bg-muted rounded w-1/6" />
                  </div>
                  <div className="w-24 h-2 bg-muted rounded" />
                  <div className="w-20 h-6 bg-muted rounded" />
                  <div className="w-16 h-8 bg-muted rounded" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-card-foreground" data-testid="text-family-management-title">
          Family Management
        </CardTitle>
        <p className="text-muted-foreground mt-1">Monitor progress and manage family cases</p>
      </CardHeader>
      
      <CardContent className="p-0">
        {families.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>No families registered yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="table-families">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Family
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Last Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {families.map((family: any) => (
                  <tr key={family.id} className="hover:bg-muted/20" data-testid={`family-row-${family.id}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center mr-3">
                          <span className="text-primary font-medium" data-testid={`family-initial-${family.id}`}>
                            {family.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-card-foreground" data-testid={`family-name-${family.id}`}>
                            {family.name}
                          </div>
                          <div className="text-sm text-muted-foreground" data-testid={`family-code-${family.id}`}>
                            {family.familyCode}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-full">
                        <Progress 
                          value={family.stats?.progress || 0} 
                          className="w-24 h-2" 
                          data-testid={`family-progress-${family.id}`}
                        />
                        <span className="text-sm text-muted-foreground mt-1" data-testid={`family-progress-text-${family.id}`}>
                          {family.stats?.progress || 0}% Complete
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge 
                        className={getStatusColor(family.stats?.progress || 0)}
                        data-testid={`family-status-${family.id}`}
                      >
                        {getStatusText(family.stats?.progress || 0)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground" data-testid={`family-last-activity-${family.id}`}>
                      {new Date(family.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewFamily(family.id)}
                          className="text-primary hover:text-primary/80"
                          data-testid={`button-view-family-${family.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMessageFamily(family)}
                          className="text-accent hover:text-accent/80"
                          data-testid={`button-message-family-${family.id}`}
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Message
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    
      {/* Modals */}
      <FamilyDetailModal
        familyId={selectedFamilyId}
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
      />
      
      <MessageModal
        family={selectedFamilyForMessage}
        isOpen={isMessageModalOpen}
        onClose={handleCloseMessageModal}
      />
    </Card>
  );
}
