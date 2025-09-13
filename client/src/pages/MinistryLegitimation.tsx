import { useState, useMemo } from "react";
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
import { 
  Search, 
  Filter, 
  CheckCircle, 
  Clock, 
  FileText, 
  Upload, 
  Eye, 
  Play, 
  Building, 
  Shield, 
  CreditCard, 
  Globe, 
  Users, 
  ScrollText,
  BookOpen,
  BanknoteIcon,
  Settings
} from "lucide-react";
import type { MinistryChecklistItem, MinistryChecklistSection, MinistryProgress } from "@/lib/types";

// Ministry Checklist Data based on the PDF
const ministryChecklistData: MinistryChecklistSection[] = [
  {
    id: "foundational",
    title: "Foundational Documents", 
    description: "Essential documents that establish the ministry's legal and spiritual foundation",
    items: [
      {
        id: "ministry-declaration",
        title: "Ministry Declaration",
        description: "Foundational statement establishing the unincorporated ecclesiastical ministry, name, purpose, jurisdiction, and authority",
        purpose: "A Ministry Declaration is the founding instrument that publicly affirms the ministry's name, purpose, ecclesiastical authority, and intent to operate as a private, faith-based, unincorporated religious organization.",
        whatItDoes: [
          "Establishes the ministry's identity, mission, and jurisdiction (ecclesiastical/religious freedom)",
          "Identifies founding officers/trustees and defines their initial powers",
          "Adopts core governing documents by reference (Bylaws, Minutes, Schedule A, etc.)",
          "Creates a standing record you can show banks, donors, payment processors, and service providers",
          "Forms part of the permanent record book and compliance file"
        ],
        howToUse: [
          "Present with your Certificate of Trust/Trust Indenture, Banking Resolution, EIN letter, and Bylaws when opening accounts or onboarding donation platforms",
          "Attach as Exhibit A to vendor agreements, website legal pages, and grant or facility applications when organizational proof is requested",
          "Cite the Declaration's date and version number in each set of Minutes and Resolutions"
        ],
        whoSigns: [
          "Founders/Trustees/Directors sign",
          "Secretary attests",
          "Optional: notarization for evidentiary weight; a witness signature block may be added"
        ],
        whereToFile: [
          "Keep the wet-ink original in the Ministry Record Book and a scanned PDF in your secure drive",
          "Provide a certified copy to your bank and donation processor",
          "Optional public notice: record a copy with your county recorder or have it time-stamped by a notary/recording service",
          "Maintain version control (v1.0, v1.1, etc.) and archive superseded versions"
        ],
        stepByStepInstructions: [
          "Title and heading: Use a clear title with full ministry name and effective date",
          "Name and jurisdiction: State the ministry's full name and ecclesiastical authority",
          "Purpose and activities: Describe religious, charitable, educational activities",
          "Governance and officers: List initial trustees/directors and officers",
          "Assets and trust language: State that all property is held in trust for religious purposes",
          "Donations and acknowledgments: State contribution usage and record-keeping commitments",
          "Records policy: Identify Ministry Record Book location and custodian",
          "Adoption clause: Adopt and incorporate governing documents by reference",
          "Signatures and attestation: Founders/trustees sign; secretary attests",
          "File and disseminate: Place original in record book, scan to PDF, distribute certified copies"
        ],
        draftingChecklist: [
          "Ministry name (full legal style and any abbreviations)",
          "Ecclesiastical authority and jurisdiction statement",
          "Purpose/mission and core activities",
          "Founding date and principal mailing address",
          "Initial board/trustees and officer roles",
          "Adoption of governing documents by reference",
          "Property/asset holding language",
          "Donations/receipts policy and acknowledgment practice",
          "Conflict-of-interest and private benefit prohibitions",
          "Books and records policy",
          "Signatures, secretary attestation, notary block",
          "Version and effective date"
        ],
        outputs: [
          "Signed Declaration (original)",
          "Secretary's Certificate authenticating copies",
          "Notarized copy (optional)",
          "PDF scan saved to secure drive",
          "Distribution record (who received certified copies and when)"
        ],
        category: 'foundational',
        priority: 'high',
        estimatedTime: "2-4 hours",
        requiredDocuments: ["Ministry name registration", "Officer identification documents"],
        isOptional: false,
        status: 'not_started'
      },
      {
        id: "execution-of-trust",
        title: "Execution of Trust",
        description: "Formal signing and sealing of the ecclesiastical trust that will hold all ministry property and affairs",
        purpose: "The Execution of Trust is the formal act that brings your ecclesiastical ministry trust into legal existence and operational capacity. It evidences intent, appoints fiduciaries, accepts the initial trust res (property placed into trust), and authorizes day-to-day actions.",
        whatItDoes: [
          "Converts the ministry from a concept into a functioning trust with enforceable duties and powers",
          "Appoints and binds trustees via acceptance, oath, and fiduciary standards",
          "Receives the initial trust property (the 'settlement' or 'seed'), and adopts Schedule A",
          "Incorporates governing instruments by reference",
          "Authorizes execution of documents, banking, contracting, and recordkeeping"
        ],
        howToUse: [
          "Present a short 'Certificate/Abstract of Trust' (not the full trust) to banks, payment processors, and vendors",
          "Cite the execution date and version in Minutes and all later Resolutions",
          "Attach Schedule A when assigning or receiving new property into the ministry",
          "Use the Banking Resolution and Authorized Signer list that the Execution of Trust activates"
        ],
        whoSigns: [
          "Settlor/Founder (if distinct from trustees)",
          "Each Trustee accepts appointment and fiduciary duties; Secretary attests",
          "Optional: witness and notarization to strengthen evidentiary weight"
        ],
        whereToFile: [
          "Keep the wet-ink original in the Ministry Record Book; scan a PDF to your secure drive",
          "Do not publicly file the full trust; instead, prepare a one-page Certificate/Abstract of Trust for third parties",
          "If transferring real property, record the deed into the trust at the county recorder",
          "For banking, provide: Certificate/Abstract of Trust, Banking Resolution, EIN assignment letter, and IDs of signers"
        ],
        stepByStepInstructions: [
          "Title the instrument as 'Trust Indenture and Ecclesiastical Deed of Trust'",
          "State purposes and reference the Ministry Declaration",
          "Identify parties: Settlor/Founder, Trustees, and the Ministry as the trust body",
          "Appoint trustees and obtain acceptance with Fiduciary Oath",
          "Seed the trust with nominal property and attach Schedule A",
          "Adopt governing documents by reference",
          "Define powers and limits; prohibit private inurement",
          "Authorize signatures for banking and contracts",
          "Execute and notarize",
          "Place original in record book; prepare Certificate/Abstract of Trust for banks"
        ],
        draftingChecklist: [
          "Name and nature of the trust (ecclesiastical, charitable, unincorporated)",
          "Purposes and beneficiaries",
          "Trustees (names, powers, quorum, vacancies, removal, successor process)",
          "Fiduciary standards (loyalty, care, obedience, no private inurement)",
          "Powers (own property, contract, employ staff, maintain website, receive donations)",
          "Records (Minutes, ledgers, receipt logs, donor acknowledgments)",
          "Banking authority (delegated by separate Banking Resolution)",
          "Amendments (who may amend, limits protecting charitable/ministerial purpose)",
          "Execution, acceptance, oath(s), notary block(s)",
          "Incorporation by reference (Bylaws, Minutes, Schedule A, Policies)"
        ],
        outputs: [
          "Signed Trust Indenture (original)",
          "Trustee Acceptance and Oath documents",
          "Certificate/Abstract of Trust (one-page for third parties)",
          "Secretary's attestation",
          "Notarized copy (if applicable)",
          "Schedule A with initial trust property"
        ],
        category: 'foundational',
        priority: 'high',
        estimatedTime: "3-5 hours",
        requiredDocuments: ["Ministry Declaration", "Initial trust property documentation"],
        isOptional: false,
        dependsOn: ["ministry-declaration"],
        status: 'not_started'
      },
      {
        id: "letters-of-credence",
        title: "Letters of Credence",
        description: "Credentials issued to ministers/clergy confirming ordination, office, and authority to act for the ministry",
        purpose: "Letters of Credence are formal credentials that document a minister's ordination, commission, or appointment within the ecclesiastical ministry, providing official recognition of their authority and standing.",
        whatItDoes: [
          "Confirms ministerial ordination, office, and authority",
          "Provides official documentation for ecclesiastical recognition",
          "Establishes credentials for performing ministerial duties",
          "Creates formal record of ministerial standing",
          "Supports professional and legal recognition"
        ],
        howToUse: [
          "Present to other religious organizations for recognition",
          "Use for hospital chaplaincy applications",
          "Provide to military chaplain services",
          "Submit for prison ministry credentials",
          "Include in professional ministerial portfolios"
        ],
        whoSigns: [
          "Ordaining authority or senior minister",
          "Ministry secretary attests",
          "Witness signatures may be added",
          "Official ministry seal if available"
        ],
        whereToFile: [
          "Keep original in Ministry Record Book",
          "Provide certified copies to credentialed ministers",
          "Maintain digital copies in secure storage",
          "Update credential registry as needed"
        ],
        stepByStepInstructions: [
          "Document the minister's calling and ordination process",
          "Include specific ministerial authority granted",
          "Reference supporting ordination ceremonies or appointments",
          "Include effective dates and any limitations",
          "Have appropriate ministry officials sign and seal",
          "Create certified copies for the minister's use",
          "File original in permanent records",
          "Update ministry roster of credentialed ministers"
        ],
        draftingChecklist: [
          "Minister's full name and title",
          "Date and location of ordination/commissioning",
          "Specific ministerial authority granted",
          "Reference to ordaining ceremony or appointment",
          "Ministry name and authority",
          "Effective date and duration (if applicable)",
          "Signature blocks for appropriate officials",
          "Ministry seal or official stamp",
          "Certification language",
          "Contact information for verification"
        ],
        outputs: [
          "Original Letters of Credence",
          "Certified copies for minister's use",
          "Entry in ministry credentials registry",
          "Digital backup copies",
          "Verification contact information"
        ],
        category: 'foundational',
        priority: 'medium',
        estimatedTime: "1-2 hours",
        requiredDocuments: ["Ordination records", "Ministry Declaration"],
        isOptional: false,
        dependsOn: ["ministry-declaration"],
        status: 'not_started'
      }
    ]
  },
  {
    id: "governance",
    title: "Governance Documents",
    description: "Legal and administrative documents that define ministry operations and decision-making",
    items: [
      {
        id: "claim-of-life",
        title: "Claim of Life",
        description: "Record asserting living status and private capacity, distinct from any state-created legal persona",
        purpose: "A Claim of Life is a formal declaration asserting one's status as a living being operating in private capacity, establishing the distinction between the natural person and any artificial legal entities or personas.",
        whatItDoes: [
          "Asserts living status and private capacity",
          "Distinguishes between natural person and legal personas",
          "Establishes private rights and sovereignty",
          "Creates record of non-commercial status",
          "Supports religious liberty claims"
        ],
        howToUse: [
          "File with ministry records as foundational document",
          "Reference in contracts and agreements",
          "Use to establish private capacity in legal matters",
          "Include in religious liberty documentation",
          "Cite in correspondence asserting private rights"
        ],
        whoSigns: [
          "The individual making the claim",
          "Witness signatures recommended",
          "Notarization adds evidentiary weight"
        ],
        whereToFile: [
          "Keep original in personal records",
          "File copy with Ministry Record Book",
          "May be recorded with county recorder",
          "Store certified copies in secure location"
        ],
        stepByStepInstructions: [
          "Draft clear statement of living status",
          "Include assertion of private capacity",
          "Distinguish from legal personas or entities",
          "Include personal identifying information",
          "Have document witnessed and notarized",
          "File in appropriate record books",
          "Create certified copies as needed",
          "Update as circumstances change"
        ],
        draftingChecklist: [
          "Clear statement of living status",
          "Assertion of private capacity",
          "Distinction from legal personas",
          "Personal identifying information",
          "Effective date",
          "Signature block",
          "Witness acknowledgment",
          "Notary acknowledgment",
          "Recording information"
        ],
        outputs: [
          "Signed Claim of Life (original)",
          "Notarized copy",
          "Witness attestations",
          "Filing receipt (if recorded)",
          "Certified copies for use"
        ],
        category: 'governance',
        priority: 'medium',
        estimatedTime: "1-2 hours",
        requiredDocuments: ["Personal identification", "Witness identification"],
        isOptional: true,
        status: 'not_started'
      },
      {
        id: "declaration-of-independence",
        title: "Declaration of Independence",
        description: "Statement of religious autonomy and separation from civil control, under constitutional and ecclesiastical protections",
        purpose: "A Declaration of Independence establishes the ministry's religious autonomy and separation from inappropriate civil control, invoking constitutional and ecclesiastical protections for religious liberty.",
        whatItDoes: [
          "Asserts religious autonomy and self-governance",
          "Establishes separation from inappropriate civil control",
          "Invokes constitutional religious liberty protections",
          "Creates formal record of ecclesiastical independence",
          "Supports legal defense of religious practices"
        ],
        howToUse: [
          "Reference in legal proceedings involving religious liberty",
          "Include in ministry governance documents",
          "Cite when asserting ecclesiastical immunity",
          "Use in correspondence with government entities",
          "Include in legal briefs defending religious practices"
        ],
        whoSigns: [
          "Ministry trustees and leadership",
          "Congregation representatives may also sign",
          "Secretary attests to adoption",
          "Optional notarization for legal weight"
        ],
        whereToFile: [
          "Keep original in Ministry Record Book",
          "File with constitutional law documentation",
          "May be recorded as public notice",
          "Store with religious liberty legal materials"
        ],
        stepByStepInstructions: [
          "Research constitutional religious liberty protections",
          "Draft declaration asserting religious autonomy",
          "Include specific constitutional references",
          "Identify areas of ecclesiastical self-governance",
          "Have ministry leadership formally adopt",
          "Document in official ministry minutes",
          "File with permanent ministry records",
          "Provide copies to legal counsel"
        ],
        draftingChecklist: [
          "Constitutional basis for religious liberty",
          "Assertion of religious autonomy",
          "Specific areas of self-governance",
          "Separation from inappropriate civil control",
          "Biblical or doctrinal foundation",
          "Legal precedent references",
          "Adoption by ministry leadership",
          "Secretary's attestation",
          "Effective date and version",
          "Storage with legal documents"
        ],
        outputs: [
          "Adopted Declaration of Independence",
          "Ministry minutes reflecting adoption",
          "Legal memorandum supporting positions",
          "Constitutional law references",
          "Copies for legal counsel"
        ],
        category: 'governance',
        priority: 'medium',
        estimatedTime: "2-3 hours",
        requiredDocuments: ["Constitutional research", "Ministry governance documents"],
        isOptional: true,
        dependsOn: ["ministry-declaration"],
        status: 'not_started'
      },
      {
        id: "ministry-minutes",
        title: "Ministry Minutes",
        description: "Official record of meetings, resolutions, elections, acceptances, appointments, and approvals",
        purpose: "Ministry Minutes provide the official record of all ministry meetings, decisions, resolutions, elections, and formal actions, creating a comprehensive governance history.",
        whatItDoes: [
          "Documents all official ministry meetings and decisions",
          "Records resolutions, elections, and appointments",
          "Creates legal record of governance actions",
          "Provides historical record of ministry development",
          "Supports corporate formalities and good governance"
        ],
        howToUse: [
          "Maintain as ongoing record of all ministry meetings",
          "Reference in legal proceedings or audits",
          "Use to track decision-making history",
          "Include in annual governance reviews",
          "Provide to banks and legal counsel as needed"
        ],
        whoSigns: [
          "Meeting chairperson or presiding officer",
          "Secretary records and attests",
          "Board members may sign to confirm accuracy"
        ],
        whereToFile: [
          "Keep all originals in Ministry Record Book",
          "Maintain chronological filing system",
          "Store digital copies with date organization",
          "Provide copies to legal counsel as needed"
        ],
        stepByStepInstructions: [
          "Establish regular meeting schedule",
          "Prepare meeting agendas in advance",
          "Take detailed minutes during meetings",
          "Record all motions, votes, and decisions",
          "Include attendance and officer reports",
          "Have minutes reviewed and approved",
          "File signed minutes in permanent records",
          "Update resolutions register as needed"
        ],
        draftingChecklist: [
          "Meeting date, time, and location",
          "Attendance record",
          "Approval of previous minutes",
          "Officer and committee reports",
          "Old business and new business",
          "Motions, seconds, and vote results",
          "Resolutions adopted",
          "Appointments and elections",
          "Next meeting date",
          "Secretary's signature and date"
        ],
        outputs: [
          "Signed meeting minutes",
          "Resolutions register",
          "Attendance records",
          "Action items list",
          "Annual minutes compilation"
        ],
        category: 'governance',
        priority: 'high',
        estimatedTime: "1-2 hours per meeting",
        requiredDocuments: ["Meeting agendas", "Previous minutes", "Reports"],
        isOptional: false,
        dependsOn: ["ministry-declaration", "execution-of-trust"],
        status: 'not_started'
      },
      {
        id: "bylaws",
        title: "Bylaws",
        description: "Internal rules defining governance structure, roles, decision-making, discipline, succession, and meetings",
        purpose: "Bylaws establish the internal governance structure and operational procedures for the ministry, defining roles, responsibilities, decision-making processes, and administrative procedures.",
        whatItDoes: [
          "Defines governance structure and officer roles",
          "Establishes decision-making procedures",
          "Outlines meeting requirements and processes",
          "Sets membership and discipline procedures",
          "Provides succession and vacancy procedures"
        ],
        howToUse: [
          "Reference for all governance decisions",
          "Use to resolve procedural questions",
          "Guide for new officer orientation",
          "Framework for ministry operations",
          "Basis for conflict resolution"
        ],
        whoSigns: [
          "Ministry trustees or board members",
          "Secretary certifies adoption",
          "May require membership approval"
        ],
        whereToFile: [
          "Keep original in Ministry Record Book",
          "Provide copies to all officers",
          "Store with governance documents",
          "Update and maintain current version"
        ],
        stepByStepInstructions: [
          "Research similar ministry bylaws for guidance",
          "Draft comprehensive governance structure",
          "Define all officer roles and responsibilities",
          "Establish meeting and voting procedures",
          "Include membership and discipline provisions",
          "Review with legal counsel if needed",
          "Have formally adopted by trustees",
          "File as foundational governance document"
        ],
        draftingChecklist: [
          "Ministry name and purpose statement",
          "Membership provisions",
          "Board/trustee structure and terms",
          "Officer roles and responsibilities",
          "Meeting requirements and procedures",
          "Voting and quorum requirements",
          "Committee structure",
          "Discipline and conflict resolution",
          "Amendment procedures",
          "Effective date and adoption record"
        ],
        outputs: [
          "Adopted bylaws document",
          "Board resolution adopting bylaws",
          "Copies for all officers",
          "Amendment tracking record",
          "Officer responsibilities summary"
        ],
        category: 'governance',
        priority: 'high',
        estimatedTime: "4-8 hours",
        requiredDocuments: ["Ministry Declaration", "Governance research"],
        isOptional: false,
        dependsOn: ["ministry-declaration", "execution-of-trust"],
        status: 'not_started'
      }
    ]
  },
  {
    id: "operations",
    title: "Operational Documents",
    description: "Forms and agreements needed for day-to-day ministry operations",
    items: [
      {
        id: "certificate-of-ordinance",
        title: "Certificate of Ordinance",
        description: "Formal certification of ordination or commission for ministers and officers",
        purpose: "A Certificate of Ordinance provides formal documentation of ministerial ordination or commissioning, establishing credentials and authority for ecclesiastical service.",
        whatItDoes: [
          "Formally documents ordination or commissioning",
          "Establishes ministerial credentials and authority",
          "Provides official recognition of ecclesiastical office",
          "Creates permanent record of ministerial standing",
          "Supports professional and legal recognition"
        ],
        howToUse: [
          "Present for ministerial recognition",
          "Include in professional credentials portfolio",
          "Use for hospital chaplaincy applications",
          "Submit for wedding officiant licensing",
          "Provide for tax exemption applications"
        ],
        whoSigns: [
          "Ordaining authority or senior minister",
          "Ministry officials or board members",
          "Secretary attests to issuance",
          "Witnesses may be included"
        ],
        whereToFile: [
          "Keep original in Ministry Record Book",
          "Provide certified copy to ordained individual",
          "Maintain ordination registry",
          "Store with personnel records"
        ],
        stepByStepInstructions: [
          "Complete ordination or commissioning process",
          "Document qualifications and calling",
          "Prepare formal certificate with ministry seal",
          "Have appropriate officials sign certificate",
          "Record in ministry ordination registry",
          "Present certificate in formal ceremony",
          "File original in permanent records",
          "Provide certified copy to ordained individual"
        ],
        draftingChecklist: [
          "Individual's full name and title",
          "Date and location of ordination",
          "Authority under which ordained",
          "Specific ministerial authority granted",
          "Ministry name and credentials",
          "Certificate number or identifier",
          "Signature blocks for officials",
          "Ministry seal or stamp",
          "Registration information",
          "Effective date"
        ],
        outputs: [
          "Original Certificate of Ordinance",
          "Certified copy for ordained individual",
          "Entry in ordination registry",
          "Ceremony documentation",
          "Digital backup copies"
        ],
        category: 'operations',
        priority: 'medium',
        estimatedTime: "1-2 hours",
        requiredDocuments: ["Ordination requirements", "Ministry credentials"],
        isOptional: false,
        dependsOn: ["letters-of-credence"],
        status: 'not_started'
      },
      {
        id: "church-employment-contract",
        title: "Church Employment Contract Form",
        description: "Agreement outlining roles, housing allowance, compensation, and ecclesiastical employment terms",
        purpose: "A Church Employment Contract defines the terms of employment for ministry staff, including compensation, benefits, housing allowances, and specific ecclesiastical duties and responsibilities.",
        whatItDoes: [
          "Establishes employment terms and conditions",
          "Defines compensation and benefit packages",
          "Outlines housing allowance provisions",
          "Specifies job duties and responsibilities",
          "Creates legal employment relationship"
        ],
        howToUse: [
          "Use for all ministry staff hiring",
          "Reference for performance evaluations",
          "Guide for compensation decisions",
          "Basis for dispute resolution",
          "Required for tax reporting purposes"
        ],
        whoSigns: [
          "Ministry representative (board chair or senior pastor)",
          "Employee being hired",
          "Witness signatures recommended",
          "Secretary may attest to board approval"
        ],
        whereToFile: [
          "Keep original in personnel files",
          "Provide copy to employee",
          "Store with employment documentation",
          "Maintain confidential access"
        ],
        stepByStepInstructions: [
          "Define job position and responsibilities",
          "Determine compensation and benefit package",
          "Calculate appropriate housing allowance",
          "Include performance and review procedures",
          "Add termination and severance provisions",
          "Review with legal counsel if needed",
          "Have board approve contract terms",
          "Execute contract with employee"
        ],
        draftingChecklist: [
          "Employee name and position title",
          "Job duties and responsibilities",
          "Compensation amount and schedule",
          "Housing allowance designation",
          "Benefit package details",
          "Performance evaluation procedures",
          "Termination and severance terms",
          "Confidentiality and conduct requirements",
          "Start date and contract duration",
          "Signature blocks and dates"
        ],
        outputs: [
          "Executed employment contract",
          "Board resolution approving hiring",
          "Personnel file establishment",
          "Tax documentation setup",
          "Benefits enrollment forms"
        ],
        category: 'operations',
        priority: 'medium',
        estimatedTime: "2-3 hours",
        requiredDocuments: ["Job description", "Compensation analysis", "Benefits information"],
        isOptional: true,
        dependsOn: ["bylaws"],
        status: 'not_started'
      },
      {
        id: "membership-application",
        title: "Membership Application",
        description: "Intake document for congregants/participants agreeing to ministry bylaws, doctrine, and private association terms",
        purpose: "A Membership Application provides the formal process for individuals to join the ministry, ensuring they understand and agree to the ministry's beliefs, practices, and governance structure.",
        whatItDoes: [
          "Establishes formal membership process",
          "Documents agreement to ministry beliefs and practices",
          "Creates membership records and database",
          "Ensures understanding of rights and responsibilities",
          "Provides basis for church discipline if needed"
        ],
        howToUse: [
          "Use for all new member intake",
          "Reference for membership rights questions",
          "Basis for church discipline procedures",
          "Guide for membership education",
          "Required for voting member status"
        ],
        whoSigns: [
          "Applicant for membership",
          "Ministry representative (pastor or membership coordinator)",
          "Witness signatures may be included"
        ],
        whereToFile: [
          "Keep original in membership files",
          "Maintain membership registry",
          "Store with confidential records",
          "Update membership database"
        ],
        stepByStepInstructions: [
          "Develop membership requirements and procedures",
          "Create application form with doctrinal statements",
          "Include commitment to ministry practices",
          "Add background and reference requirements",
          "Have application reviewed by leadership",
          "Conduct membership interview process",
          "Have applicant sign membership covenant",
          "Welcome new member and update records"
        ],
        draftingChecklist: [
          "Personal information and contact details",
          "Statement of faith and doctrinal agreement",
          "Commitment to ministry practices",
          "Agreement to bylaws and governance",
          "Background and reference information",
          "Membership covenant or pledge",
          "Rights and responsibilities summary",
          "Discipline and restoration procedures",
          "Signature blocks and date",
          "Processing and approval section"
        ],
        outputs: [
          "Completed membership application",
          "Membership covenant document",
          "Updated membership registry",
          "New member welcome packet",
          "Database entry creation"
        ],
        category: 'operations',
        priority: 'medium',
        estimatedTime: "2-3 hours to develop",
        requiredDocuments: ["Doctrinal statements", "Bylaws", "Membership procedures"],
        isOptional: true,
        dependsOn: ["bylaws"],
        status: 'not_started'
      }
    ]
  },
  {
    id: "banking",
    title: "Banking & Financial",
    description: "Documents required for banking, donations, and financial operations",
    items: [
      {
        id: "donation-subscription-model",
        title: "Donation Subscription Model",
        description: "Structured recurring-giving plan with tiers, acknowledgments, and donor communications",
        purpose: "A Donation Subscription Model establishes systematic recurring giving programs that provide predictable funding while building stronger relationships with supporters through structured giving tiers and regular communications.",
        whatItDoes: [
          "Creates structured recurring donation programs",
          "Establishes giving tiers and recognition levels",
          "Provides predictable funding streams",
          "Builds stronger donor relationships",
          "Facilitates proper tax acknowledgments"
        ],
        howToUse: [
          "Implement on ministry website donation page",
          "Use for donor recruitment campaigns",
          "Reference for donor communications",
          "Guide for acknowledgment procedures",
          "Basis for financial planning"
        ],
        whoSigns: [
          "Ministry treasurer or financial officer",
          "Board approval for donation policies",
          "Donors agree to subscription terms"
        ],
        whereToFile: [
          "Keep policy document in financial records",
          "Store donor agreements with development files",
          "Maintain subscription tracking system",
          "File with donation acknowledgment procedures"
        ],
        stepByStepInstructions: [
          "Research effective donation subscription models",
          "Design giving tiers and recognition levels",
          "Create subscription agreement templates",
          "Develop donor communication schedules",
          "Set up automated giving systems",
          "Establish acknowledgment procedures",
          "Train staff on subscription management",
          "Launch donor recruitment campaign"
        ],
        draftingChecklist: [
          "Giving tier structure and amounts",
          "Recognition and benefit levels",
          "Subscription agreement terms",
          "Payment processing procedures",
          "Donor communication schedule",
          "Tax acknowledgment requirements",
          "Cancellation and modification policies",
          "Data privacy and security measures",
          "Reporting and tracking systems",
          "Staff training requirements"
        ],
        outputs: [
          "Donation subscription policy",
          "Donor agreement templates",
          "Giving tier documentation",
          "Communication schedule",
          "Tracking system setup"
        ],
        category: 'banking',
        priority: 'medium',
        estimatedTime: "3-4 hours",
        requiredDocuments: ["Banking setup", "Tax exemption information"],
        isOptional: true,
        dependsOn: ["banking-resolution"],
        status: 'not_started'
      },
      {
        id: "schedule-a",
        title: "Schedule A",
        description: "Asset schedule listing all property assigned to the trust (real, personal, IP, financial)",
        purpose: "Schedule A provides a comprehensive inventory of all property and assets held by the ministry trust, creating a clear record of trust holdings and facilitating proper asset management.",
        whatItDoes: [
          "Inventories all trust property and assets",
          "Creates legal record of trust holdings",
          "Facilitates proper asset management",
          "Supports insurance and protection needs",
          "Provides basis for financial reporting"
        ],
        howToUse: [
          "Update whenever assets are added or removed",
          "Reference for insurance coverage decisions",
          "Use for financial reporting and audits",
          "Include in trust documentation packages",
          "Guide for asset protection planning"
        ],
        whoSigns: [
          "Ministry trustees or asset managers",
          "Secretary attests to accuracy",
          "Board approves significant changes"
        ],
        whereToFile: [
          "Keep original with trust documents",
          "Store with asset documentation",
          "Maintain updated versions",
          "Provide to insurance agents and accountants"
        ],
        stepByStepInstructions: [
          "Inventory all ministry property and assets",
          "Categorize by type (real, personal, intellectual, financial)",
          "Document acquisition dates and values",
          "Include identification and location information",
          "Have trustees review and approve schedule",
          "Update regularly as assets change",
          "File with trust and insurance documents",
          "Provide copies to relevant professionals"
        ],
        draftingChecklist: [
          "Real estate properties and addresses",
          "Personal property and equipment",
          "Intellectual property (trademarks, copyrights)",
          "Financial accounts and investments",
          "Vehicles and transportation equipment",
          "Office furniture and equipment",
          "Computer and technology assets",
          "Books, materials, and resources",
          "Acquisition dates and values",
          "Current condition and location"
        ],
        outputs: [
          "Comprehensive asset schedule",
          "Asset valuation documentation",
          "Insurance coverage analysis",
          "Annual update procedures",
          "Asset protection recommendations"
        ],
        category: 'banking',
        priority: 'high',
        estimatedTime: "2-4 hours",
        requiredDocuments: ["Asset inventory", "Valuation information", "Trust documents"],
        isOptional: false,
        dependsOn: ["execution-of-trust"],
        status: 'not_started'
      },
      {
        id: "banking-resolution",
        title: "Banking Resolution",
        description: "Resolution authorizing accounts, signers, and treasury procedures for ministry banking",
        purpose: "A Banking Resolution formally authorizes the opening and operation of ministry bank accounts, designates authorized signers, and establishes banking procedures and limitations.",
        whatItDoes: [
          "Authorizes opening and operation of bank accounts",
          "Designates authorized signers and their limitations",
          "Establishes banking procedures and protocols",
          "Creates legal framework for financial transactions",
          "Provides banks with required authorization documentation"
        ],
        howToUse: [
          "Present to banks when opening accounts",
          "Reference for check signing authority",
          "Use to update signer information",
          "Guide for financial transaction procedures",
          "Basis for internal financial controls"
        ],
        whoSigns: [
          "Ministry board or trustees",
          "Secretary certifies board adoption",
          "Authorized signers provide signature cards"
        ],
        whereToFile: [
          "Keep original in Ministry Record Book",
          "Provide certified copy to banks",
          "Store with financial documentation",
          "Update when signers change"
        ],
        stepByStepInstructions: [
          "Determine needed banking services and accounts",
          "Identify appropriate authorized signers",
          "Draft resolution with specific authorities and limitations",
          "Have board or trustees formally adopt resolution",
          "Have secretary certify adoption",
          "Obtain signature cards from authorized signers",
          "Present to banks with supporting documentation",
          "Update resolution when signers or authorities change"
        ],
        draftingChecklist: [
          "Types of accounts to be opened",
          "Names and titles of authorized signers",
          "Signing authorities and limitations",
          "Check signing requirements (single vs dual)",
          "Electronic banking authorizations",
          "Wire transfer and ACH authorities",
          "Safe deposit box access",
          "Account closure procedures",
          "Board adoption language",
          "Secretary certification"
        ],
        outputs: [
          "Adopted banking resolution",
          "Certified copy for banks",
          "Signature cards for signers",
          "Bank account opening documentation",
          "Internal financial procedures manual"
        ],
        category: 'banking',
        priority: 'high',
        estimatedTime: "1-2 hours",
        requiredDocuments: ["Trust documents", "EIN documentation", "Signer identification"],
        isOptional: false,
        dependsOn: ["execution-of-trust"],
        status: 'not_started'
      },
      {
        id: "sample-donation-receipt",
        title: "Sample Donation Receipt",
        description: "Standardized receipt template with required acknowledgments for contributions",
        purpose: "A Sample Donation Receipt provides a standardized template for acknowledging charitable contributions, ensuring compliance with tax regulations and providing proper documentation for donors.",
        whatItDoes: [
          "Provides standardized donation acknowledgment format",
          "Ensures compliance with tax receipt requirements",
          "Creates consistent donor communication",
          "Facilitates proper record keeping",
          "Supports donor tax deduction claims"
        ],
        howToUse: [
          "Use as template for all donation receipts",
          "Customize for different types of gifts",
          "Include in donation processing procedures",
          "Train staff on proper usage",
          "Review annually for regulatory compliance"
        ],
        whoSigns: [
          "Ministry treasurer or authorized officer",
          "Development staff may be authorized",
          "Secretary may attest to policy adoption"
        ],
        whereToFile: [
          "Keep template with financial procedures",
          "Store completed receipts with donor records",
          "Maintain annual receipt files",
          "Include in accounting documentation"
        ],
        stepByStepInstructions: [
          "Research current tax receipt requirements",
          "Design template with required elements",
          "Include ministry identification and contact information",
          "Add donation details and acknowledgment language",
          "Review template with accountant or legal counsel",
          "Train staff on proper completion procedures",
          "Test template with sample donations",
          "Update template as regulations change"
        ],
        draftingChecklist: [
          "Ministry name and address",
          "Tax-exempt status statement",
          "Donor name and address",
          "Donation amount and date",
          "Description of gift (cash or property)",
          "Statement of goods/services provided (if any)",
          "Value of goods/services provided",
          "Acknowledgment of tax-deductibility",
          "Authorized signature and title",
          "Receipt date and number"
        ],
        outputs: [
          "Standardized receipt template",
          "Staff training materials",
          "Donation processing procedures",
          "Annual receipt summaries",
          "Compliance documentation"
        ],
        category: 'banking',
        priority: 'high',
        estimatedTime: "1-2 hours",
        requiredDocuments: ["Tax exemption information", "Legal compliance research"],
        isOptional: false,
        dependsOn: ["banking-resolution"],
        status: 'not_started'
      }
    ]
  },
  {
    id: "digital",
    title: "Digital Presence",
    description: "Website, online presence, and digital ministry tools",
    items: [
      {
        id: "ministry-website",
        title: "Ministry Website",
        description: "Public site with doctrine, mission, leadership, events, donation portal, private member area, policies, and security",
        purpose: "A Ministry Website serves as the primary digital presence for the ministry, providing information about beliefs, activities, leadership, and opportunities for engagement while facilitating donations and member communications.",
        whatItDoes: [
          "Establishes professional online presence",
          "Communicates ministry mission and doctrine",
          "Provides information about leadership and activities",
          "Facilitates online donations and giving",
          "Creates private member communication area"
        ],
        howToUse: [
          "Primary source for ministry information",
          "Platform for donation collection",
          "Communication hub for members",
          "Outreach tool for evangelism",
          "Repository for teachings and resources"
        ],
        whoSigns: [
          "Board approves website content and policies",
          "Web administrator manages technical aspects",
          "Pastor or leadership approves doctrinal content"
        ],
        whereToFile: [
          "Maintain website documentation with digital assets",
          "Store policies with governance documents",
          "Keep technical documentation with IT resources",
          "File legal compliance documentation appropriately"
        ],
        stepByStepInstructions: [
          "Plan website structure and content strategy",
          "Develop doctrinal and mission content",
          "Design user-friendly interface and navigation",
          "Implement secure donation processing system",
          "Create private member area with login",
          "Develop privacy policy and terms of use",
          "Implement security measures and SSL certificates",
          "Test functionality and launch website"
        ],
        draftingChecklist: [
          "Mission and vision statements",
          "Doctrinal beliefs and practices",
          "Leadership and staff information",
          "Service times and event calendar",
          "Contact information and location",
          "Donation processing capability",
          "Private member area with login",
          "Privacy policy and terms of use",
          "Security measures and SSL certificate",
          "Mobile-responsive design"
        ],
        outputs: [
          "Functional ministry website",
          "Website documentation and procedures",
          "Privacy policy and terms of use",
          "Security implementation report",
          "Maintenance and update procedures"
        ],
        category: 'digital',
        priority: 'high',
        estimatedTime: "20-40 hours",
        requiredDocuments: ["Ministry information", "Doctrinal statements", "Legal policies"],
        isOptional: false,
        dependsOn: ["ministry-declaration", "banking-resolution"],
        status: 'not_started'
      }
    ]
  },
  {
    id: "assets",
    title: "Assets & Property",
    description: "Real estate, vehicles, and property-related documentation",
    items: [
      {
        id: "ministry-id-cards",
        title: "Ministry ID Cards",
        description: "Photo identification for ministers/staff with title, credential number, and verification details",
        purpose: "Ministry ID Cards provide official identification for ministry personnel, establishing their credentials and authority while facilitating recognition and access for ministerial duties.",
        whatItDoes: [
          "Provides official ministry identification",
          "Establishes ministerial credentials and authority",
          "Facilitates access for pastoral care duties",
          "Creates professional recognition tool",
          "Supports security and verification needs"
        ],
        howToUse: [
          "Present for hospital visitation access",
          "Use for professional identification",
          "Show for ministerial recognition",
          "Include in emergency response credentials",
          "Reference for law enforcement interactions"
        ],
        whoSigns: [
          "Ministry leadership authorizes issuance",
          "Secretary maintains ID registry",
          "Credential holder signs acknowledgment"
        ],
        whereToFile: [
          "Keep ID registry in ministry records",
          "Store credential documentation with personnel files",
          "Maintain photo and signature records",
          "File authorization documents appropriately"
        ],
        stepByStepInstructions: [
          "Design professional ID card format",
          "Establish credential numbering system",
          "Collect photos and personal information",
          "Verify ministerial credentials and authority",
          "Have ministry leadership authorize issuance",
          "Produce cards with security features",
          "Maintain registry of issued credentials",
          "Establish renewal and update procedures"
        ],
        draftingChecklist: [
          "Professional card design and layout",
          "Photo requirements and specifications",
          "Personal information fields",
          "Ministry name and logo",
          "Credential title and authority",
          "Unique identification number",
          "Issuance and expiration dates",
          "Contact information for verification",
          "Security features and anti-counterfeiting",
          "Registry and tracking system"
        ],
        outputs: [
          "Issued ministry ID cards",
          "ID registry and tracking system",
          "Authorization documentation",
          "Renewal procedures",
          "Verification contact information"
        ],
        category: 'assets',
        priority: 'low',
        estimatedTime: "2-3 hours setup",
        requiredDocuments: ["Personnel information", "Photos", "Credential verification"],
        isOptional: true,
        dependsOn: ["certificate-of-ordinance"],
        status: 'not_started'
      },
      {
        id: "ministry-exempt-license-plates",
        title: "Ministry Exempt License Plates",
        description: "Vehicle registration in the ministry's name where applicable, for non-commercial ecclesiastical use",
        purpose: "Ministry Exempt License Plates provide special vehicle registration for ministry-owned vehicles used exclusively for religious and charitable purposes, potentially qualifying for certain exemptions and recognition.",
        whatItDoes: [
          "Registers vehicles under ministry ownership",
          "Establishes religious/charitable use designation",
          "May qualify for certain tax exemptions",
          "Provides official recognition of ministry status",
          "Facilitates identification for ministry activities"
        ],
        howToUse: [
          "Apply through state DMV religious exemption programs",
          "Use for vehicles dedicated to ministry purposes",
          "Maintain proper documentation of religious use",
          "Include in ministry asset management",
          "Reference for insurance and tax purposes"
        ],
        whoSigns: [
          "Ministry officials authorized for vehicle registration",
          "Board resolution may be required",
          "DMV officials process applications"
        ],
        whereToFile: [
          "Keep registration documents with vehicle records",
          "Store with ministry asset documentation",
          "Maintain with Schedule A updates",
          "File with state compliance records"
        ],
        stepByStepInstructions: [
          "Research state religious exemption requirements",
          "Verify ministry qualification for exempt status",
          "Complete required DMV applications",
          "Provide ministry documentation and credentials",
          "Submit application with appropriate fees",
          "Obtain exempt license plates",
          "Update ministry asset records",
          "Maintain compliance with usage requirements"
        ],
        draftingChecklist: [
          "State religious exemption eligibility",
          "Ministry qualification documentation",
          "Vehicle ownership transfer to ministry",
          "Religious/charitable use affidavit",
          "DMV application completion",
          "Required fees and documentation",
          "Schedule A asset record updates",
          "Usage compliance monitoring",
          "Annual renewal requirements",
          "Insurance and liability coverage"
        ],
        outputs: [
          "Exempt license plate registration",
          "Ministry vehicle ownership documents",
          "Religious use compliance documentation",
          "Updated Schedule A records",
          "Annual renewal procedures"
        ],
        category: 'assets',
        priority: 'low',
        estimatedTime: "2-4 hours",
        requiredDocuments: ["Vehicle ownership", "Ministry credentials", "State applications"],
        isOptional: true,
        dependsOn: ["schedule-a"],
        status: 'not_started'
      },
      {
        id: "purchasing-land-transferring-property",
        title: "Purchasing Land and Transferring Property into the Ministry",
        description: "Acquisition or deed transfer process into the trust, with records and Schedule A updates",
        purpose: "Purchasing Land and Transferring Property into the Ministry establishes the legal process for acquiring real estate and transferring property ownership to the ministry trust, ensuring proper documentation and asset protection.",
        whatItDoes: [
          "Facilitates ministry real estate acquisitions",
          "Transfers property ownership to ministry trust",
          "Creates legal title and ownership records",
          "Updates ministry asset inventory",
          "Establishes proper insurance and protection"
        ],
        howToUse: [
          "Follow for all real estate acquisitions",
          "Use when property is donated to ministry",
          "Reference for property transfer procedures",
          "Guide for legal documentation requirements",
          "Basis for asset management decisions"
        ],
        whoSigns: [
          "Ministry trustees or authorized officers",
          "Property sellers or donors",
          "Real estate attorneys and agents",
          "Title company representatives"
        ],
        whereToFile: [
          "Record deeds with county recorder",
          "Store with ministry asset documentation",
          "Keep with real estate legal files",
          "Update Schedule A and insurance records"
        ],
        stepByStepInstructions: [
          "Identify property acquisition needs and opportunities",
          "Conduct property evaluation and due diligence",
          "Negotiate purchase terms or donation agreements",
          "Prepare legal documentation for ownership transfer",
          "Have ministry trustees approve acquisition",
          "Execute purchase or transfer documents",
          "Record deed with appropriate government office",
          "Update Schedule A and insurance coverage"
        ],
        draftingChecklist: [
          "Property identification and legal description",
          "Purchase agreement or donation documentation",
          "Title search and insurance",
          "Environmental and inspection reports",
          "Financing arrangements (if applicable)",
          "Deed preparation and execution",
          "County recording requirements",
          "Schedule A asset updates",
          "Insurance coverage establishment",
          "Property management procedures"
        ],
        outputs: [
          "Recorded property deed",
          "Title insurance policy",
          "Updated Schedule A",
          "Property insurance coverage",
          "Property management procedures"
        ],
        category: 'assets',
        priority: 'medium',
        estimatedTime: "10-20 hours per property",
        requiredDocuments: ["Purchase agreements", "Title documents", "Trust authorization"],
        isOptional: true,
        dependsOn: ["execution-of-trust", "schedule-a"],
        status: 'not_started'
      }
    ]
  },
  {
    id: "optional",
    title: "Optional Enhancements",
    description: "Additional documents and systems that can enhance ministry operations",
    items: [
      {
        id: "family-legacy-ministry-goals",
        title: "Establishing a Family Legacy and Ministry Goals",
        description: "Written legacy plan, mission objectives, roles, milestones, and multigenerational stewardship",
        purpose: "Establishing a Family Legacy and Ministry Goals creates a comprehensive plan for long-term ministry sustainability and impact, ensuring continuity across generations and alignment with founding vision.",
        whatItDoes: [
          "Defines long-term ministry vision and goals",
          "Establishes multigenerational stewardship plans",
          "Creates succession and leadership development framework",
          "Aligns family and ministry objectives",
          "Provides guidance for future decision-making"
        ],
        howToUse: [
          "Reference for strategic planning sessions",
          "Guide for leadership development decisions",
          "Basis for succession planning",
          "Framework for family involvement",
          "Tool for evaluating ministry direction"
        ],
        whoSigns: [
          "Ministry founders and leadership",
          "Family members involved in ministry",
          "Board or trustees as appropriate"
        ],
        whereToFile: [
          "Keep with strategic planning documents",
          "Store with governance and succession materials",
          "Maintain with family and ministry records",
          "Include in leadership development resources"
        ],
        stepByStepInstructions: [
          "Assess current ministry status and achievements",
          "Define long-term vision and impact goals",
          "Identify family involvement and succession plans",
          "Develop leadership development strategies",
          "Create milestone and measurement systems",
          "Involve family members in planning process",
          "Document plans and implementation strategies",
          "Establish regular review and update procedures"
        ],
        draftingChecklist: [
          "Ministry mission and vision statements",
          "Long-term impact goals and objectives",
          "Family involvement and role definitions",
          "Succession planning framework",
          "Leadership development strategies",
          "Financial stewardship plans",
          "Property and asset legacy provisions",
          "Milestone and measurement systems",
          "Implementation timeline",
          "Review and update procedures"
        ],
        outputs: [
          "Comprehensive legacy plan document",
          "Family and ministry alignment strategy",
          "Succession planning framework",
          "Leadership development program",
          "Implementation and monitoring system"
        ],
        category: 'optional',
        priority: 'medium',
        estimatedTime: "8-12 hours",
        requiredDocuments: ["Ministry history", "Family vision", "Strategic planning resources"],
        isOptional: true,
        dependsOn: ["ministry-declaration", "bylaws"],
        status: 'not_started'
      },
      {
        id: "zero-percent-interest-loans",
        title: "Establishing 0% Interest Loans up to $9,999",
        description: "Private, documented ministry-to-business loan process with terms, ledger entries, and compliance notes",
        purpose: "Establishing 0% Interest Loans provides a framework for the ministry to offer charitable lending services to support business development and community needs while maintaining proper documentation and compliance.",
        whatItDoes: [
          "Creates framework for charitable lending program",
          "Establishes loan documentation and procedures",
          "Provides community business development support",
          "Maintains proper financial records and compliance",
          "Supports ministry's charitable mission"
        ],
        howToUse: [
          "Implement as part of community outreach program",
          "Use for supporting ministry-related businesses",
          "Reference for loan application processing",
          "Guide for financial record keeping",
          "Basis for regulatory compliance"
        ],
        whoSigns: [
          "Ministry treasurer or financial officer",
          "Board authorization for lending program",
          "Loan recipients sign agreements"
        ],
        whereToFile: [
          "Keep loan documents with financial records",
          "Store policies with board governance materials",
          "Maintain loan registry and tracking system",
          "File compliance documentation appropriately"
        ],
        stepByStepInstructions: [
          "Research legal requirements for charitable lending",
          "Develop loan policies and procedures",
          "Create loan application and agreement forms",
          "Establish loan evaluation and approval process",
          "Set up tracking and record-keeping systems",
          "Train staff on loan administration",
          "Launch lending program with pilot loans",
          "Monitor compliance and program effectiveness"
        ],
        draftingChecklist: [
          "Loan program policies and procedures",
          "Application and evaluation criteria",
          "Loan agreement templates",
          "Regulatory compliance requirements",
          "Record-keeping and reporting systems",
          "Default and collection procedures",
          "Board oversight and approval processes",
          "Financial tracking and ledger entries",
          "Annual program evaluation",
          "Legal and tax compliance"
        ],
        outputs: [
          "Loan program policy manual",
          "Application and agreement forms",
          "Tracking and record-keeping system",
          "Compliance documentation",
          "Program evaluation procedures"
        ],
        category: 'optional',
        priority: 'low',
        estimatedTime: "6-10 hours",
        requiredDocuments: ["Legal research", "Financial policies", "Board authorization"],
        isOptional: true,
        dependsOn: ["banking-resolution"],
        status: 'not_started'
      }
    ]
  }
];

