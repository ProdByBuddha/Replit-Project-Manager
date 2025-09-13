# UCC Storage Interface Extension Design

## Overview
This document describes the comprehensive storage interface extensions needed to integrate UCC operations with the existing storage system. The design follows established patterns from US Code operations while adapting to UCC's unique hierarchical structure.

## Analysis of Existing Storage Patterns

### Current US Code Storage Operations
From the existing `server/storage.ts`, I can see these patterns:
- **CRUD Operations**: Create, read, update, delete for each entity type
- **Hierarchical Queries**: Get by title, get by title and chapter, etc.
- **Search Operations**: Complex search with filters, metadata, and ranking
- **Job Management**: Indexing job creation and status tracking
- **Bulk Operations**: Initialize, update multiple records
- **Cross-Reference Management**: Link management between entities

### Consistency Requirements
- Follow same naming conventions (`get`, `create`, `update`, `delete`)
- Use same error handling patterns
- Maintain same return type patterns with joins
- Follow same foreign key validation approaches
- Use same indexing and search patterns

## UCC Storage Interface Extensions

### UCC Article Operations

```typescript
// UCC Article operations
createUccArticle(article: InsertUccArticle): Promise<UccArticle>;
getUccArticle(articleId: string): Promise<UccArticle | undefined>;
getUccArticleByNumber(articleNumber: string): Promise<UccArticle | undefined>;
getAllUccArticles(): Promise<UccArticle[]>;
getUccArticleWithParts(articleId: string): Promise<(UccArticle & { parts: UccPart[] }) | undefined>;
getUccArticleWithFullStructure(articleId: string): Promise<(UccArticle & { 
  parts: (UccPart & { sections: UccSection[] })[];
  sections: UccSection[];
}) | undefined>;
updateUccArticle(articleId: string, updates: Partial<InsertUccArticle>): Promise<UccArticle>;
deleteUccArticle(articleId: string): Promise<void>;
```

### UCC Part Operations

```typescript
// UCC Part operations
createUccPart(part: InsertUccPart): Promise<UccPart>;
getUccPart(partId: string): Promise<UccPart | undefined>;
getPartsByArticle(articleId: string): Promise<UccPart[]>;
getUccPartWithSections(partId: string): Promise<(UccPart & { sections: UccSection[] }) | undefined>;
getUccPartWithSubparts(partId: string): Promise<(UccPart & { subParts: UccPart[] }) | undefined>;
updateUccPart(partId: string, updates: Partial<InsertUccPart>): Promise<UccPart>;
deleteUccPart(partId: string): Promise<void>;
getPartHierarchy(partId: string): Promise<UccPart[]>; // Get all parent parts up to article
```

### UCC Section Operations

```typescript
// UCC Section operations
createUccSection(section: InsertUccSection): Promise<UccSection>;
getUccSection(sectionId: string): Promise<UccSection | undefined>;
getUccSectionByCitation(citation: string): Promise<UccSection | undefined>;
getUccSectionByShortCitation(shortCitation: string): Promise<UccSection | undefined>;
getSectionsByArticle(articleId: string): Promise<UccSection[]>;
getSectionsByPart(partId: string): Promise<UccSection[]>;
getUccSectionWithSubsections(sectionId: string): Promise<(UccSection & { subsections: UccSubsection[] }) | undefined>;
getUccSectionWithFullContext(sectionId: string): Promise<(UccSection & { 
  article: UccArticle;
  part?: UccPart;
  subsections: UccSubsection[];
  definitions: UccDefinition[];
  crossReferencesFrom: (UccCrossReference & { toSection?: UccSection })[];
  crossReferencesTo: (UccCrossReference & { fromSection: UccSection })[];
}) | undefined>;
updateUccSection(sectionId: string, updates: Partial<InsertUccSection>): Promise<UccSection>;
deleteUccSection(sectionId: string): Promise<void>;
getSectionsByCitationPattern(pattern: string): Promise<UccSection[]>; // e.g., "2-*" for all Article 2 sections
```

### UCC Subsection Operations

