import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import PortalLayout from "@/components/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, 
  Filter, 
  CheckCircle, 
  Clock, 
  FileText, 
  Upload, 
  Eye, 
  Play, 
  Shield, 
  CreditCard, 
  Globe, 
  Users, 
  ScrollText,
  BookOpen,
  Settings,
  FileCheck,
  Scale,
  UserCheck,
  Gavel
} from "lucide-react";
import type { StatusCorrectionItem, StatusCorrectionSection, StatusProgress } from "@/lib/types";
import type { Document } from "@shared/schema";

// Status Correction Checklist Data based on actual PDF document
const statusCorrectionData: StatusCorrectionSection[] = [
  {
    id: "foundational",
    title: "Foundational Legal Instruments",
    description: "Core documents for reclaiming ownership over your legal identity and establishing private sovereignty",
    items: [
      {
        id: "secured-party-creditor",
        title: "Secured Party Creditor (SPC) Paperwork",
        description: "Reclaiming title over the ALL CAPS NAME through UCC-1 and Trust Contracting",
        purpose: "The Secured Party Creditor process is the foundational act of reclaiming ownership over your ALL CAPS NAME—the corporate trust created by the state at birth. This legal fiction, also known as your Strawman, was issued without your consent and is presumed to be under U.S. jurisdiction. By filing a UCC Financing Statement (UCC-1), you publicly declare that you are the creditor, not the debtor, over this artificial entity.",
        whatItDoes: [
          "Re-establishes control over your legal identity, reversing the presumption that you are surety for a corporate entity",
          "Prevents the State from administering your estate without consent",
          "Notifies all public entities that your property (real, personal, intellectual) is privately held and not subject to commercial lien",
          "Serves as foundation for other sovereign processes, such as trust formation, asset protection, and exemption claims"
        ],
        howToUse: [
          "When disputing debts or court actions, reference your UCC-1 as proof that you are the secured party and creditor, not the subject of the account",
          "Attach it to affidavits, trust documents, or notices to law enforcement",
          "Present as evidence in administrative proceedings, showing prior claim to all derivatives of your name"
        ],
        whoSigns: [
          "You as the living man/woman (Creditor)",
          "Notarization recommended for authentication",
          "Witnesses for additional evidentiary weight"
        ],
        whereToFile: [
          "Secretary of State UCC Filing section (online)",
          "Secretary of the Treasury, Washington D.C. (certified mail)",
          "Optional: County Recorder for local public notice",
          "Keep originals in family trust binder"
        ],
        stepByStepInstructions: [
          "Draft a Security Agreement where the living you (Creditor) grants use of your legal name to the Strawman (Debtor)",
          "Include an Indemnity Clause that removes state liability over your estate",
          "Go to your state's Secretary of State website, navigate to the UCC Filing section, and create an online account",
          "Enter the Debtor's name as your FULL LEGAL NAME IN ALL CAPS",
          "Enter the Secured Party as your name in proper case (e.g., John-David: Smith)",
          "In the collateral section, describe your estate and legal name as secured property",
          "Send notarized copy via certified mail to Secretary of the Treasury, 1500 Pennsylvania Avenue NW, Washington, D.C. 20220",
          "Keep return receipts for your records and file copies in your family trust binder"
        ],
        draftingChecklist: [
          "UCC-1 Financing Statement",
          "Security Agreement between you and your corporate entity", 
          "Hold Harmless Indemnity Agreement",
          "Affidavit of Truth (optional but recommended)",
          "Cover Letter to Secretary of State",
          "UCC Addendum or UCC-3 Amendment (optional)",
          "Treasury Copy preparation"
        ],
        outputs: [
          "Filed UCC-1 Financing Statement with stamp",
          "Security Agreement (notarized)",
          "Certified mail receipts",
          "Digital and physical file copies",
          "County recording (if applicable)"
        ],
        category: 'foundational',
        priority: 'high',
        estimatedTime: "4-6 hours",
        requiredDocuments: ["Birth certificate", "Legal name documentation", "Notary access"],
        isOptional: false,
        status: 'not_started'
      },
      {
        id: "private-banking-trust",
        title: "Private Banking Trust Formation",
        description: "Establishing an Ecclesiastical or Family Trust to Own Assets and Control Contracts",
        purpose: "A Private Banking Trust is a foundational legal instrument that transfers ownership of all your assets—property, intellectual property, currency, business interests, vehicles, accounts—into a private, irrevocable trust governed by natural law or ecclesiastical jurisdiction. This prevents the State, creditors, or agencies from claiming authority over your person or property.",
        whatItDoes: [
          "Removes all assets from your personal legal name, ensuring they cannot be garnished, seized, or taxed under public law",
          "Legally operates outside statutory jurisdiction, protecting you from lawsuits, levies, and forced compliance",
          "Allows you to lawfully say 'I own nothing but control everything,' just like governments and banks",
          "Enables creation of a private family economy, where all assets, policies, businesses, and properties are held within the trust body—not in your name"
        ],
        howToUse: [
          "When entering contracts, sign as trustee of your trust, not in your personal capacity (e.g., 'Jane: Doe, Trustee of The Elohim Sovereign Family Trust')",
          "Store all UCC filings, passport documents, identification, and ministry items inside the trust to place them outside of statutory jurisdiction",
          "Write private contracts, issue 0% interest loans, or set up family IUL insurance structures through the trust"
        ],
        whoSigns: [
          "Settlor/Grantor of the trust",
          "Initial trustee(s)",
          "Successor trustee appointments",
          "Notarization of key documents"
        ],
        whereToFile: [
          "Private records only - DO NOT register with the State",
          "Store in secure family trust binder",
          "Digital backups in encrypted storage",
          "Certificate of Trust for banking (not full Declaration)"
        ],
        stepByStepInstructions: [
          "Choose a private, irrevocable, discretionary trust name (e.g., 'The Elohim Sovereign Family Trust')",
          "Draft formal Declaration of Trust stating the trust's private, ecclesiastical, or natural law jurisdiction",
          "Include Articles that detail purpose, trustee powers, asset management, and irrevocability",
          "Add Schedule A listing your initial assets: real estate, intellectual property, business licenses, copyrights, etc.",
          "Assign at least one trustee (can be yourself) and one successor trustee",
          "Sign all pages with blue ink and notarize Declaration and Trustee appointments",
          "Store securely with original signatures in private record book",
          "Optional: Use EIN to open non-personal trust account at private or ecclesiastically friendly bank"
        ],
        draftingChecklist: [
          "Declaration of Trust (or Trust Indenture)",
          "Trust Articles or Spiritual Constitution", 
          "Appointment of Trustee(s) and Successor(s)",
          "Schedule A (Initial Assets Assigned to the Trust)",
          "Certificate of Trust",
          "Bylaws (Optional for internal governance)",
          "Trust Seal (Optional but recommended)"
        ],
        outputs: [
          "Complete Trust Package (Declaration, Articles, Schedule A)",
          "Signed and notarized Trustee appointments",
          "Certificate of Trust for banking",
          "Trust seal and official documentation",
          "Asset transfer documents"
        ],
        category: 'foundational',
        priority: 'high',
        estimatedTime: "6-8 hours",
        requiredDocuments: ["Asset inventory", "EIN application", "Notary services"],
        isOptional: false,
        dependsOn: ["secured-party-creditor"],
        status: 'not_started'
      }
    ]
  },
  {
    id: "citizenship-status",
    title: "Citizenship & National Status Correction",
    description: "Documents correcting federal citizenship classification and asserting proper national status",
    items: [
      {
        id: "ds11-passport-application",
        title: "DS-11 Passport Application + Explanatory Letter",
        description: "Declaring Non-Citizen National Status under 8 U.S.C. § 1101(a)(21)",
        purpose: "The DS-11 Passport Application provides a lawful pathway to declare your status as a non-citizen national under 8 U.S.C. § 1101(a)(21). When submitted correctly—along with a properly worded explanatory letter—it becomes one of the most powerful evidentiary tools for claiming your birthright political status outside of the 14th Amendment 'U.S. citizen' classification.",
        whatItDoes: [
          "Distinguishes you from a federal citizen, who is subject to corporate statutes, revenue laws, and territorial jurisdiction",
          "Confirms your status as a state national or native American whose allegiance is to the land and not the U.S. corporation",
          "Provides official documentation of your corrected political status",
          "Creates rebuttable presumption of non-federal jurisdiction"
        ],
        howToUse: [
          "Present as evidence of national status in legal proceedings",
          "Reference in tax matters to assert non-federal status",
          "Use when asserting constitutional rights as a state national",
          "Include in correspondence with government agencies"
        ],
        whoSigns: [
          "Applicant signs DS-11 form",
          "Authorized acceptance agent or passport official",
          "Notarization may be required for explanatory letter"
        ],
        whereToFile: [
          "U.S. Passport Agency or authorized acceptance facility",
          "Include explanatory letter with application",
          "Keep copies of all submitted documents",
          "File supporting documentation in trust records"
        ],
        stepByStepInstructions: [
          "Complete DS-11 form accurately, checking appropriate boxes for national status",
          "Draft detailed explanatory letter citing 8 U.S.C. § 1101(a)(21) and asserting non-citizen national status",
          "Gather required supporting documents (birth certificate, etc.)",
          "Schedule appointment at passport acceptance facility",
          "Submit application with explanatory letter and supporting documents",
          "Pay required fees and obtain receipt",
          "Follow up on application status and document any responses",
          "Upon receipt, use passport as evidence of corrected status"
        ],
        draftingChecklist: [
          "Completed DS-11 Passport Application",
          "Explanatory Letter citing legal authority",
          "Birth certificate or equivalent proof of birth",
          "Photo identification",
          "Passport photos meeting requirements",
          "Application fees",
          "Supporting legal research and citations"
        ],
        outputs: [
          "U.S. Passport with national status designation",
          "Filed explanatory letter and supporting documents",
          "Receipt and tracking information",
          "Correspondence with passport agency",
          "Legal research supporting national status claim"
        ],
        category: 'citizenship-status',
        priority: 'high',
        estimatedTime: "3-4 hours preparation + processing time",
        requiredDocuments: ["Birth certificate", "Photo ID", "Passport photos", "Legal research"],
        isOptional: false,
        dependsOn: ["private-banking-trust"],
        status: 'not_started'
      },
      {
        id: "foia-requests",
        title: "FOIA Requests (SSA, DOS, USCIS)",
        description: "Obtaining Proof of Federal Classification to Support Status Correction",
        purpose: "Freedom of Information Act (FOIA) requests to Social Security Administration, Department of State, and USCIS are essential for obtaining official records of your current federal classification. These records serve as evidence of misclassification and support your status correction efforts.",
        whatItDoes: [
          "Reveals current federal database classifications and records",
          "Provides evidence of unauthorized presumptions about your status",
          "Documents the administrative trail of your federal profile",
          "Creates official record of information requests for legal proceedings",
          "Establishes foundation for challenging incorrect classifications"
        ],
        howToUse: [
          "Use obtained records as evidence in status correction proceedings",
          "Reference specific database entries when challenging federal jurisdiction",
          "Include in legal filings to show government's own records",
          "Present to administrative agencies when asserting correct status"
        ],
        whoSigns: [
          "Requestor signs FOIA request forms",
          "May require notarization for identity verification",
          "Optional witness signatures for enhanced authenticity"
        ],
        whereToFile: [
          "Submit to each agency's FOIA office (SSA, DOS, USCIS)",
          "Send via certified mail with return receipt",
          "Keep copies of all requests and responses",
          "File responses in legal documentation folder"
        ],
        stepByStepInstructions: [
          "Draft separate FOIA requests for SSA, Department of State, and USCIS",
          "Include specific requests for all records, classifications, and database entries",
          "Attach proof of identity and any required fees",
          "Submit requests via certified mail to each agency's FOIA office",
          "Track requests and follow up within statutory timeframes",
          "Review responses carefully and identify any incorrect classifications",
          "File appeals if requests are denied or inadequately fulfilled",
          "Organize received records for use in status correction process"
        ],
        draftingChecklist: [
          "FOIA request letters for each agency (SSA, DOS, USCIS)",
          "Identity verification documents",
          "Specific records requests and classifications sought",
          "Required fees or fee waiver requests",
          "Certified mail receipts and tracking",
          "Follow-up correspondence templates",
          "Appeal procedures and deadlines"
        ],
        outputs: [
          "Complete federal records from SSA, DOS, and USCIS",
          "FOIA request confirmations and tracking numbers",
          "Agency response letters and provided records",
          "Documentation of any denials or inadequate responses",
          "Organized records package for legal use"
        ],
        category: 'citizenship-status',
        priority: 'medium',
        estimatedTime: "2-3 hours preparation + 30-60 days processing",
        requiredDocuments: ["Photo ID", "Birth certificate", "Request fees", "Certified mail"],
        isOptional: false,
        dependsOn: ["ds11-passport-application"],
        status: 'not_started'
      }
    ]
  },
  {
    id: "identification-corrections",
    title: "Government Database & ID Corrections",
    description: "Correcting federal databases and obtaining proper identification reflecting true status",
    items: [
      {
        id: "uscis-self-check",
        title: "USCIS Self-Check via E-Verify",
        description: "Discovering Administrative Citizenship Status and Creating a Rebuttable Record",
        purpose: "The USCIS Self-Check system allows you to discover how the federal government has classified your employment authorization and citizenship status in their databases. This creates a rebuttable record of their presumptions about your status.",
        whatItDoes: [
          "Reveals current USCIS database classification of your status",
          "Documents federal presumptions about your employment authorization",
          "Creates an official record of database inquiry and results",
          "Provides evidence for challenging incorrect federal classifications",
          "Establishes timeline of status verification attempts"
        ],
        howToUse: [
          "Use results as evidence of federal misclassification",
          "Reference in status correction correspondence with agencies",
          "Include in legal filings challenging federal jurisdiction",
          "Document discrepancies between claimed and actual status"
        ],
        whoSigns: [
          "Individual completing the self-check",
          "Digital acceptance of terms and conditions",
          "Print and notarize results for enhanced authenticity"
        ],
        whereToFile: [
          "Keep digital and printed copies of all results",
          "File with other federal status documentation",
          "Include in status correction evidence package",
          "Store with FOIA responses and related records"
        ],
        stepByStepInstructions: [
          "Visit the USCIS E-Verify Self-Check website",
          "Create an account with required personal information",
          "Complete the self-check process following all prompts",
          "Document all results, including any error messages or discrepancies",
          "Print or save all confirmation pages and results",
          "Take screenshots of database classifications shown",
          "If results show incorrect status, document for correction process",
          "File printed results with notarization for legal authenticity"
        ],
        draftingChecklist: [
          "USCIS E-Verify account creation",
          "Personal information verification documents",
          "Self-check completion and results documentation",
          "Screenshots of all database information displayed",
          "Printed results with date stamps",
          "Notarized copies for legal use",
          "Documentation of any discrepancies or errors"
        ],
        outputs: [
          "E-Verify Self-Check results and confirmations",
          "Screenshots of database classifications",
          "Notarized copies of results",
          "Documentation of status discrepancies",
          "Account information and access records"
        ],
        category: 'identification-corrections',
        priority: 'medium',
        estimatedTime: "1-2 hours",
        requiredDocuments: ["Personal identification", "Internet access", "Printer for results"],
        isOptional: false,
        dependsOn: ["foia-requests"],
        status: 'not_started'
      },
      {
        id: "sf181-racial-identification",
        title: "SF-181 Racial Identification Form",
        description: "Correcting Racial Classification to 'American Indian' to Reassert Indigenous Origin",
        purpose: "The SF-181 form allows correction of racial classification in federal databases to 'American Indian,' which can help reassert indigenous origin and connection to the land rather than federal corporate citizenship.",
        whatItDoes: [
          "Corrects racial classification in federal databases",
          "Asserts indigenous connection to American soil",
          "May support claims of native national status",
          "Creates official record of racial identification correction",
          "Potentially affects federal jurisdiction presumptions"
        ],
        howToUse: [
          "Submit to appropriate federal agencies for database correction",
          "Reference in status correction proceedings",
          "Use to support indigenous rights claims",
          "Include in comprehensive status correction package"
        ],
        whoSigns: [
          "Individual requesting racial classification correction",
          "Notarization recommended for authenticity",
          "Witness signatures may add evidentiary weight"
        ],
        whereToFile: [
          "Submit to relevant federal agencies maintaining racial data",
          "Keep copies with other status correction documents",
          "File with indigenous rights documentation",
          "Include in personal status correction records"
        ],
        stepByStepInstructions: [
          "Obtain SF-181 form from appropriate federal source",
          "Complete form accurately, selecting 'American Indian' classification",
          "Research and document any indigenous ancestry or connections",
          "Attach supporting documentation if available",
          "Have form notarized for enhanced authenticity",
          "Submit to appropriate federal agencies via certified mail",
          "Follow up on processing and obtain confirmation of changes",
          "Keep all documentation for status correction records"
        ],
        draftingChecklist: [
          "Completed SF-181 Racial Identification Form",
          "Supporting documentation of indigenous connection",
          "Research on indigenous rights and status",
          "Notarization of form completion",
          "Cover letter explaining correction request",
          "Certified mail submission materials",
          "Follow-up tracking and confirmation procedures"
        ],
        outputs: [
          "Filed SF-181 form with racial classification correction",
          "Confirmation of database changes from agencies",
          "Supporting indigenous connection documentation",
          "Certified mail receipts and tracking",
          "Updated federal records reflecting corrected classification"
        ],
        category: 'identification-corrections',
        priority: 'low',
        estimatedTime: "2-3 hours",
        requiredDocuments: ["SF-181 form", "Indigenous ancestry research", "Notary services"],
        isOptional: true,
        dependsOn: ["uscis-self-check"],
        status: 'not_started'
      }
    ]
  }
];

