# UCC Database Schema Design

## Overview
This document describes the comprehensive database schema design for integrating the Uniform Commercial Code (UCC) with the existing legal research system. The design follows the established patterns from the US Code indexing system while adapting to UCC's unique hierarchical structure.

## UCC Structure Analysis Summary

### UCC Hierarchy:
- **Articles** (1, 2, 2A, 3, 4, 4A, 5, 6, 7, 8, 9, 12) - Top level divisions
- **Parts** within articles (e.g., Article 1 has 3 parts, Article 2 has 7 parts)
- **Subparts** within parts (optional, used in complex articles like Article 9)
- **Sections** within parts/subparts (numbered as Article-Section, e.g., 1-101, 2-201, 9-601)
- **Subsections** within sections (lettered (a), (b), (c), etc.)

### Key Differences from US Code:
1. **Numbering System**: UCC uses "Article-Section" (e.g., 1-101) vs USC "Title USC Section" (e.g., 15 USC 1001)
2. **Hierarchical Depth**: UCC has Parts/Subparts vs USC Chapters
3. **Cross-References**: Extensive internal cross-referencing within UCC
4. **Update Frequency**: UCC updated less frequently than USC (major revisions every few years)

## Proposed Database Schema

### Core UCC Tables

```typescript
// UCC Articles table - represents the 12 main UCC articles
export const uccArticles = pgTable("ucc_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: varchar("number").notNull().unique(), // Article number (1, 2, 2A, 3, 4, 4A, 5, 6, 7, 8, 9, 12)
  name: varchar("name").notNull(),
  description: text("description"),
  scope: text("scope"), // Article scope and applicability
  yearEnacted: integer("year_enacted"), // Original enactment year
  yearLastRevised: integer("year_last_revised"), // Most recent revision year
  revisionStatus: varchar("revision_status"), // 'current', 'superseded', 'withdrawn'
  lastIndexed: timestamp("last_indexed").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_ucc_articles_number").on(table.number),
  index("IDX_ucc_articles_year_revised").on(table.yearLastRevised),
  index("IDX_ucc_articles_status").on(table.revisionStatus),
]);

// UCC Parts table - represents parts within articles
export const uccParts = pgTable("ucc_parts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull(),
  number: varchar("number").notNull(), // Part number (1, 2, 3, etc.)
  name: varchar("name").notNull(),
  description: text("description"),
  parentPartId: varchar("parent_part_id"), // For subparts (nullable)
  order: integer("order").notNull(), // Ordering within article
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.articleId], foreignColumns: [uccArticles.id] }),
  foreignKey({ columns: [table.parentPartId], foreignColumns: [uccParts.id] }),
  index("IDX_ucc_parts_article").on(table.articleId),
  index("IDX_ucc_parts_number").on(table.number),
  index("IDX_ucc_parts_parent").on(table.parentPartId),
  index("IDX_ucc_parts_order").on(table.order),
  unique("UNQ_ucc_parts_article_number").on(table.articleId, table.number),
]);

// UCC Sections table - individual UCC sections with full content
export const uccSections = pgTable("ucc_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull(),
  partId: varchar("part_id"), // Optional - some sections may be directly under articles
  number: varchar("number").notNull(), // Section number (101, 201, 601, etc.)
  citation: varchar("citation").notNull().unique(), // Full citation (e.g., "UCC 1-101", "UCC 2-201")
  shortCitation: varchar("short_citation").notNull(), // Short form (e.g., "1-101", "2-201")
  heading: varchar("heading").notNull(),
  content: text("content").notNull(),
  htmlContent: text("html_content"), // Processed HTML with hyperlinks
  plainTextContent: text("plain_text_content"), // Stripped plain text for search
  contentVector: text("content_vector"), // Full-text search vector for PostgreSQL
  subsectionCount: integer("subsection_count").default(0), // Number of subsections
  lastModified: timestamp("last_modified"),
  sourceUrl: varchar("source_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.articleId], foreignColumns: [uccArticles.id] }),
  foreignKey({ columns: [table.partId], foreignColumns: [uccParts.id] }),
  index("IDX_ucc_sections_article").on(table.articleId),
  index("IDX_ucc_sections_part").on(table.partId),
  index("IDX_ucc_sections_number").on(table.number),
  index("IDX_ucc_sections_citation").on(table.citation),
  index("IDX_ucc_sections_short_citation").on(table.shortCitation),
  // Full-text search indexes
  index("IDX_ucc_sections_content_text").on(table.content),
  index("IDX_ucc_sections_heading_text").on(table.heading),
  index("IDX_ucc_sections_last_modified").on(table.lastModified),
]);

// UCC Subsections table - individual subsections within sections
export const uccSubsections = pgTable("ucc_subsections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: varchar("section_id").notNull(),
  letter: varchar("letter").notNull(), // Subsection letter (a, b, c, etc.)
  number: varchar("number"), // Optional numeric subsection (1, 2, 3, etc.)
  content: text("content").notNull(),
  htmlContent: text("html_content"), // Processed HTML with hyperlinks
  order: integer("order").notNull(), // Order within section
  parentSubsectionId: varchar("parent_subsection_id"), // For nested subsections
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.sectionId], foreignColumns: [uccSections.id] }),
  foreignKey({ columns: [table.parentSubsectionId], foreignColumns: [uccSubsections.id] }),
  index("IDX_ucc_subsections_section").on(table.sectionId),
  index("IDX_ucc_subsections_letter").on(table.letter),
  index("IDX_ucc_subsections_order").on(table.order),
  index("IDX_ucc_subsections_parent").on(table.parentSubsectionId),
  unique("UNQ_ucc_subsections_section_letter").on(table.sectionId, table.letter),
]);

// UCC Cross References table - tracks references between UCC sections and external sources
export const uccCrossReferences = pgTable("ucc_cross_references", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromSectionId: varchar("from_section_id").notNull(),
  fromSubsectionId: varchar("from_subsection_id"), // Optional - reference from specific subsection
  toSectionId: varchar("to_section_id"), // For internal UCC references
  toSubsectionId: varchar("to_subsection_id"), // Optional - reference to specific subsection
  externalCitation: varchar("external_citation"), // For references to USC, CFR, etc.
  externalSource: varchar("external_source"), // 'usc', 'cfr', 'court_case', 'regulation'
  referenceType: varchar("reference_type").notNull(), // 'see', 'see_also', 'defined_in', 'superseded', 'amended'
  context: text("context"), // Surrounding text where reference appears
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.fromSectionId], foreignColumns: [uccSections.id] }),
  foreignKey({ columns: [table.fromSubsectionId], foreignColumns: [uccSubsections.id] }),
  foreignKey({ columns: [table.toSectionId], foreignColumns: [uccSections.id] }),
  foreignKey({ columns: [table.toSubsectionId], foreignColumns: [uccSubsections.id] }),
  index("IDX_ucc_cross_refs_from_section").on(table.fromSectionId),
  index("IDX_ucc_cross_refs_to_section").on(table.toSectionId),
  index("IDX_ucc_cross_refs_external_citation").on(table.externalCitation),
  index("IDX_ucc_cross_refs_external_source").on(table.externalSource),
  index("IDX_ucc_cross_refs_type").on(table.referenceType),
]);

// UCC Definitions table - legal term definitions from UCC sections
export const uccDefinitions = pgTable("ucc_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  term: varchar("term").notNull(),
  definition: text("definition").notNull(),
  sectionId: varchar("section_id").notNull(), // Section where definition appears
  subsectionId: varchar("subsection_id"), // Optional - specific subsection
  scope: varchar("scope").notNull(), // 'article', 'global', 'section'
  articleId: varchar("article_id"), // For article-specific definitions
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.sectionId], foreignColumns: [uccSections.id] }),
  foreignKey({ columns: [table.subsectionId], foreignColumns: [uccSubsections.id] }),
  foreignKey({ columns: [table.articleId], foreignColumns: [uccArticles.id] }),
  index("IDX_ucc_definitions_term").on(table.term),
  index("IDX_ucc_definitions_section").on(table.sectionId),
  index("IDX_ucc_definitions_scope").on(table.scope),
  index("IDX_ucc_definitions_article").on(table.articleId),
  unique("UNQ_ucc_definitions_term_scope_section").on(table.term, table.scope, table.sectionId),
]);

// UCC Search Index table - optimized search index with metadata
export const uccSearchIndex = pgTable("ucc_search_index", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: varchar("section_id").notNull(),
  subsectionId: varchar("subsection_id"), // Optional - for subsection-specific indexing
  searchContent: text("search_content").notNull(), // Processed content for search
  keywords: varchar("keywords").array(), // Extracted commercial law keywords
  topics: varchar("topics").array(), // Legal topic classifications (sales, secured_transactions, etc.)
  definitions: varchar("definitions").array(), // Terms defined in this section
  searchVector: text("search_vector"), // Optimized search vector
  popularity: integer("popularity").default(0), // Search frequency for ranking
  commercialRelevance: integer("commercial_relevance").default(0), // Commercial law relevance score
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.sectionId], foreignColumns: [uccSections.id] }),
  foreignKey({ columns: [table.subsectionId], foreignColumns: [uccSubsections.id] }),
  index("IDX_ucc_search_section").on(table.sectionId),
  index("IDX_ucc_search_subsection").on(table.subsectionId),
  index("IDX_ucc_search_content").on(table.searchContent),
  index("IDX_ucc_search_keywords").on(table.keywords),
  index("IDX_ucc_search_topics").on(table.topics),
  index("IDX_ucc_search_definitions").on(table.definitions),
  index("IDX_ucc_search_popularity").on(table.popularity),
  index("IDX_ucc_search_commercial_relevance").on(table.commercialRelevance),
]);

// UCC Indexing Jobs table - tracks UCC indexing operations
export const uccIndexingJobs = pgTable("ucc_indexing_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobType: varchar("job_type").notNull(), // 'full_index', 'article_update', 'section_update', 'definitions_extract'
  status: varchar("status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed'
  articleNumber: varchar("article_number"), // Optional - for article-specific jobs
  dataSource: varchar("data_source").notNull().default("cornell_law"), // 'cornell_law', 'justia', 'archive_org'
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  progress: jsonb("progress"), // JSON object with progress details
  stats: jsonb("stats"), // Job statistics (sections processed, definitions extracted, errors, etc.)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_ucc_jobs_type").on(table.jobType),
  index("IDX_ucc_jobs_status").on(table.status),
  index("IDX_ucc_jobs_article").on(table.articleNumber),
  index("IDX_ucc_jobs_source").on(table.dataSource),
  index("IDX_ucc_jobs_created").on(table.createdAt),
]);
```

