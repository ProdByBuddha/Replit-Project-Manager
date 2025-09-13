#!/usr/bin/env python3
"""
UCC Content Processor
Processes scraped UCC content from Cornell Law School and extracts structured commercial law data
with proper citations, hierarchical structure, definitions, and searchable content.

This module handles:
- UCC content parsing and structure extraction
- Commercial law definition identification
- Citation extraction and cross-reference detection
- Search vector generation for commercial law topics
- Transaction type classification
- Official comment processing
"""

import re
import logging
import asyncio
from typing import Dict, List, Optional, Any, Tuple, Set
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
import json

from bs4 import BeautifulSoup, Tag
from bs4.element import NavigableString

# Configure logging
logger = logging.getLogger(__name__)

@dataclass
class ProcessedUCCSection:
    """Represents a processed UCC section with structured commercial law data"""
    number: str
    citation: str
    heading: str
    content: str
    clean_text: str  # Text without HTML markup for search
    html_content: str
    article_number: str
    part_number: Optional[str] = None
    subsections: Optional[List[Dict[str, Any]]] = None
    definitions: Optional[List[Dict[str, Any]]] = None
    cross_references: Optional[List[Dict[str, Any]]] = None
    commercial_terms: Optional[List[str]] = None
    transaction_types: Optional[List[str]] = None
    keywords: Optional[List[str]] = None
    topics: Optional[List[str]] = None
    official_comment: Optional[str] = None
    last_modified: Optional[datetime] = None
    source_url: Optional[str] = None

    def __post_init__(self):
        if self.subsections is None:
            self.subsections = []
        if self.definitions is None:
            self.definitions = []
        if self.cross_references is None:
            self.cross_references = []
        if self.commercial_terms is None:
            self.commercial_terms = []
        if self.transaction_types is None:
            self.transaction_types = []
        if self.keywords is None:
            self.keywords = []
        if self.topics is None:
            self.topics = []

@dataclass 
class ProcessedUCCArticle:
    """Represents a processed UCC article"""
    number: str
    name: str
    description: Optional[str]
    official_title: Optional[str]
    parts: List[Dict[str, Any]]
    sections: List[ProcessedUCCSection]
    source_url: Optional[str] = None
    last_modified: Optional[datetime] = None

