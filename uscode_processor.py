#!/usr/bin/env python3
"""
US Code Content Processor
Processes XML/JSON data from GovInfo API and extracts structured legal content
with proper citations, hierarchical structure, and searchable text.

This module handles:
- XML parsing from GovInfo API responses
- Citation extraction and normalization
- Hierarchical document structure processing
- Full-text content preparation for indexing
- Legal reference detection and linking
"""

import re
import logging
from typing import Dict, List, Optional, Any, Tuple, Set
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
import json

import xmltodict
from bs4 import BeautifulSoup, Tag, NavigableString
import httpx

# Configure logging
logger = logging.getLogger(__name__)

@dataclass
class ProcessedSection:
    """Represents a processed US Code section with structured data"""
    title_number: int
    section_number: str
    citation: str
    heading: str
    content: str
    clean_text: str  # Text without XML markup for search
    xml_content: str
    chapter_number: Optional[str] = None
    subsections: List[str] = None
    references: List[str] = None
    keywords: List[str] = None
    last_modified: Optional[datetime] = None
    source_url: Optional[str] = None
    package_id: Optional[str] = None

    def __post_init__(self):
        if self.subsections is None:
            self.subsections = []
        if self.references is None:
            self.references = []
        if self.keywords is None:
            self.keywords = []

@dataclass 
class ProcessedTitle:
    """Represents a processed US Code title"""
    number: int
    name: str
    description: Optional[str]
    chapters: List[Dict[str, Any]]
    sections: List[ProcessedSection]
    package_id: Optional[str] = None
    last_modified: Optional[datetime] = None