### Insert Schemas and Types

```typescript
// UCC insert schemas
export const insertUccArticleSchema = createInsertSchema(uccArticles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUccPartSchema = createInsertSchema(uccParts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUccSectionSchema = createInsertSchema(uccSections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  contentVector: true, // Exclude search vector from insert schema
});

export const insertUccSubsectionSchema = createInsertSchema(uccSubsections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUccCrossReferenceSchema = createInsertSchema(uccCrossReferences).omit({
  id: true,
  createdAt: true,
});

export const insertUccDefinitionSchema = createInsertSchema(uccDefinitions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUccSearchIndexSchema = createInsertSchema(uccSearchIndex).omit({
  id: true,
  searchVector: true, // Exclude search vector from insert schema
});

export const insertUccIndexingJobSchema = createInsertSchema(uccIndexingJobs).omit({
  id: true,
  createdAt: true,
});

// UCC types
export type UccArticle = typeof uccArticles.$inferSelect;
export type InsertUccArticle = z.infer<typeof insertUccArticleSchema>;
export type UccPart = typeof uccParts.$inferSelect;
export type InsertUccPart = z.infer<typeof insertUccPartSchema>;
export type UccSection = typeof uccSections.$inferSelect;
export type InsertUccSection = z.infer<typeof insertUccSectionSchema>;
export type UccSubsection = typeof uccSubsections.$inferSelect;
export type InsertUccSubsection = z.infer<typeof insertUccSubsectionSchema>;
export type UccCrossReference = typeof uccCrossReferences.$inferSelect;
export type InsertUccCrossReference = z.infer<typeof insertUccCrossReferenceSchema>;
export type UccDefinition = typeof uccDefinitions.$inferSelect;
export type InsertUccDefinition = z.infer<typeof insertUccDefinitionSchema>;
export type UccSearchIndex = typeof uccSearchIndex.$inferSelect;
export type InsertUccSearchIndex = z.infer<typeof insertUccSearchIndexSchema>;
export type UccIndexingJob = typeof uccIndexingJobs.$inferSelect;
export type InsertUccIndexingJob = z.infer<typeof insertUccIndexingJobSchema>;
```

