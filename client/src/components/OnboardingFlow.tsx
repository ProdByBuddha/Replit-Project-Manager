import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  FileText, 
  MessageSquare, 
  Users, 
  ArrowRight, 
  ArrowLeft,
  Settings,
  Bell,
  Upload,
  ClipboardCheck,
  GitBranch,
  Crown
} from "lucide-react";

interface OnboardingFlowProps {
  onComplete: () => void;
  userRole: 'family' | 'admin';
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  content: string;
  icon: React.ReactNode;
  features: string[];
}

const FAMILY_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to Family Portal",
    description: "Your secure family case management system",
    content: "Welcome! This portal helps families manage their tasks, documents, and communication with administrators in one secure place.",
    icon: <Users className="h-8 w-8 text-blue-600" />,
    features: [
      "Track your family's progress",
      "Upload and manage documents",
      "Communicate with administrators",
      "Stay updated with notifications"
    ]
  },
  {
    id: "tasks",
    title: "Task Management",
    description: "Complete your family's required tasks",
    content: "Your tasks are organized in order of priority. Some tasks depend on others being completed first - we'll guide you through the right sequence.",
    icon: <ClipboardCheck className="h-8 w-8 text-green-600" />,
    features: [
      "View all assigned tasks",
      "See task dependencies and requirements",
      "Mark tasks as complete when finished",
      "Track overall family progress"
    ]
  },
  {
    id: "documents",
    title: "Document Center",
    description: "Upload and organize important documents",
    content: "Safely store documents related to your case. Documents can be linked to specific tasks or uploaded for general reference.",
    icon: <FileText className="h-8 w-8 text-purple-600" />,
    features: [
      "Upload documents securely",
      "Link documents to specific tasks",
      "Download and view your files",
      "Track document submission status"
    ]
  },
  {
    id: "communication",
    title: "Messages & Updates",
    description: "Stay connected with your case administrators",
    content: "Receive important updates and communicate directly with administrators. You'll get notifications for new messages and task updates.",
    icon: <MessageSquare className="h-8 w-8 text-orange-600" />,
    features: [
      "Receive important announcements",
      "Get task status updates",
      "View message history",
      "Manage notification preferences"
    ]
  },
  {
    id: "getting-started",
    title: "Ready to Begin",
    description: "Start managing your family's case",
    content: "You're all set! Navigate using the sidebar menu to access different sections. Your dashboard shows an overview of progress and recent activity.",
    icon: <CheckCircle className="h-8 w-8 text-green-500" />,
    features: [
      "Use the sidebar navigation",
      "Check your dashboard regularly",
      "Complete tasks in the suggested order",
      "Upload documents as requested"
    ]
  }
];

const ADMIN_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Admin Dashboard",
    description: "Manage families and oversee case progress",
    content: "Welcome to the administrative interface. You have comprehensive tools to manage family cases, set up workflows, and monitor progress across all families.",
    icon: <Crown className="h-8 w-8 text-gold-600" />,
    features: [
      "Monitor all family progress",
      "Manage tasks and dependencies",
      "Review submitted documents",
      "Send announcements and updates"
    ]
  },
  {
    id: "family-management",
    title: "Family Overview",
    description: "Monitor family progress and status",
    content: "View detailed information about each family's case progress, completion rates, and current status. Quickly identify families that need attention.",
    icon: <Users className="h-8 w-8 text-blue-600" />,
    features: [
      "View family completion statistics",
      "Track individual family progress",
      "Identify overdue or blocked tasks",
      "Monitor document submissions"
    ]
  },
  {
    id: "task-dependencies",
    title: "Advanced Task Management", 
    description: "Set up complex task workflows",
    content: "Create sophisticated task dependencies and workflows. Set up sequential, branching, or parallel task structures that automatically unlock as families progress.",
    icon: <GitBranch className="h-8 w-8 text-purple-600" />,
    features: [
      "Create task dependency chains",
      "Set up workflow automation rules",
      "Configure conditional task unlocking",
      "Monitor dependency resolution"
    ]
  },
  {
    id: "workflow-automation",
    title: "Workflow Rules",
    description: "Automate task and notification workflows",
    content: "Set up intelligent automation rules that trigger based on task completion, family progress, or other conditions. Reduce manual work and ensure consistency.",
    icon: <Settings className="h-8 w-8 text-green-600" />,
    features: [
      "Auto-enable tasks when dependencies are met",
      "Send automatic notifications",
      "Trigger actions based on completion",
      "Set up conditional workflows"
    ]
  },
  {
    id: "communication",
    title: "Communication Hub",
    description: "Manage family communications and notifications",
    content: "Send targeted messages to families, manage notification preferences, and track communication history. Keep families informed throughout their journey.",
    icon: <Bell className="h-8 w-8 text-orange-600" />,
    features: [
      "Send family-specific messages",
      "Broadcast important announcements",
      "Track message delivery",
      "Configure notification rules"
    ]
  }
];

export default function OnboardingFlow({ onComplete, userRole }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(true);

  const steps = userRole === 'admin' ? ADMIN_ONBOARDING_STEPS : FAMILY_ONBOARDING_STEPS;
  const totalSteps = steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsOpen(false);
    onComplete();
  };

  const handleSkip = () => {
    setIsOpen(false);
    onComplete();
  };

  if (!isOpen) return null;

  const step = steps[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl" data-testid="onboarding-dialog">
        <DialogHeader className="text-center space-y-4">
          <div className="flex items-center justify-center">
            {step.icon}
          </div>
          <DialogTitle className="text-2xl font-bold" data-testid="onboarding-step-title">
            {step.title}
          </DialogTitle>
          <DialogDescription className="text-lg" data-testid="onboarding-step-description">
            {step.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Step {currentStep + 1} of {totalSteps}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="w-full" data-testid="onboarding-progress" />
          </div>

          {/* Step Content */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {step.icon}
                {step.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300" data-testid="onboarding-step-content">
                {step.content}
              </p>
              
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                  Key Features:
                </h4>
                <div className="grid gap-2">
                  {step.features.map((feature, index) => (
                    <div 
                      key={index} 
                      className="flex items-center gap-2 text-sm"
                      data-testid={`onboarding-feature-${index}`}
                    >
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              onClick={handleSkip}
              data-testid="onboarding-skip-button"
            >
              Skip Tour
            </Button>
          </div>
          
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button 
                variant="outline" 
                onClick={handlePrevious}
                data-testid="onboarding-previous-button"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
            )}
            
            {currentStep < totalSteps - 1 ? (
              <Button 
                onClick={handleNext}
                data-testid="onboarding-next-button"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button 
                onClick={handleComplete}
                data-testid="onboarding-complete-button"
              >
                Get Started
                <CheckCircle className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}