class UCCProcessor:
    """
    Processor for UCC content from Cornell Law School and other sources.
    
    Handles parsing, structure extraction, and commercial law content preparation for indexing.
    """
    
    def __init__(self):
        # UCC-specific citation patterns
        self.citation_patterns = {
            'ucc_section': re.compile(r'\bUCC\s+(\d+[A-Z]?)-(\d+[a-z]?(?:-\d+[a-z]?)*)\b', re.IGNORECASE),
            'ucc_subsection': re.compile(r'\bUCC\s+(\d+[A-Z]?)-(\d+[a-z]?)(?:\s*\(([a-z0-9]+)\))?\b', re.IGNORECASE),
            'section_ref': re.compile(r'\bSection\s+(\d+[A-Z]?)-(\d+[a-z]?(?:-\d+[a-z]?)*)\b', re.IGNORECASE),
            'subsection_ref': re.compile(r'\b(?:subsection|paragraph)\s*\(([a-z0-9]+)\)', re.IGNORECASE),
            'article_ref': re.compile(r'\bArticle\s+(\d+[A-Z]?)\b', re.IGNORECASE),
            'part_ref': re.compile(r'\bPart\s+(\d+[A-Z]?)\b', re.IGNORECASE),
        }
        
        # Commercial law keywords organized by transaction type
        self.commercial_keywords = {
            'secured_transactions': [
                'security interest', 'security agreement', 'financing statement', 'collateral',
                'debtor', 'secured party', 'purchase money security interest', 'PMSI',
                'perfection', 'attachment', 'priority', 'default', 'foreclosure',
                'deposit account', 'inventory', 'equipment', 'accounts receivable',
                'chattel paper', 'instruments', 'documents', 'general intangibles'
            ],
            'sales': [
                'contract of sale', 'buyer', 'seller', 'goods', 'delivery',
                'acceptance', 'rejection', 'revocation', 'breach', 'cover',
                'warranty', 'merchantability', 'fitness for purpose',
                'tender', 'conforming goods', 'installment contract',
                'battle of the forms', 'firm offer', 'requirements contract'
            ],
            'leases': [
                'lease agreement', 'lessor', 'lessee', 'finance lease',
                'consumer lease', 'lease term', 'rental', 'residual value',
                'casualty to goods', 'sublease', 'assignment of lease'
            ],
            'negotiable_instruments': [
                'negotiable instrument', 'promissory note', 'check', 'draft',
                'payee', 'drawer', 'drawee', 'endorsement', 'bearer',
                'holder in due course', 'negotiation', 'dishonor',
                'accommodation party', 'guarantee', 'indorsement'
            ],
            'bank_deposits': [
                'bank', 'customer', 'deposit account', 'check collection',
                'provisional settlement', 'final payment', 'midnight deadline',
                'collecting bank', 'depositary bank', 'payor bank',
                'presentment', 'notice of dishonor', 'protest'
            ],
            'funds_transfers': [
                'payment order', 'originator', 'beneficiary', 'receiving bank',
                'sender', 'intermediary bank', 'fedwire', 'ACH', 'SWIFT',
                'funds transfer', 'execution', 'acceptance', 'cancellation'
            ],
            'letters_of_credit': [
                'letter of credit', 'issuer', 'applicant', 'beneficiary',
                'advising bank', 'confirming bank', 'documentary credit',
                'standby letter of credit', 'sight draft', 'time draft',
                'presentation', 'honor', 'wrongful dishonor'
            ],
            'warehouse_receipts': [
                'warehouse receipt', 'bill of lading', 'document of title',
                'warehouseman', 'carrier', 'consignor', 'consignee',
                'bailment', 'negotiable document', 'delivery order'
            ],
            'investment_securities': [
                'security', 'certificated security', 'uncertificated security',
                'security entitlement', 'securities account', 'entitlement holder',
                'securities intermediary', 'protected purchaser', 'adverse claim',
                'instruction', 'entitlement order'
            ],
            'bulk_transfers': [
                'bulk transfer', 'bulk sale', 'transferor', 'transferee',
                'creditor', 'notice to creditors', 'schedule of property',
                'list of creditors'
            ],
            'controllable_records': [
                'controllable electronic record', 'qualifying purchaser',
                'control', 'copy', 'authoritative copy', 'tamper evident'
            ]
        }
        
        # UCC-specific definition patterns
        self.definition_patterns = [
            # Standard definition patterns
            re.compile(r'"([^"]+)"\s+means\s+([^.]+\.)', re.IGNORECASE),
            re.compile(r'The\s+term\s+"([^"]+)"\s+(?:means|includes)\s+([^.]+\.)', re.IGNORECASE),
            re.compile(r'([A-Z][a-z\s]+)\s+means\s+([^.]+\.)', re.IGNORECASE),
            re.compile(r'For\s+purposes\s+of\s+this\s+(?:Article|section),\s+"([^"]+)"\s+means\s+([^.]+\.)', re.IGNORECASE),
            # UCC-specific patterns
            re.compile(r'In\s+this\s+Article(?:\s+[\d-]+)?:\s*\([a-z]\)\s+"([^"]+)"\s+means\s+([^.]+\.)', re.IGNORECASE),
        ]
        
        # Commercial law topic classifications
        self.topic_classifiers = {
            'contract_formation': [
                'offer', 'acceptance', 'consideration', 'contract formation',
                'battle of forms', 'firm offer', 'modification'
            ],
            'performance': [
                'performance', 'tender', 'delivery', 'installment',
                'substantial performance', 'cure', 'rejection'
            ],
            'breach_remedies': [
                'breach', 'damages', 'cover', 'incidental damages',
                'consequential damages', 'liquidated damages', 'specific performance'
            ],
            'warranties': [
                'warranty', 'merchantability', 'fitness for purpose',
                'express warranty', 'implied warranty', 'disclaimer'
            ],
            'risk_of_loss': [
                'risk of loss', 'title', 'FOB', 'CIF', 'delivery terms',
                'shipping terms', 'carrier', 'casualty'
            ],
            'credit_protection': [
                'security interest', 'perfection', 'priority', 'attachment',
                'financing statement', 'lien', 'pledge'
            ],
            'payment_systems': [
                'payment', 'check', 'electronic transfer', 'credit card',
                'bank', 'settlement', 'clearing'
            ],
            'commercial_paper': [
                'negotiable instrument', 'holder in due course', 'negotiation',
                'endorsement', 'dishonor', 'liability'
            ]
        }
    
    def process_article_content(self, article_data: Dict[str, Any]) -> ProcessedUCCArticle:
        """
        Process complete article content from fetched data.
        
        Args:
            article_data: Raw article data from UCC fetcher
            
        Returns:
            ProcessedUCCArticle with structured data
        """
        try:
            article_number = article_data.get('number', '')
            article_name = article_data.get('name', '')
            
            logger.info(f"Processing UCC Article {article_number}: {article_name}")
            
            # Process sections
            sections = []
            raw_sections = article_data.get('sections', [])
            
            for section_data in raw_sections:
                try:
                    processed_section = self.process_section_content(section_data)
                    sections.append(processed_section)
                except Exception as e:
                    logger.error(f"Error processing section {section_data.get('citation', 'unknown')}: {e}")
                    continue
            
            # Process parts (if any)
            parts = article_data.get('parts', [])
            
            return ProcessedUCCArticle(
                number=article_number,
                name=article_name,
                description=article_data.get('description'),
                official_title=article_data.get('official_title'),
                parts=parts,
                sections=sections,
                source_url=article_data.get('url'),
                last_modified=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Error processing article {article_data.get('number', 'unknown')}: {e}")
            raise
    
    def process_section_content(self, section_data: Dict[str, Any]) -> ProcessedUCCSection:
        """
        Process individual UCC section content with commercial law analysis.
        
        Args:
            section_data: Raw section data from UCC fetcher
            
        Returns:
            ProcessedUCCSection with extracted commercial law data
        """
        try:
            # Extract basic section information
            number = section_data.get('number', '')
            citation = section_data.get('citation', '')
            heading = section_data.get('heading', '')
            content = section_data.get('content', '')
            html_content = section_data.get('html_content', '')
            article_number = section_data.get('article_number', '')
            part_number = section_data.get('part_number')
            
            # Clean text for search
            clean_text = self._clean_text_content(content)
            
            # Process subsections
            subsections = self._process_subsections(section_data.get('subsections', []))
            
            # Extract definitions
            definitions = self._extract_definitions(content, citation, article_number)
            
            # Extract cross-references
            cross_references = self._extract_cross_references(content)
            
            # Extract commercial terms
            commercial_terms = self._extract_commercial_terms(content)
            
            # Classify transaction types
            transaction_types = self._classify_transaction_types(content)
            
            # Extract keywords
            keywords = self._extract_keywords(content)
            
            # Classify topics
            topics = self._classify_topics(content)
            
            # Process official comment
            official_comment = section_data.get('official_comment')
            if official_comment:
                official_comment = self._clean_text_content(official_comment)
            
            return ProcessedUCCSection(
                number=number,
                citation=citation,
                heading=heading,
                content=content,
                clean_text=clean_text,
                html_content=html_content,
                article_number=article_number,
                part_number=part_number,
                subsections=subsections,
                definitions=definitions,
                cross_references=cross_references,
                commercial_terms=commercial_terms,
                transaction_types=transaction_types,
                keywords=keywords,
                topics=topics,
                official_comment=official_comment,
                last_modified=datetime.now(),
                source_url=section_data.get('source_url')
            )
            
        except Exception as e:
            logger.error(f"Error processing section {section_data.get('citation', 'unknown')}: {e}")
            raise
    
    def _clean_text_content(self, content: str) -> str:
        """Clean HTML content and extract plain text"""
        if not content:
            return ""
        
        # Parse HTML if present
        soup = BeautifulSoup(content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        # Get text and clean it up
        text = soup.get_text()
        
        # Normalize whitespace
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        clean_text = '\n'.join(lines)
        
        # Remove excessive whitespace
        clean_text = re.sub(r'\s+', ' ', clean_text)
        
        return clean_text.strip()
    
    def _process_subsections(self, subsections_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process subsection data"""
        processed_subsections = []
        
        for subsection in subsections_data:
            processed_subsection = {
                'number': subsection.get('number', ''),
                'content': self._clean_text_content(subsection.get('content', '')),
                'level': subsection.get('level', 1),
                'order': subsection.get('order', 0),
                'parent_subsection_id': subsection.get('parent_subsection_id')
            }
            processed_subsections.append(processed_subsection)
        
        return processed_subsections
    
    def _extract_definitions(self, content: str, citation: str, article_number: str) -> List[Dict[str, Any]]:
        """Extract legal definitions from section content"""
        definitions = []
        
        for pattern in self.definition_patterns:
            matches = pattern.finditer(content)
            for match in matches:
                if len(match.groups()) >= 2:
                    term = match.group(1).strip()
                    definition = match.group(2).strip()
                    
                    # Clean up term and definition
                    term = re.sub(r'^["\']|["\']$', '', term)
                    definition = re.sub(r'\s+', ' ', definition).strip()
                    
                    if len(term) > 2 and len(definition) > 10:  # Filter out noise
                        definitions.append({
                            'term': term,
                            'definition': definition,
                            'citation': citation,
                            'article_number': article_number,
                            'scope': self._determine_definition_scope(content, term),
                            'alternative_terms': self._find_alternative_terms(content, term)
                        })
        
        # Remove duplicates
        seen_terms = set()
        unique_definitions = []
        for defn in definitions:
            term_key = defn['term'].lower()
            if term_key not in seen_terms:
                seen_terms.add(term_key)
                unique_definitions.append(defn)
        
        return unique_definitions
    
    def _determine_definition_scope(self, content: str, term: str) -> str:
        """Determine the scope of a definition (section, article, general)"""
        term_context = content.lower()
        
        if 'in this article' in term_context or 'for purposes of this article' in term_context:
            return 'article'
        elif 'in this section' in term_context or 'for purposes of this section' in term_context:
            return 'section'
        else:
            return 'general'
    
    def _find_alternative_terms(self, content: str, term: str) -> List[str]:
        """Find alternative terms and synonyms"""
        alternatives = []
        
        # Look for "also known as" patterns
        patterns = [
            rf'{re.escape(term)}\s*(?:\(also\s+(?:known\s+as|called)\s+([^)]+)\))',
            rf'(?:also\s+(?:known\s+as|called)\s+["\']?([^"\',.]+)["\']?).*{re.escape(term)}',
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                alt_term = match.group(1).strip()
                if alt_term and alt_term.lower() != term.lower():
                    alternatives.append(alt_term)
        
        return alternatives
    
    def _extract_cross_references(self, content: str) -> List[Dict[str, Any]]:
        """Extract cross-references to other UCC sections and external codes"""
        cross_references = []
        
        for ref_type, pattern in self.citation_patterns.items():
            matches = pattern.finditer(content)
            for match in matches:
                if ref_type == 'ucc_section':
                    article = match.group(1)
                    section = match.group(2)
                    reference = f"UCC {article}-{section}"
                    
                    cross_references.append({
                        'reference_type': 'ucc_section',
                        'target_citation': reference,
                        'target_article': article,
                        'target_section': section,
                        'context': self._extract_reference_context(content, match.start(), match.end())
                    })
                
                elif ref_type == 'article_ref':
                    article = match.group(1)
                    
                    cross_references.append({
                        'reference_type': 'ucc_article',
                        'target_article': article,
                        'context': self._extract_reference_context(content, match.start(), match.end())
                    })
        
        # Look for external references (US Code, CFR, etc.)
        external_patterns = [
            (r'\b(\d+)\s+U\.?S\.?C\.?\s+§?\s*(\d+[a-z]?(?:-\d+[a-z]?)*)', 'usc'),
            (r'\b(\d+)\s+C\.?F\.?R\.?\s+§?\s*(\d+(?:\.\d+)*)', 'cfr'),
            (r'\bRestatement\s+\(([^)]+)\)\s+§?\s*(\d+)', 'restatement'),
        ]
        
        for pattern, ref_type in external_patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                cross_references.append({
                    'reference_type': ref_type,
                    'external_reference': match.group(0),
                    'context': self._extract_reference_context(content, match.start(), match.end())
                })
        
        return cross_references
    
    def _extract_reference_context(self, content: str, start: int, end: int, context_length: int = 100) -> str:
        """Extract context around a reference"""
        context_start = max(0, start - context_length)
        context_end = min(len(content), end + context_length)
        context = content[context_start:context_end].strip()
        
        # Clean up context
        context = re.sub(r'\s+', ' ', context)
        return context
    
    def _extract_commercial_terms(self, content: str) -> List[str]:
        """Extract commercial law terms from content"""
        found_terms = []
        content_lower = content.lower()
        
        for category, terms in self.commercial_keywords.items():
            for term in terms:
                if term.lower() in content_lower:
                    found_terms.append(term)
        
        # Remove duplicates and sort
        return sorted(list(set(found_terms)))
    
    def _classify_transaction_types(self, content: str) -> List[str]:
        """Classify the types of commercial transactions covered"""
        transaction_types = []
        content_lower = content.lower()
        
        # Map keywords to transaction types
        type_keywords = {
            'sales': ['sale', 'buyer', 'seller', 'goods', 'contract of sale'],
            'leases': ['lease', 'lessor', 'lessee', 'rental'],
            'secured_transactions': ['security interest', 'collateral', 'financing statement'],
            'negotiable_instruments': ['check', 'note', 'draft', 'negotiable instrument'],
            'bank_deposits': ['bank', 'deposit', 'collection', 'check collection'],
            'funds_transfers': ['wire transfer', 'payment order', 'funds transfer'],
            'letters_of_credit': ['letter of credit', 'documentary credit'],
            'warehouse_receipts': ['warehouse receipt', 'bill of lading'],
            'investment_securities': ['security', 'stock', 'bond', 'investment'],
            'bulk_transfers': ['bulk transfer', 'bulk sale'],
            'controllable_records': ['controllable electronic record', 'electronic record']
        }
        
        for trans_type, keywords in type_keywords.items():
            if any(keyword in content_lower for keyword in keywords):
                transaction_types.append(trans_type)
        
        return transaction_types
    
    def _extract_keywords(self, content: str) -> List[str]:
        """Extract relevant legal and commercial keywords"""
        keywords = []
        
        # Common legal terms
        legal_terms = [
            'contract', 'agreement', 'party', 'obligation', 'right', 'duty',
            'breach', 'remedy', 'damages', 'liability', 'enforce', 'void',
            'voidable', 'valid', 'invalid', 'notice', 'consent', 'authorize'
        ]
        
        content_lower = content.lower()
        
        # Add commercial terms
        for term in self._extract_commercial_terms(content):
            keywords.append(term)
        
        # Add legal terms if present
        for term in legal_terms:
            if term in content_lower:
                keywords.append(term)
        
        # Extract important nouns and phrases
        # This is a simplified approach - could be enhanced with NLP
        important_phrases = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', content)
        for phrase in important_phrases:
            if len(phrase.split()) <= 3 and len(phrase) > 3:
                keywords.append(phrase.lower())
        
        # Remove duplicates and filter
        keywords = list(set(keywords))
        keywords = [k for k in keywords if len(k) > 2 and len(k) < 50]
        
        return sorted(keywords)
    
    def _classify_topics(self, content: str) -> List[str]:
        """Classify commercial law topics covered in the content"""
        topics = []
        content_lower = content.lower()
        
        for topic, keywords in self.topic_classifiers.items():
            if any(keyword.lower() in content_lower for keyword in keywords):
                topics.append(topic)
        
        return topics
    
    def process_batch_content(self, content_batch: List[Dict[str, Any]]) -> List[ProcessedUCCSection]:
        """Process a batch of UCC sections efficiently"""
        processed_sections = []
        
        for section_data in content_batch:
            try:
                processed_section = self.process_section_content(section_data)
                processed_sections.append(processed_section)
            except Exception as e:
                logger.error(f"Error processing section in batch: {e}")
                continue
        
        return processed_sections
    
    def generate_search_content(self, section: ProcessedUCCSection) -> str:
        """Generate optimized search content for a section"""
        search_parts = []
        
        # Add citation and heading
        search_parts.append(section.citation)
        search_parts.append(section.heading)
        
        # Add clean content
        search_parts.append(section.clean_text)
        
        # Add commercial terms
        if section.commercial_terms:
            search_parts.append(' '.join(section.commercial_terms))
        
        # Add keywords
        if section.keywords:
            search_parts.append(' '.join(section.keywords))
        
        # Add definition terms
        if section.definitions:
            terms = [defn['term'] for defn in section.definitions]
            search_parts.append(' '.join(terms))
        
        # Add official comment if available
        if section.official_comment:
            search_parts.append(section.official_comment)
        
        return ' '.join(search_parts)

# CLI interface for testing
async def main():
    """Main function for CLI testing"""
    import argparse
    import asyncio
    from ucc_fetcher import UCCFetcher
    
    parser = argparse.ArgumentParser(description="UCC Content Processor")
    parser.add_argument("--input", help="Input JSON file from UCC fetcher")
    parser.add_argument("--output", help="Output file for processed JSON results")
    parser.add_argument("--article", help="Process specific article data")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)
    
    processor = UCCProcessor()
    
    if args.input:
        # Process from input file
        with open(args.input, 'r') as f:
            data = json.load(f)
        
        if 'articles' in data:
            # Process multiple articles
            results = []
            for article_data in data['articles']:
                try:
                    processed_article = processor.process_article_content(article_data)
                    results.append(asdict(processed_article))
                except Exception as e:
                    logger.error(f"Error processing article: {e}")
                    continue
        else:
            # Process single article
            processed_article = processor.process_article_content(data)
            results = asdict(processed_article)
        
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(results, f, indent=2, default=str)
            print(f"Processed results written to {args.output}")
        else:
            print(json.dumps(results, indent=2, default=str))
    
    elif args.article:
        # Fetch and process specific article
        async with UCCFetcher() as fetcher:
            articles = await fetcher.get_article_list()
            target_article = None
            
            for article in articles:
                if article.number == args.article:
                    target_article = article
                    break
            
            if not target_article:
                print(f"Article {args.article} not found")
                return
            
            sections = await fetcher.fetch_article_sections(target_article)
            article_data = {
                'number': target_article.number,
                'name': target_article.name,
                'url': target_article.url,
                'sections': [asdict(section) for section in sections]
            }
            
            processed_article = processor.process_article_content(article_data)
            result = asdict(processed_article)
            
            if args.output:
                with open(args.output, 'w') as f:
                    json.dump(result, f, indent=2, default=str)
                print(f"Processed results written to {args.output}")
            else:
                print(json.dumps(result, indent=2, default=str))
    
    else:
        print("Please provide --input file or --article number to process")

if __name__ == "__main__":
    asyncio.run(main())