### Relations

```typescript
// UCC Relations
export const uccArticleRelations = relations(uccArticles, ({ many }) => ({
  parts: many(uccParts),
  sections: many(uccSections),
  definitions: many(uccDefinitions),
}));

export const uccPartRelations = relations(uccParts, ({ one, many }) => ({
  article: one(uccArticles, {
    fields: [uccParts.articleId],
    references: [uccArticles.id],
  }),
  parentPart: one(uccParts, {
    fields: [uccParts.parentPartId],
    references: [uccParts.id],
  }),
  subParts: many(uccParts),
  sections: many(uccSections),
}));

export const uccSectionRelations = relations(uccSections, ({ one, many }) => ({
  article: one(uccArticles, {
    fields: [uccSections.articleId],
    references: [uccArticles.id],
  }),
  part: one(uccParts, {
    fields: [uccSections.partId],
    references: [uccParts.id],
  }),
  subsections: many(uccSubsections),
  crossReferencesFrom: many(uccCrossReferences),
  crossReferencesTo: many(uccCrossReferences),
  definitions: many(uccDefinitions),
  searchIndex: many(uccSearchIndex),
}));

export const uccSubsectionRelations = relations(uccSubsections, ({ one, many }) => ({
  section: one(uccSections, {
    fields: [uccSubsections.sectionId],
    references: [uccSections.id],
  }),
  parentSubsection: one(uccSubsections, {
    fields: [uccSubsections.parentSubsectionId],
    references: [uccSubsections.id],
  }),
  childSubsections: many(uccSubsections),
  crossReferencesFrom: many(uccCrossReferences),
  crossReferencesTo: many(uccCrossReferences),
  definitions: many(uccDefinitions),
  searchIndex: many(uccSearchIndex),
}));

export const uccCrossReferenceRelations = relations(uccCrossReferences, ({ one }) => ({
  fromSection: one(uccSections, {
    fields: [uccCrossReferences.fromSectionId],
    references: [uccSections.id],
  }),
  fromSubsection: one(uccSubsections, {
    fields: [uccCrossReferences.fromSubsectionId],
    references: [uccSubsections.id],
  }),
  toSection: one(uccSections, {
    fields: [uccCrossReferences.toSectionId],
    references: [uccSections.id],
  }),
  toSubsection: one(uccSubsections, {
    fields: [uccCrossReferences.toSubsectionId],
    references: [uccSubsections.id],
  }),
}));

export const uccDefinitionRelations = relations(uccDefinitions, ({ one }) => ({
  section: one(uccSections, {
    fields: [uccDefinitions.sectionId],
    references: [uccSections.id],
  }),
  subsection: one(uccSubsections, {
    fields: [uccDefinitions.subsectionId],
    references: [uccSubsections.id],
  }),
  article: one(uccArticles, {
    fields: [uccDefinitions.articleId],
    references: [uccArticles.id],
  }),
}));

export const uccSearchIndexRelations = relations(uccSearchIndex, ({ one }) => ({
  section: one(uccSections, {
    fields: [uccSearchIndex.sectionId],
    references: [uccSections.id],
  }),
  subsection: one(uccSubsections, {
    fields: [uccSearchIndex.subsectionId],
    references: [uccSubsections.id],
  }),
}));
```