```typescript
// UCC Subsection operations
createUccSubsection(subsection: InsertUccSubsection): Promise<UccSubsection>;
getUccSubsection(subsectionId: string): Promise<UccSubsection | undefined>;
getSubsectionsBySection(sectionId: string): Promise<UccSubsection[]>;
getUccSubsectionWithContext(subsectionId: string): Promise<(UccSubsection & { 
  section: UccSection & { article: UccArticle };
  parentSubsection?: UccSubsection;
  childSubsections: UccSubsection[];
}) | undefined>;
updateUccSubsection(subsectionId: string, updates: Partial<InsertUccSubsection>): Promise<UccSubsection>;
deleteUccSubsection(subsectionId: string): Promise<void>;
getSubsectionHierarchy(subsectionId: string): Promise<UccSubsection[]>; // Get all parent subsections
```

### UCC Cross-Reference Operations

```typescript
// UCC Cross Reference operations
createUccCrossReference(reference: InsertUccCrossReference): Promise<UccCrossReference>;
getCrossReferencesForSection(sectionId: string): Promise<(UccCrossReference & { 
  toSection?: UccSection;
  toSubsection?: UccSubsection;
})[]>;
getCrossReferencesFromSection(sectionId: string): Promise<(UccCrossReference & { 
  fromSection: UccSection;
  fromSubsection?: UccSubsection;
})[]>;
getUccToUscCrossReferences(): Promise<UccCrossReference[]>; // UCC sections referencing US Code
getUscToUccCrossReferences(): Promise<UccCrossReference[]>; // US Code sections referencing UCC
getCrossReferencesByType(referenceType: string): Promise<(UccCrossReference & { 
  fromSection: UccSection;
  toSection?: UccSection;
})[]>;
deleteCrossReference(referenceId: string): Promise<void>;
bulkCreateCrossReferences(references: InsertUccCrossReference[]): Promise<UccCrossReference[]>;
```

### UCC Definition Operations

```typescript
// UCC Definition operations
createUccDefinition(definition: InsertUccDefinition): Promise<UccDefinition>;
getUccDefinition(definitionId: string): Promise<UccDefinition | undefined>;
getDefinitionsByTerm(term: string): Promise<(UccDefinition & { 
  section: UccSection & { article: UccArticle };
})[]>;
getDefinitionsBySection(sectionId: string): Promise<UccDefinition[]>;
getDefinitionsByArticle(articleId: string): Promise<(UccDefinition & { 
  section: UccSection;
})[]>;
getGlobalUccDefinitions(): Promise<(UccDefinition & { 
  section: UccSection & { article: UccArticle };
})[]>;
searchUccDefinitions(query: string): Promise<(UccDefinition & { 
  section: UccSection & { article: UccArticle };
  relevanceScore?: number;
})[]>;
updateUccDefinition(definitionId: string, updates: Partial<InsertUccDefinition>): Promise<UccDefinition>;
deleteUccDefinition(definitionId: string): Promise<void>;
getDefinitionConflicts(): Promise<{
  term: string;
  definitions: (UccDefinition & { section: UccSection & { article: UccArticle } })[];
}[]>; // Find terms with conflicting definitions
```

### UCC Search Operations

```typescript
// UCC Search operations
searchUccSections(query: string, options?: {
  articleNumbers?: string[];
  limit?: number;
  offset?: number;
  searchType?: 'fulltext' | 'citation' | 'keyword' | 'definition';
  topics?: string[];
  commercialRelevance?: 'low' | 'medium' | 'high';
}): Promise<{
  sections: (UccSection & { 
    article: UccArticle;
    part?: UccPart;
    relevanceScore?: number;
    commercialRelevance?: number;
    matchedDefinitions?: UccDefinition[];
  })[];
  totalCount: number;
  searchMetadata: {
    query: string;
    searchType: string;
    executionTime: number;
    suggestedTerms?: string[];
  };
}>;

searchUnifiedLegal(query: string, options?: {
  sources?: ('ucc' | 'uscode')[];
  limit?: number;
  offset?: number;
  legalDomain?: 'commercial' | 'criminal' | 'civil' | 'constitutional';
}): Promise<{
  results: {
    source: 'ucc' | 'uscode';
    sections: any[]; // Union type of UCC and USC sections
    relevanceScore: number;
  }[];
  totalCount: number;
  crossReferences: {
    uccToUsc: UccCrossReference[];
    uscToUcc: UccCrossReference[];
  };
}>;

getRelatedUccSections(sectionId: string, options?: {
  includeDefinitions?: boolean;
  includeCrossReferences?: boolean;
  maxResults?: number;
}): Promise<(UccSection & { 
  article: UccArticle;
  relationshipType: 'definition' | 'cross_reference' | 'same_article' | 'semantic_similarity';
  relationshipScore: number;
})[]>;
```