const MinistryLegitimation = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<MinistryChecklistItem | null>(null);
  const [showProgress, setShowProgress] = useState(true);

  // Calculate progress statistics
  const progress = useMemo((): MinistryProgress => {
    const allItems = ministryChecklistData.flatMap(section => section.items);
    const totalItems = allItems.length;
    const completedItems = allItems.filter(item => item.status === 'completed').length;
    const inProgressItems = allItems.filter(item => item.status === 'in_progress').length;
    const notStartedItems = allItems.filter(item => item.status === 'not_started').length;
    const notApplicableItems = allItems.filter(item => item.status === 'not_applicable').length;
    const overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    const categoryProgress = ministryChecklistData.reduce((acc, section) => {
      const categoryItems = section.items;
      const categoryCompleted = categoryItems.filter(item => item.status === 'completed').length;
      acc[section.id] = {
        total: categoryItems.length,
        completed: categoryCompleted,
        progress: categoryItems.length > 0 ? Math.round((categoryCompleted / categoryItems.length) * 100) : 0
      };
      return acc;
    }, {} as MinistryProgress['categoryProgress']);

    return {
      totalItems,
      completedItems,
      inProgressItems,
      notStartedItems,
      notApplicableItems,
      overallProgress,
      categoryProgress
    };
  }, []);

  // Filter items based on search and filters
  const filteredSections = useMemo(() => {
    return ministryChecklistData.map(section => ({
      ...section,
      items: section.items.filter(item => {
        const matchesSearch = searchTerm === "" || 
          item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.purpose.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
        const matchesStatus = selectedStatus === "all" || item.status === selectedStatus;
        const matchesPriority = selectedPriority === "all" || item.priority === selectedPriority;
        
        return matchesSearch && matchesCategory && matchesStatus && matchesPriority;
      })
    })).filter(section => section.items.length > 0);
  }, [searchTerm, selectedCategory, selectedStatus, selectedPriority]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'not_applicable':
        return <div className="w-4 h-4 rounded-full bg-gray-400" />;
      default:
        return <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'not_applicable':
        return <Badge className="bg-gray-100 text-gray-800">N/A</Badge>;
      default:
        return <Badge variant="secondary">Not Started</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High Priority</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800">Medium Priority</Badge>;
      case 'low':
        return <Badge variant="outline">Low Priority</Badge>;
      default:
        return <Badge variant="outline">Normal</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'foundational':
        return <Shield className="w-5 h-5" />;
      case 'governance':
        return <Settings className="w-5 h-5" />;
      case 'operations':
        return <Users className="w-5 h-5" />;
      case 'banking':
        return <CreditCard className="w-5 h-5" />;
      case 'digital':
        return <Globe className="w-5 h-5" />;
      case 'assets':
        return <Building className="w-5 h-5" />;
      case 'optional':
        return <BookOpen className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const handleStatusChange = (itemId: string, newStatus: string) => {
    // In a real implementation, this would update the database
    toast({
      title: "Status Updated",
      description: `Item status changed to ${newStatus.replace('_', ' ')}`,
    });
  };

  const handleUploadComplete = (itemId: string) => {
    toast({
      title: "Document Uploaded",
      description: "Document has been successfully uploaded and attached to this item",
    });
  };

  return (
    <PortalLayout pageTitle="Ministry Legitimation">
      <div className="space-y-6">
        {/* Progress Overview */}
        {showProgress && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-card-foreground" data-testid="text-progress-title">
                  Ministry Legitimation Progress
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowProgress(false)}
                  data-testid="button-hide-progress"
                >
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-2xl font-bold" data-testid="text-overall-progress">
                      {progress.overallProgress}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {progress.completedItems} of {progress.totalItems} items completed
                    </div>
                  </div>
                  <div className="w-32">
                    <Progress value={progress.overallProgress} className="h-2" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-600" data-testid="text-completed-count">
                      {progress.completedItems}
                    </div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-blue-600" data-testid="text-in-progress-count">
                      {progress.inProgressItems}
                    </div>
                    <div className="text-xs text-muted-foreground">In Progress</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-600" data-testid="text-not-started-count">
                      {progress.notStartedItems}
                    </div>
                    <div className="text-xs text-muted-foreground">Not Started</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-400" data-testid="text-not-applicable-count">
                      {progress.notApplicableItems}
                    </div>
                    <div className="text-xs text-muted-foreground">N/A</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search and Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search ministry checklist items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-auto min-w-[120px]" data-testid="select-category">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="foundational">Foundational</SelectItem>
                    <SelectItem value="governance">Governance</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="banking">Banking</SelectItem>
                    <SelectItem value="digital">Digital</SelectItem>
                    <SelectItem value="assets">Assets</SelectItem>
                    <SelectItem value="optional">Optional</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-auto min-w-[120px]" data-testid="select-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="not_applicable">N/A</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                  <SelectTrigger className="w-auto min-w-[120px]" data-testid="select-priority">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ministry Checklist Sections */}
        <div className="space-y-6" data-testid="container-checklist-sections">
          {filteredSections.map((section) => (
            <Card key={section.id} className="bg-card border-border">
              <CardHeader className="border-b border-border">
                <div className="flex items-center gap-3">
                  {getCategoryIcon(section.id)}
                  <div className="flex-1">
                    <CardTitle className="text-card-foreground" data-testid={`text-section-title-${section.id}`}>
                      {section.title}
                    </CardTitle>
                    <p className="text-muted-foreground mt-1" data-testid={`text-section-description-${section.id}`}>
                      {section.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {progress.categoryProgress[section.id]?.completed || 0} / {progress.categoryProgress[section.id]?.total || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">completed</div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {section.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-6 hover:bg-muted/20 transition-colors"
                      data-testid={`item-container-${item.id}`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="mt-1">
                            {getStatusIcon(item.status)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-start gap-2 mb-2">
                              <h3 className="font-medium text-card-foreground" data-testid={`text-item-title-${item.id}`}>
                                {item.title}
                              </h3>
                              {getPriorityBadge(item.priority)}
                              {!item.isOptional && (
                                <Badge variant="outline" className="text-xs">Required</Badge>
                              )}
                            </div>
                            
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2" data-testid={`text-item-description-${item.id}`}>
                              {item.description}
                            </p>
                            
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              {getStatusBadge(item.status)}
                              <Badge variant="outline" className="text-xs">
                                {item.estimatedTime}
                              </Badge>
                              {item.dependsOn && item.dependsOn.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {item.dependsOn.length} prerequisite{item.dependsOn.length !== 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                            
                            {item.notes && (
                              <div className="mt-2 p-2 bg-muted/20 rounded text-xs text-muted-foreground" data-testid={`text-item-notes-${item.id}`}>
                                <strong>Notes:</strong> {item.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedItem(item)}
                                data-testid={`button-view-details-${item.id}`}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View Details
                              </Button>
                            </DialogTrigger>
                          </Dialog>

                          {item.status === 'not_started' && (
                            <Button
                              size="sm"
                              onClick={() => handleStatusChange(item.id, 'in_progress')}
                              data-testid={`button-start-item-${item.id}`}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Start
                            </Button>
                          )}

                          {item.status === 'in_progress' && (
                            <>
                              <ObjectUploader
                                maxNumberOfFiles={5}
                                maxFileSize={10485760}
                                onGetUploadParameters={() => Promise.resolve({
                                  method: "PUT" as const,
                                  url: "https://example.com/upload"
                                })}
                                onComplete={(result) => handleUploadComplete(item.id)}
                                buttonClassName="h-8 px-3 text-sm"
                              >
                                <Upload className="w-4 h-4 mr-1" />
                                Upload Docs
                              </ObjectUploader>
                              
                              <Button
                                size="sm"
                                onClick={() => handleStatusChange(item.id, 'completed')}
                                data-testid={`button-complete-item-${item.id}`}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Complete
                              </Button>
                            </>
                          )}

                          {item.status === 'completed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              data-testid={`button-view-documents-${item.id}`}
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              View Docs
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detailed Item Modal */}
        {selectedItem && (
          <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle data-testid={`text-modal-title-${selectedItem.id}`}>
                  {selectedItem.title}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {getStatusBadge(selectedItem.status)}
                  {getPriorityBadge(selectedItem.priority)}
                  <Badge variant="outline">{selectedItem.estimatedTime}</Badge>
                </div>

                <Accordion type="multiple" className="w-full">
                  <AccordionItem value="purpose">
                    <AccordionTrigger>Purpose</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm text-muted-foreground">{selectedItem.purpose}</p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="what-it-does">
                    <AccordionTrigger>What It Does</AccordionTrigger>
                    <AccordionContent>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        {selectedItem.whatItDoes.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="how-to-use">
                    <AccordionTrigger>How to Use</AccordionTrigger>
                    <AccordionContent>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        {selectedItem.howToUse.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="who-signs">
                    <AccordionTrigger>Who Signs and Witnesses</AccordionTrigger>
                    <AccordionContent>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        {selectedItem.whoSigns.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="where-to-file">
                    <AccordionTrigger>Where and How to File/Record</AccordionTrigger>
                    <AccordionContent>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        {selectedItem.whereToFile.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="instructions">
                    <AccordionTrigger>Step-by-Step Instructions</AccordionTrigger>
                    <AccordionContent>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                        {selectedItem.stepByStepInstructions.map((instruction, index) => (
                          <li key={index}>{instruction}</li>
                        ))}
                      </ol>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="checklist">
                    <AccordionTrigger>Drafting Checklist</AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-1 text-sm">
                        {selectedItem.draftingChecklist.map((item, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <span className="text-muted-foreground">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="outputs">
                    <AccordionTrigger>Expected Outputs</AccordionTrigger>
                    <AccordionContent>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        {selectedItem.outputs.map((output, index) => (
                          <li key={index}>{output}</li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>

                  {selectedItem.practicalCautions && selectedItem.practicalCautions.length > 0 && (
                    <AccordionItem value="cautions">
                      <AccordionTrigger>Practical Cautions</AccordionTrigger>
                      <AccordionContent>
                        <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                          {selectedItem.practicalCautions.map((caution, index) => (
                            <li key={index}>{caution}</li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>

                {selectedItem.notes && (
                  <div className="mt-4 p-3 bg-muted/20 rounded">
                    <h4 className="font-medium mb-2">Current Notes</h4>
                    <p className="text-sm text-muted-foreground">{selectedItem.notes}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-4">
                  {selectedItem.status === 'not_started' && (
                    <Button onClick={() => handleStatusChange(selectedItem.id, 'in_progress')}>
                      <Play className="w-4 h-4 mr-2" />
                      Start This Item
                    </Button>
                  )}
                  
                  {selectedItem.status === 'in_progress' && (
                    <Button onClick={() => handleStatusChange(selectedItem.id, 'completed')}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark Complete
                    </Button>
                  )}
                  
                  <Button variant="outline" onClick={() => setSelectedItem(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </PortalLayout>
  );
};

export default MinistryLegitimation;