class USCodeProcessor:
    """
    Processor for US Code XML/JSON content from GovInfo API.
    
    Handles parsing, structure extraction, and content preparation for indexing.
    """
    
    def __init__(self):
        # Legal citation patterns for US Code
        self.citation_patterns = {
            'usc_section': re.compile(r'\b(\d+)\s+U\.?S\.?C\.?\s+§?\s*(\d+[a-z]?(?:-\d+[a-z]?)*)\b', re.IGNORECASE),
            'usc_title': re.compile(r'\btitle\s+(\d+)\b', re.IGNORECASE),
            'chapter': re.compile(r'\bchapter\s+(\d+[a-z]?)\b', re.IGNORECASE),
            'section_ref': re.compile(r'\bsection\s+(\d+[a-z]?(?:-\d+[a-z]?)*)\b', re.IGNORECASE),
            'subsection': re.compile(r'\b(?:subsection|paragraph)\s*\(([a-z0-9]+)\)', re.IGNORECASE),
        }
        
        # Legal keywords for classification
        self.legal_keywords = {
            'criminal': ['criminal', 'crime', 'felony', 'misdemeanor', 'offense', 'penalty', 'punishment', 'imprisonment'],
            'civil': ['civil', 'liability', 'damages', 'compensation', 'remedy', 'injunction'],
            'regulatory': ['regulation', 'compliance', 'enforcement', 'violation', 'administrative'],
            'procedure': ['procedure', 'process', 'hearing', 'appeal', 'jurisdiction', 'venue'],
            'definitions': ['definition', 'means', 'includes', 'term', 'shall mean'],
            'requirements': ['shall', 'must', 'required', 'mandatory', 'obligation'],
            'prohibitions': ['prohibited', 'unlawful', 'forbidden', 'shall not', 'may not'],
            'exceptions': ['except', 'unless', 'provided that', 'however', 'notwithstanding'],
        }
    
    def process_title_xml(self, xml_content: str, title_number: int, 
                         package_id: Optional[str] = None) -> ProcessedTitle:
        """
        Process complete title XML from GovInfo API.
        
        Args:
            xml_content: Raw XML content from GovInfo API
            title_number: US Code title number
            package_id: GovInfo package identifier
            
        Returns:
            ProcessedTitle with structured data
        """
        try:
            # Parse XML using BeautifulSoup for better control
            soup = BeautifulSoup(xml_content, 'xml')
            
            # Extract title metadata
            title_name = self._extract_title_name(soup)
            title_description = self._extract_title_description(soup)
            
            # Process chapters
            chapters = self._extract_chapters(soup, title_number)
            
            # Process all sections
            sections = self._extract_all_sections(soup, title_number, package_id)
            
            return ProcessedTitle(
                number=title_number,
                name=title_name,
                description=title_description,
                chapters=chapters,
                sections=sections,
                package_id=package_id,
                last_modified=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Error processing title {title_number} XML: {e}")
            raise
    
    def _extract_title_name(self, soup: BeautifulSoup) -> str:
        """Extract title name from XML"""
        # Try different possible title name elements
        title_elements = [
            soup.find('title'),
            soup.find('heading'),
            soup.find('toc-entry'),
        ]
        
        for element in title_elements:
            if element and element.get_text(strip=True):
                return element.get_text(strip=True)
        
        return "Unknown Title"
    
    def _extract_title_description(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract title description from XML"""
        desc_elements = [
            soup.find('description'),
            soup.find('summary'),
            soup.find('note'),
        ]
        
        for element in desc_elements:
            if element and element.get_text(strip=True):
                return element.get_text(strip=True)
        
        return None
    
    def _extract_chapters(self, soup: BeautifulSoup, title_number: int) -> List[Dict[str, Any]]:
        """Extract chapter information from title XML"""
        chapters = []
        
        # Find chapter elements
        chapter_elements = soup.find_all(['chapter', 'subchapter'])
        
        for chapter_elem in chapter_elements:
            chapter_data = {
                'number': self._extract_element_number(chapter_elem),
                'name': self._extract_element_heading(chapter_elem),
                'description': self._extract_element_description(chapter_elem),
                'start_section': None,
                'end_section': None,
            }
            
            # Find section range for this chapter
            sections_in_chapter = chapter_elem.find_all('section')
            if sections_in_chapter:
                section_numbers = [self._extract_element_number(s) for s in sections_in_chapter]
                section_numbers = [s for s in section_numbers if s]  # Filter out None values
                if section_numbers:
                    chapter_data['start_section'] = min(section_numbers)
                    chapter_data['end_section'] = max(section_numbers)
            
            chapters.append(chapter_data)
        
        return chapters
    
    def _extract_all_sections(self, soup: BeautifulSoup, title_number: int, 
                             package_id: Optional[str] = None) -> List[ProcessedSection]:
        """Extract all sections from title XML"""
        sections = []
        
        # Find all section elements
        section_elements = soup.find_all('section')
        
        for section_elem in section_elements:
            try:
                section = self._process_section_element(section_elem, title_number, package_id)
                if section:
                    sections.append(section)
            except Exception as e:
                logger.warning(f"Error processing section: {e}")
                continue
        
        return sections
    
    def _process_section_element(self, section_elem: Tag, title_number: int, 
                                package_id: Optional[str] = None) -> Optional[ProcessedSection]:
        """Process individual section element"""
        # Extract section number
        section_number = self._extract_element_number(section_elem)
        if not section_number:
            return None
        
        # Extract heading
        heading = self._extract_element_heading(section_elem)
        
        # Extract content
        content = self._extract_section_content(section_elem)
        xml_content = str(section_elem)
        
        # Generate citation
        citation = f"{title_number} USC {section_number}"
        
        # Clean text for search
        clean_text = self._clean_text_for_search(content)
        
        # Extract references
        references = self._extract_references(content)
        
        # Extract keywords
        keywords = self._extract_keywords(clean_text)
        
        # Find chapter context
        chapter_number = self._find_parent_chapter(section_elem)
        
        # Extract subsections
        subsections = self._extract_subsections(section_elem)
        
        return ProcessedSection(
            title_number=title_number,
            section_number=section_number,
            citation=citation,
            heading=heading,
            content=content,
            clean_text=clean_text,
            xml_content=xml_content,
            chapter_number=chapter_number,
            subsections=subsections,
            references=references,
            keywords=keywords,
            package_id=package_id,
            last_modified=datetime.now()
        )
    
    def _extract_element_number(self, element: Tag) -> Optional[str]:
        """Extract number from XML element"""
        # Try various attributes and child elements
        number_sources = [
            element.get('number'),
            element.get('num'),
            element.get('identifier'),
        ]
        
        for source in number_sources:
            if source:
                return str(source).strip()
        
        # Try finding number in child elements
        num_elements = element.find_all(['num', 'number', 'identifier'])
        for num_elem in num_elements:
            text = num_elem.get_text(strip=True)
            if text:
                return text
        
        return None
    
    def _extract_element_heading(self, element: Tag) -> str:
        """Extract heading from XML element"""
        heading_elements = element.find_all(['heading', 'title', 'header'])
        
        for heading_elem in heading_elements:
            text = heading_elem.get_text(strip=True)
            if text:
                return text
        
        return "No heading"
    
    def _extract_element_description(self, element: Tag) -> Optional[str]:
        """Extract description from XML element"""
        desc_elements = element.find_all(['description', 'summary', 'note'])
        
        for desc_elem in desc_elements:
            text = desc_elem.get_text(strip=True)
            if text:
                return text
        
        return None
    
    def _extract_section_content(self, section_elem: Tag) -> str:
        """Extract full content from section element"""
        # Remove heading and number elements to get just content
        content_elem = section_elem.find(['content', 'text', 'body'])
        
        if content_elem:
            return content_elem.get_text(separator=' ', strip=True)
        else:
            # If no specific content element, get all text excluding headers
            # Make a copy to avoid modifying original
            temp_elem = BeautifulSoup(str(section_elem), 'xml')
            
            # Remove metadata elements
            for remove_elem in temp_elem.find_all(['heading', 'num', 'number', 'identifier']):
                remove_elem.decompose()
            
            return temp_elem.get_text(separator=' ', strip=True)
    
    def _clean_text_for_search(self, text: str) -> str:
        """Clean text content for full-text search indexing"""
        if not text:
            return ""
        
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove special characters but keep legal punctuation
        text = re.sub(r'[^\w\s\.\,\;\:\(\)\-\'\"]', ' ', text)
        
        # Normalize section references
        text = re.sub(r'§\s*', 'section ', text)
        
        return text.strip()
    
    def _extract_references(self, content: str) -> List[str]:
        """Extract legal citations and references from content"""
        references = []
        
        # Find USC citations
        for match in self.citation_patterns['usc_section'].finditer(content):
            references.append(f"{match.group(1)} USC {match.group(2)}")
        
        # Find section references
        for match in self.citation_patterns['section_ref'].finditer(content):
            references.append(f"section {match.group(1)}")
        
        # Remove duplicates while preserving order
        seen = set()
        unique_refs = []
        for ref in references:
            if ref not in seen:
                seen.add(ref)
                unique_refs.append(ref)
        
        return unique_refs
    
    def _extract_keywords(self, text: str) -> List[str]:
        """Extract legal keywords and classify content"""
        keywords = []
        text_lower = text.lower()
        
        # Check for keyword categories
        for category, terms in self.legal_keywords.items():
            if any(term in text_lower for term in terms):
                keywords.append(category)
        
        # Extract significant legal terms
        legal_terms = re.findall(r'\b(?:shall|may|must|required|prohibited|unlawful|penalty|fine|imprisonment|liability|damages|jurisdiction|enforcement|compliance|violation|regulation|definition|includes|means|term)\b', text_lower)
        
        # Add unique terms
        for term in set(legal_terms):
            if term not in keywords:
                keywords.append(term)
        
        return keywords[:20]  # Limit to 20 most relevant keywords
    
    def _find_parent_chapter(self, section_elem: Tag) -> Optional[str]:
        """Find the chapter that contains this section"""
        # Look for parent chapter element
        parent = section_elem.parent
        while parent:
            if parent.name in ['chapter', 'subchapter']:
                return self._extract_element_number(parent)
            parent = parent.parent
        
        return None
    
    def _extract_subsections(self, section_elem: Tag) -> List[str]:
        """Extract subsection identifiers from section"""
        subsections = []
        
        # Find subsection elements
        subsection_elements = section_elem.find_all(['subsection', 'paragraph', 'subparagraph'])
        
        for subsec_elem in subsection_elements:
            subsec_id = self._extract_element_number(subsec_elem)
            if subsec_id:
                subsections.append(subsec_id)
        
        return subsections
    
    def process_search_results(self, search_results: List[Dict]) -> List[Dict[str, Any]]:
        """Process search results from GovInfo API into structured format"""
        processed_results = []
        
        for result in search_results:
            processed_result = {
                'package_id': result.get('packageId'),
                'title': result.get('title', ''),
                'summary': result.get('summary', ''),
                'last_modified': self._parse_api_date(result.get('lastModified')),
                'download_link': self._extract_download_link(result),
                'citation': self._extract_citation_from_title(result.get('title', '')),
            }
            processed_results.append(processed_result)
        
        return processed_results
    
    def _parse_api_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """Parse date from GovInfo API response"""
        if not date_str:
            return None
        
        try:
            # Handle common API date formats
            formats = [
                "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%d",
                "%Y-%m-%dT%H:%M:%S",
            ]
            
            for fmt in formats:
                try:
                    return datetime.strptime(date_str, fmt)
                except ValueError:
                    continue
            
            return None
        except Exception:
            return None
    
    def _extract_download_link(self, result: Dict) -> Optional[str]:
        """Extract download link from API result"""
        download_data = result.get('download', {})
        if isinstance(download_data, dict):
            links = download_data.get('links', [])
            for link in links:
                if link.get('type') == 'xml':
                    return link.get('link')
        
        return None
    
    def _extract_citation_from_title(self, title: str) -> Optional[str]:
        """Extract citation from result title"""
        match = self.citation_patterns['usc_section'].search(title)
        if match:
            return f"{match.group(1)} USC {match.group(2)}"
        
        return None
    
    def validate_processed_content(self, content: ProcessedSection) -> List[str]:
        """Validate processed content and return any issues"""
        issues = []
        
        if not content.section_number:
            issues.append("Missing section number")
        
        if not content.heading or content.heading == "No heading":
            issues.append("Missing or invalid heading")
        
        if not content.content.strip():
            issues.append("Empty content")
        
        if not content.citation:
            issues.append("Missing citation")
        
        if len(content.clean_text) < 10:
            issues.append("Content too short for meaningful indexing")
        
        return issues

# Utility functions for external use

def batch_process_sections(xml_contents: List[str], title_number: int) -> List[ProcessedSection]:
    """Process multiple sections in batch"""
    processor = USCodeProcessor()
    all_sections = []
    
    for xml_content in xml_contents:
        try:
            title = processor.process_title_xml(xml_content, title_number)
            all_sections.extend(title.sections)
        except Exception as e:
            logger.error(f"Error processing XML content: {e}")
            continue
    
    return all_sections

def extract_citations_from_text(text: str) -> List[str]:
    """Extract all citations from a text string"""
    processor = USCodeProcessor()
    return processor._extract_references(text)

def classify_legal_content(text: str) -> List[str]:
    """Classify legal content and return keywords"""
    processor = USCodeProcessor()
    return processor._extract_keywords(text)

# Example usage
if __name__ == "__main__":
    # Example processing
    processor = USCodeProcessor()
    
    # Test with sample XML (would normally come from GovInfo API)
    sample_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <title number="15">
        <heading>Commerce and Trade</heading>
        <chapter number="1">
            <heading>Monopolies and Combinations in Restraint of Trade</heading>
            <section number="1">
                <heading>Trusts, etc., in restraint of trade illegal; penalty</heading>
                <content>Every contract, combination in the form of trust or otherwise, or conspiracy, in restraint of trade or commerce among the several States, or with foreign nations, is declared to be illegal.</content>
            </section>
        </chapter>
    </title>"""
    
    try:
        result = processor.process_title_xml(sample_xml, 15, "USCODE-2023-title15")
        print(f"Processed title: {result.name}")
        print(f"Sections found: {len(result.sections)}")
        if result.sections:
            section = result.sections[0]
            print(f"First section: {section.citation} - {section.heading}")
            print(f"Keywords: {section.keywords}")
            print(f"References: {section.references}")
    except Exception as e:
        print(f"Error: {e}")