### UCC Search Index Operations

```typescript
// UCC Search Index operations
createUccSearchIndex(searchIndex: InsertUccSearchIndex): Promise<UccSearchIndex>;
updateUccSearchIndex(sectionId: string, updates: Partial<InsertUccSearchIndex>): Promise<UccSearchIndex>;
getUccSearchIndexBySection(sectionId: string): Promise<UccSearchIndex | undefined>;
rebuildUccSearchIndex(options?: {
  articleNumbers?: string[];
  forceRebuild?: boolean;
}): Promise<{
  sectionsProcessed: number;
  indexesCreated: number;
  errors: number;
}>;
optimizeUccSearchIndex(): Promise<{
  vectorsOptimized: number;
  keywordsExtracted: number;
  topicsClassified: number;
}>;
```

### UCC Indexing Job Operations

```typescript
// UCC Indexing Job operations
createUccIndexingJob(job: InsertUccIndexingJob): Promise<UccIndexingJob>;
getUccIndexingJob(jobId: string): Promise<UccIndexingJob | undefined>;
getActiveUccIndexingJobs(): Promise<UccIndexingJob[]>;
getUccIndexingJobsByType(jobType: string): Promise<UccIndexingJob[]>;
getUccIndexingJobsByStatus(status: string): Promise<UccIndexingJob[]>;
updateUccIndexingJobStatus(jobId: string, status: string, progress?: any, stats?: any): Promise<UccIndexingJob>;
updateUccIndexingJobError(jobId: string, errorMessage: string): Promise<UccIndexingJob>;
completeUccIndexingJob(jobId: string, stats?: any): Promise<UccIndexingJob>;
cleanupOldUccIndexingJobs(olderThanDays: number): Promise<number>;
getUccIndexingJobStats(timeRange?: { start: Date; end: Date }): Promise<{
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageExecutionTime: number;
  jobsByType: Record<string, number>;
}>;
```

### Unified Operations (UCC + US Code)

```typescript
// Unified search and cross-reference operations
getUnifiedLegalContent(query: string, options?: {
  includeSources?: ('ucc' | 'uscode')[];
  legalDomain?: string;
  contextRadius?: number; // Include related sections
}): Promise<{
  uccResults: (UccSection & { article: UccArticle })[];
  uscResults: (UsCodeSection & { title: UsCodeTitle })[];
  crossReferences: {
    uccToUsc: UccCrossReference[];
    uscToUcc: UccCrossReference[];
  };
  definitions: {
    uccDefinitions: UccDefinition[];
    relatedTerms: string[];
  };
}>;

createUnifiedCrossReference(from: {
  source: 'ucc' | 'uscode';
  sectionId: string;
}, to: {
  source: 'ucc' | 'uscode';
  sectionId?: string;
  citation?: string;
}, referenceType: string, context?: string): Promise<any>; // Creates cross-ref in appropriate table

getCommercialLawContext(query: string): Promise<{
  primarySources: {
    uccSections: (UccSection & { article: UccArticle })[];
    uscSections: (UsCodeSection & { title: UsCodeTitle })[];
  };
  definitions: UccDefinition[];
  practiceAreas: string[];
  suggestedQueries: string[];
}>;
```

### Bulk and Maintenance Operations

```typescript
// Bulk operations for efficient data management
initializeUccContent(): Promise<{
  articlesCreated: number;
  partsCreated: number;
  sectionsCreated: number;
  definitionsExtracted: number;
}>;

bulkUpdateUccContent(updates: {
  articles?: Partial<InsertUccArticle>[];
  sections?: Partial<InsertUccSection>[];
  definitions?: Partial<InsertUccDefinition>[];
}): Promise<{
  articlesUpdated: number;
  sectionsUpdated: number;
  definitionsUpdated: number;
}>;

validateUccDataIntegrity(): Promise<{
  missingCrossReferences: string[];
  orphanedRecords: string[];
  duplicateDefinitions: string[];
  brokenHierarchy: string[];
  recommendations: string[];
}>;

syncUccWithSources(options?: {
  sources?: string[];
  articles?: string[];
  forceSync?: boolean;
}): Promise<{
  sectionsUpdated: number;
  sectionsCreated: number;
  definitionsUpdated: number;
  crossReferencesCreated: number;
  errors: string[];
}>;
```