## Key Design Features

### 1. Hierarchical Structure Support
- **Articles**: Top-level containers (12 main articles)
- **Parts**: Organize sections within articles (with optional subpart support)
- **Sections**: Individual UCC provisions with full content
- **Subsections**: Granular subdivision of sections

### 2. Search Optimization
- **Multiple Content Formats**: HTML, plain text, and search vectors
- **Keyword Extraction**: Commercial law-specific keywords
- **Topic Classification**: Legal topic categorization
- **Definition Tracking**: Dedicated table for UCC definitions

### 3. Cross-Reference System
- **Internal References**: UCC section to UCC section
- **External References**: UCC to US Code, CFR, court cases
- **Bidirectional Support**: Track both outgoing and incoming references

### 4. Data Source Integration
- **Multiple Sources**: Cornell Law, Justia, Internet Archive
- **Change Tracking**: Last modified timestamps
- **Indexing Jobs**: Comprehensive job tracking system

### 5. Commercial Law Focus
- **Commercial Relevance Scoring**: Priority ranking for business law queries
- **Definition Scope Management**: Article-specific vs. global definitions
- **Transaction Type Classification**: Sales, secured transactions, etc.

## Integration with Existing System

### 1. Unified Search
- Extend existing search to include UCC alongside US Code
- Implement cross-corpus search (find related US Code and UCC provisions)
- Maintain separate relevance scoring for different legal domains

### 2. Storage Interface Extension
- Add UCC-specific CRUD operations to existing IStorage interface
- Maintain consistency with US Code patterns
- Support complex hierarchical queries

### 3. Indexing System Integration
- Extend existing Python indexing system for UCC content
- Reuse existing job management and progress tracking
- Implement UCC-specific content processing

## Implementation Recommendations

### Phase 1: Core Schema Implementation
1. Add UCC tables to shared/schema.ts
2. Update storage interface with UCC operations
3. Implement basic CRUD functionality

### Phase 2: Indexing System
1. Create UCC content fetcher (Cornell Law API)
2. Implement UCC content parser and processor
3. Extend existing indexing job system

### Phase 3: Search Integration
1. Implement unified search across US Code and UCC
2. Add commercial law query handling
3. Implement cross-reference navigation

### Phase 4: AI Integration
1. Train Parlant AI on UCC content
2. Implement commercial law question routing
3. Add context-aware legal research features

## Estimated Development Effort
- **Schema Implementation**: 2-3 days
- **Storage Interface**: 1-2 days  
- **Indexing System**: 3-4 days
- **Search Integration**: 2-3 days
- **AI Integration**: 4-5 days
- **Testing & QA**: 3-4 days

**Total Estimated Effort**: 15-21 days for complete implementation