import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, FileText, TrendingUp } from "lucide-react";

interface FamilyStatsProps {
  familyId?: string;
  stats?: {
    completed: number;
    pending: number;
    documents: number;
    progress: number;
  };
  isLoading: boolean;
}

export default function FamilyStats({ stats, isLoading }: FamilyStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-muted rounded-lg mr-4" />
                  <div>
                    <div className="h-8 bg-muted rounded w-16 mb-2" />
                    <div className="h-4 bg-muted rounded w-24" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8" data-testid="container-family-stats">
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mr-4">
              <CheckCircle className="text-primary text-xl" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-card-foreground" data-testid="stat-completed-tasks">
                {stats.completed}
              </h3>
              <p className="text-muted-foreground">Completed Tasks</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-chart-3/20 rounded-lg flex items-center justify-center mr-4">
              <Clock className="text-chart-3 text-xl" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-card-foreground" data-testid="stat-pending-tasks">
                {stats.pending}
              </h3>
              <p className="text-muted-foreground">Pending Tasks</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-chart-1/20 rounded-lg flex items-center justify-center mr-4">
              <FileText className="text-chart-1 text-xl" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-card-foreground" data-testid="stat-documents">
                {stats.documents}
              </h3>
              <p className="text-muted-foreground">Documents</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-chart-2/20 rounded-lg flex items-center justify-center mr-4">
              <TrendingUp className="text-chart-2 text-xl" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-card-foreground" data-testid="stat-progress">
                {stats.progress}%
              </h3>
              <p className="text-muted-foreground">Overall Progress</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