### Statistics and Analytics Operations

```typescript
// UCC-specific analytics
getUccUsageStats(timeRange?: { start: Date; end: Date }): Promise<{
  mostSearchedSections: (UccSection & { searchCount: number })[];
  popularArticles: (UccArticle & { searchCount: number })[];
  commonDefinitionLookups: (UccDefinition & { lookupCount: number })[];
  searchTrends: {
    period: string;
    queries: number;
    topKeywords: string[];
  }[];
}>;

getCommercialLawInsights(): Promise<{
  transactionTypes: {
    type: string;
    relevantSections: UccSection[];
    definitionCount: number;
  }[];
  industryRelevance: {
    industry: string;
    applicableSections: UccSection[];
    riskFactors: string[];
  }[];
  complianceGaps: {
    area: string;
    missingSections: string[];
    recommendations: string[];
  }[];
}>;
```

## Integration Strategy

### 1. Extend Existing IStorage Interface

```typescript
export interface IStorage extends ExistingInterface {
  // Add all UCC operations to the existing interface
  // Maintain backward compatibility
  // Follow same patterns as US Code operations
  
  // UCC Article Operations
  createUccArticle: (article: InsertUccArticle) => Promise<UccArticle>;
  getUccArticle: (articleId: string) => Promise<UccArticle | undefined>;
  // ... all other UCC operations
  
  // Unified Operations
  searchUnifiedLegal: (...) => Promise<...>;
  getCommercialLawContext: (...) => Promise<...>;
}
```

### 2. Database Transaction Management

```typescript
// Ensure all UCC operations use proper transaction handling
// Follow existing patterns for error handling and rollbacks
// Maintain referential integrity across UCC hierarchy

class PostgresStorage implements IStorage {
  // UCC operations implementation with proper transaction handling
  async createUccArticle(article: InsertUccArticle): Promise<UccArticle> {
    return await db.transaction(async (tx) => {
      // Validation
      const existing = await tx.select().from(uccArticles).where(eq(uccArticles.number, article.number));
      if (existing.length > 0) {
        throw new Error(`UCC Article ${article.number} already exists`);
      }
      
      // Creation
      const [created] = await tx.insert(uccArticles).values(article).returning();
      return created;
    });
  }
  
  // Similar pattern for all other operations
}
```

### 3. Error Handling and Validation

- **Consistent Error Types**: Use same error patterns as US Code operations
- **Validation Rules**: Article numbers, citation formats, hierarchy consistency
- **Foreign Key Validation**: Ensure referenced entities exist before creation
- **Duplicate Prevention**: Check for existing records before insertion

### 4. Performance Optimization

- **Query Optimization**: Use appropriate indexes for common queries
- **Batch Operations**: Implement efficient bulk operations for large datasets
- **Cache Strategy**: Cache frequently accessed articles and definitions
- **Lazy Loading**: Implement optional deep loading for complex queries

### 5. Migration Strategy

```typescript
// Database migration to add UCC tables
export async function addUccTables() {
  // Create all UCC tables with proper constraints
  // Add indexes for optimal query performance
  // Create initial data if needed
  // Update any existing cross-reference tables
}
```

## Implementation Priority

### Phase 1: Core Operations (Week 1)
- UCC Article, Part, Section, Subsection CRUD operations
- Basic search functionality
- Indexing job management

### Phase 2: Advanced Features (Week 2)
- Cross-reference management
- Definition extraction and management
- Search index operations

### Phase 3: Integration Features (Week 3)
- Unified search across UCC and US Code
- Commercial law context operations
- Analytics and insights

### Phase 4: Optimization (Week 4)
- Performance tuning
- Advanced analytics
- Data validation and integrity checks

## Testing Strategy

- **Unit Tests**: Each storage operation individually
- **Integration Tests**: Complex queries with joins
- **Performance Tests**: Large dataset operations
- **Data Integrity Tests**: Referential integrity validation
- **Migration Tests**: Schema changes and data migrations

This storage interface extension design ensures seamless integration with the existing system while providing comprehensive UCC functionality following established patterns and best practices.