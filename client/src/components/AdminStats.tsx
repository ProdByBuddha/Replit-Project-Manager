import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, CheckCircle, Clock, FileText } from "lucide-react";
import type { AdminStats as AdminStatsType } from "@/lib/types";

export default function AdminStats() {
  const { data: stats, isLoading } = useQuery<AdminStatsType>({
    queryKey: ["/api/stats/admin"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="flex items-center flex-wrap">
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
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8" data-testid="container-admin-stats">
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center flex-wrap">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mr-4">
              <Users className="text-primary text-xl" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-card-foreground" data-testid="stat-total-families">
                {stats.totalFamilies}
              </h3>
              <p className="text-muted-foreground">Total Families</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center flex-wrap">
            <div className="w-12 h-12 bg-chart-2/20 rounded-lg flex items-center justify-center mr-4">
              <CheckCircle className="text-chart-2 text-xl" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-card-foreground" data-testid="stat-completed-cases">
                {stats.completedCases}
              </h3>
              <p className="text-muted-foreground">Completed Cases</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center flex-wrap">
            <div className="w-12 h-12 bg-chart-3/20 rounded-lg flex items-center justify-center mr-4">
              <Clock className="text-chart-3 text-xl" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-card-foreground" data-testid="stat-pending-reviews">
                {stats.pendingReviews}
              </h3>
              <p className="text-muted-foreground">Pending Reviews</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center flex-wrap">
            <div className="w-12 h-12 bg-chart-1/20 rounded-lg flex items-center justify-center mr-4">
              <FileText className="text-chart-1 text-xl" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-card-foreground" data-testid="stat-total-documents">
                {stats.totalDocuments}
              </h3>
              <p className="text-muted-foreground">Total Documents</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