export default function StatusCorrection() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  
  // State for comprehensive interface
  const [selectedItem, setSelectedItem] = useState<StatusCorrectionItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("checklist");
  const [progress, setProgress] = useState<StatusProgress>({
    completed: 0,
    total: 0,
    percentage: 0
  });

  // Calculate progress from checklist data
  const allItems = useMemo(() => {
    return statusCorrectionData.flatMap(section => section.items);
  }, []);

  // Filter items based on search and filters
  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === "all" || item.status === filterStatus;
      const matchesCategory = filterCategory === "all" || item.category === filterCategory;
      
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [allItems, searchTerm, filterStatus, filterCategory]);

  // Update progress when items change
  useEffect(() => {
    const completed = allItems.filter(item => item.status === 'completed').length;
    setProgress({
      completed,
      total: allItems.length,
      percentage: allItems.length > 0 ? (completed / allItems.length) * 100 : 0
    });
  }, [allItems]);

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'in_progress': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'not_started': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'in_progress': return <Clock className="w-4 h-4" />;
      case 'not_started': return <Play className="w-4 h-4" />;
      default: return <Play className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'foundational': return <Shield className="w-4 h-4" />;
      case 'citizenship-status': return <UserCheck className="w-4 h-4" />;
      case 'identification-corrections': return <Scale className="w-4 h-4" />;
      case 'financial': return <CreditCard className="w-4 h-4" />;
      case 'travel-documents': return <Globe className="w-4 h-4" />;
      case 'records': return <FileText className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  const handleStatusUpdate = (itemId: string, newStatus: string) => {
    // Update item status - this would normally sync with backend
    setProgress(prev => {
      const completed = allItems.filter(item => 
        item.id === itemId ? newStatus === 'completed' : item.status === 'completed'
      ).length;
      
      return {
        completed,
        total: allItems.length,
        percentage: (completed / allItems.length) * 100
      };
    });
    
    toast({
      title: "Status Updated",
      description: `Item status updated to ${newStatus.replace('_', ' ')}`,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Scale className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground">Loading Status Correction System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <PortalLayout pageTitle="Status Correction Process">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <Scale className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-card-foreground" data-testid="text-status-correction-title">
                Status Correction Process
              </h1>
              <p className="text-muted-foreground">
                Comprehensive checklist for correcting your legal status and asserting your rights
              </p>
            </div>
          </div>
        </div>

        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Items</p>
                  <p className="text-2xl font-bold text-card-foreground" data-testid="text-total-items">
                    {progress.total}
                  </p>
                </div>
                <FileCheck className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-completed-items">
                    {progress.completed}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Remaining</p>
                  <p className="text-2xl font-bold text-orange-600" data-testid="text-remaining-items">
                    {progress.total - progress.completed}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Progress</p>
                  <p className="text-2xl font-bold text-primary" data-testid="text-progress-percentage">
                    {Math.round(progress.percentage)}%
                  </p>
                </div>
                <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">
                    {Math.round(progress.percentage)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="text-card-foreground font-medium">{Math.round(progress.percentage)}% Complete</span>
          </div>
          <Progress value={progress.percentage} className="h-2" />
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="checklist" data-testid="tab-checklist">Checklist</TabsTrigger>
            <TabsTrigger value="search" data-testid="tab-search">Search & Filter</TabsTrigger>
            <TabsTrigger value="progress" data-testid="tab-progress">Progress Tracking</TabsTrigger>
          </TabsList>

          <TabsContent value="checklist" className="space-y-6">
            {/* Status Correction Sections */}
            {statusCorrectionData.map((section) => (
              <Card key={section.id} className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getCategoryIcon(section.id)}
                      <div>
                        <CardTitle className="text-card-foreground">{section.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {section.items.length} items
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {section.items.map((item) => (
                      <div key={item.id} className="border border-border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-card-foreground">{item.title}</h4>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getStatusColor(item.status)}`}
                                data-testid={`badge-status-${item.id}`}
                              >
                                {getStatusIcon(item.status)}
                                <span className="ml-1">{item.status.replace('_', ' ')}</span>
                              </Badge>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getPriorityColor(item.priority)}`}
                              >
                                {item.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {item.estimatedTime}
                              </span>
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {item.requiredDocuments.length} docs
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => setSelectedItem(item)}
                                  data-testid={`button-view-details-${item.id}`}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  Details
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    {getCategoryIcon(item.category)}
                                    {item.title}
                                  </DialogTitle>
                                </DialogHeader>
                                {selectedItem && <StatusCorrectionItemDetails item={selectedItem} />}
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="search" className="space-y-6">
            {/* Search and Filter Interface */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Search and Filter Items
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Search</label>
                    <Input
                      placeholder="Search items..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full"
                      data-testid="input-search"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Status</label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger data-testid="select-status-filter">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Category</label>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger data-testid="select-category-filter">
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="foundational">Foundational Legal Instruments</SelectItem>
                        <SelectItem value="citizenship-status">Citizenship & National Status</SelectItem>
                        <SelectItem value="identification-corrections">ID & Database Corrections</SelectItem>
                        <SelectItem value="financial">Financial Status</SelectItem>
                        <SelectItem value="travel-documents">Travel Documents</SelectItem>
                        <SelectItem value="records">Records Management</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Filtered Results */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Search Results ({filteredItems.length} items)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredItems.map((item) => (
                    <div key={item.id} className="border border-border rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getCategoryIcon(item.category)}
                        <div>
                          <h4 className="font-medium text-card-foreground">{item.title}</h4>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${getStatusColor(item.status)}`}>
                          {item.status.replace('_', ' ')}
                        </Badge>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setSelectedItem(item)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                {getCategoryIcon(item.category)}
                                {item.title}
                              </DialogTitle>
                            </DialogHeader>
                            {selectedItem && <StatusCorrectionItemDetails item={selectedItem} />}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="progress" className="space-y-6">
            {/* Progress Tracking */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Progress by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {statusCorrectionData.map((section) => {
                    const sectionProgress = {
                      completed: section.items.filter(item => item.status === 'completed').length,
                      total: section.items.length
                    };
                    const percentage = sectionProgress.total > 0 ? (sectionProgress.completed / sectionProgress.total) * 100 : 0;
                    
                    return (
                      <div key={section.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(section.id)}
                            <span className="font-medium text-card-foreground">{section.title}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {sectionProgress.completed}/{sectionProgress.total} ({Math.round(percentage)}%)
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}

// Status Correction Item Details Component
function StatusCorrectionItemDetails({ item }: { item: StatusCorrectionItem }) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Item Overview */}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-muted-foreground">{item.description}</p>
          </div>
          <div className="flex gap-2 ml-4">
            <Badge variant="outline" className={getPriorityColor(item.priority)}>
              {item.priority}
            </Badge>
            <Badge variant="outline">
              {item.estimatedTime}
            </Badge>
          </div>
        </div>
      </div>

      {/* Detailed Information Accordion */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="purpose">
          <AccordionTrigger className="text-left">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Purpose & Overview
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <p className="text-muted-foreground">{item.purpose}</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="what-it-does">
          <AccordionTrigger className="text-left">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              What This Document Does
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2">
              {item.whatItDoes.map((point, index) => (
                <li key={index} className="flex items-start gap-2 text-muted-foreground">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="how-to-use">
          <AccordionTrigger className="text-left">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              How to Use This Document
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2">
              {item.howToUse.map((point, index) => (
                <li key={index} className="flex items-start gap-2 text-muted-foreground">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="who-signs">
          <AccordionTrigger className="text-left">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Who Signs This Document
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2">
              {item.whoSigns.map((point, index) => (
                <li key={index} className="flex items-start gap-2 text-muted-foreground">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="where-to-file">
          <AccordionTrigger className="text-left">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Where to File
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2">
              {item.whereToFile.map((point, index) => (
                <li key={index} className="flex items-start gap-2 text-muted-foreground">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="instructions">
          <AccordionTrigger className="text-left">
            <div className="flex items-center gap-2">
              <ScrollText className="w-4 h-4" />
              Step-by-Step Instructions
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ol className="space-y-2">
              {item.stepByStepInstructions.map((step, index) => (
                <li key={index} className="flex items-start gap-3 text-muted-foreground">
                  <span className="w-6 h-6 bg-primary/20 text-primary rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="checklist">
          <AccordionTrigger className="text-left">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Drafting Checklist
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2">
              {item.draftingChecklist.map((point, index) => (
                <li key={index} className="flex items-start gap-2 text-muted-foreground">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="outputs">
          <AccordionTrigger className="text-left">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Expected Outputs
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2">
              {item.outputs.map((output, index) => (
                <li key={index} className="flex items-start gap-2 text-muted-foreground">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                  {output}
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="requirements">
          <AccordionTrigger className="text-left">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Required Documents
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2">
              {item.requiredDocuments.map((doc, index) => (
                <li key={index} className="flex items-start gap-2 text-muted-foreground">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                  {doc}
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* File Upload Section */}
      <div className="border-t pt-6">
        <h4 className="font-semibold text-card-foreground mb-3">Upload Documents</h4>
        {user?.familyId && (
          <ObjectUploader
            onGetUploadParameters={async () => ({
              method: "PUT" as const,
              url: "/api/upload/presigned-url"
            })}
            onComplete={() => {
              toast({
                title: "Document Uploaded",
                description: "Document has been uploaded successfully.",
              });
            }}
          >
            Upload Document
          </ObjectUploader>
        )}
      </div>
    </div>
  );
}