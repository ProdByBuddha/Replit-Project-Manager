import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Settings } from "lucide-react";

export default function Landing() {
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [familyCode, setFamilyCode] = useState("");
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const { toast } = useToast();

  const handleFamilyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!familyCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter your family access code",
        variant: "destructive",
      });
      return;
    }
    
    // Store family code in session storage for after auth
    sessionStorage.setItem('pendingFamilyCode', familyCode);
    
    // Redirect to Replit Auth
    window.location.href = "/api/login";
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminEmail.trim() || !adminPassword.trim()) {
      toast({
        title: "Error",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }
    
    // Redirect to Replit Auth
    window.location.href = "/api/login";
  };

  if (isAdminLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md">
          <Card className="shadow-xl border-border bg-card">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-accent rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Settings className="text-2xl text-accent-foreground" />
                </div>
                <h1 className="text-2xl font-bold text-card-foreground mb-2">Administrator Portal</h1>
                <p className="text-muted-foreground">System Management Access</p>
              </div>
              
              <form onSubmit={handleAdminLogin} className="space-y-6">
                <div>
                  <Label htmlFor="adminEmail" className="text-card-foreground">Admin Email</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="mt-2 bg-input border-border text-foreground placeholder-muted-foreground"
                    data-testid="input-admin-email"
                  />
                </div>
                
                <div>
                  <Label htmlFor="adminPassword" className="text-card-foreground">Admin Password</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="mt-2 bg-input border-border text-foreground placeholder-muted-foreground"
                    data-testid="input-admin-password"
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-medium"
                  data-testid="button-admin-login"
                >
                  Access Admin Portal
                </Button>
              </form>
              
              <div className="mt-6 text-center">
                <button 
                  onClick={() => setIsAdminLogin(false)} 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  data-testid="link-family-login"
                >
                  Back to Family Login
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-border bg-card">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                <Shield className="text-2xl text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-card-foreground mb-2">Family Portal</h1>
              <p className="text-muted-foreground">National Status Correction System</p>
            </div>
            
            <form onSubmit={handleFamilyLogin} className="space-y-6">
              <div>
                <Label htmlFor="familyCode" className="text-card-foreground">Family Access Code</Label>
                <Input
                  id="familyCode"
                  type="text"
                  value={familyCode}
                  onChange={(e) => setFamilyCode(e.target.value)}
                  placeholder="Enter your family code"
                  className="mt-2 bg-input border-border text-foreground placeholder-muted-foreground"
                  data-testid="input-family-code"
                />
              </div>
              
              <div>
                <Label htmlFor="password" className="text-card-foreground">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="mt-2 bg-input border-border text-foreground placeholder-muted-foreground"
                  data-testid="input-password"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                data-testid="button-family-login"
              >
                Access Family Portal
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <button 
                onClick={() => setIsAdminLogin(true)} 
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                data-testid="link-admin-access"
              >
                Administrator Access
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
