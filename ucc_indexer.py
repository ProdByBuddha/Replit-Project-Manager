#!/usr/bin/env python3
"""
UCC Indexing System
Orchestrates the complete indexing process for UCC data from Cornell Law School

This system provides:
- Full indexing of UCC articles from Cornell Law School
- Incremental updates to keep content current
- Progress tracking and job management
- Error handling and recovery
- Integration with backend storage through REST API
- Commercial law-specific processing and analysis
"""

import asyncio
import logging
import os
import json
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path

import httpx
from ucc_fetcher import UCCFetcher, UCCArticleInfo, UCCSectionInfo
from ucc_processor import UCCProcessor, ProcessedUCCSection, ProcessedUCCArticle

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ucc_indexer.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class UCCIndexingStats:
    """Statistics for UCC indexing operations"""
    articles_processed: int = 0
    parts_processed: int = 0
    sections_processed: int = 0
    subsections_processed: int = 0
    definitions_extracted: int = 0
    cross_references_found: int = 0
    errors: int = 0
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    total_api_calls: int = 0
    failed_api_calls: int = 0
    
    def duration_seconds(self) -> float:
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'articles_processed': self.articles_processed,
            'parts_processed': self.parts_processed,
            'sections_processed': self.sections_processed,
            'subsections_processed': self.subsections_processed,
            'definitions_extracted': self.definitions_extracted,
            'cross_references_found': self.cross_references_found,
            'errors': self.errors,
            'duration_seconds': self.duration_seconds(),
            'total_api_calls': self.total_api_calls,
            'failed_api_calls': self.failed_api_calls,
            'success_rate': (self.total_api_calls - self.failed_api_calls) / max(self.total_api_calls, 1) * 100
        }

class UCCIndexer:
    """
    Main indexing service for UCC data from Cornell Law School
    
    Coordinates between UCC fetcher, content processing, and backend storage
    to provide comprehensive UCC indexing capabilities.
    """
    
    def __init__(self, 
                 backend_base_url: str = "http://127.0.0.1:5000",
                 shared_secret: Optional[str] = None):
        
        self.backend_base_url = backend_base_url
        # Require PARLANT_SHARED_SECRET environment variable for security
        self.shared_secret = shared_secret or os.getenv("PARLANT_SHARED_SECRET")
        
        if not self.shared_secret:
            raise ValueError(
                "PARLANT_SHARED_SECRET environment variable is required for UCC indexing operations. "
                "This secret is used to authenticate with the backend API for secure indexing jobs."
            )
        
        # Initialize components
        self.ucc_fetcher = UCCFetcher()
        self.processor = UCCProcessor()
        
        # Indexing state
        self.current_job_id: Optional[str] = None
        self.stats = UCCIndexingStats()
        
        # Configuration
        self.batch_size = 5  # Process in smaller batches for UCC due to content complexity
        self.max_retries = 3
        self.retry_delay = 5.0  # seconds
        
        logger.info("UCC Indexer initialized for Cornell Law School")
    
    async def start_full_indexing(self, article_number: Optional[str] = None) -> str:
        """
        Start a full UCC indexing operation
        
        Args:
            article_number: Optional specific article to index (if None, indexes all)
            
        Returns:
            job_id: Unique identifier for this indexing job
        """
        try:
            # Create indexing job in backend
            job_data = {
                'jobType': 'full_index',
                'articleNumber': article_number,
                'status': 'pending',
                'progress': {'stage': 'initializing', 'percentage': 0},
                'stats': {'processed': 0, 'errors': 0}
            }
            
            job_response = await self._make_backend_request(
                'POST', 
                '/api/ucc/index/jobs', 
                json=job_data
            )
            
            if not job_response or not job_response.get('success'):
                raise Exception("Failed to create UCC indexing job")
            
            job_id = job_response['data']['id']
            self.current_job_id = job_id
            
            logger.info(f"Started UCC full indexing job: {job_id}")
            
            # Start the actual indexing process
            await self._run_full_indexing(article_number)
            
            return job_id
            
        except Exception as e:
            logger.error(f"Failed to start UCC full indexing: {e}")
            if self.current_job_id:
                await self._update_job_error(self.current_job_id, str(e))
            raise
    
    async def _run_full_indexing(self, article_number: Optional[str] = None):
        """Execute the full UCC indexing process"""
        self.stats = UCCIndexingStats(start_time=datetime.now())
        
        try:
            await self._update_job_status('running', {'stage': 'fetching_articles', 'percentage': 5})
            
            # Get list of articles to process
            async with self.ucc_fetcher as fetcher:
                all_articles = await fetcher.get_article_list()
                
                if article_number:
                    articles_to_process = [a for a in all_articles if a.number == article_number]
                    if not articles_to_process:
                        raise Exception(f"Article {article_number} not found")
                    logger.info(f"Indexing UCC Article {article_number}")
                else:
                    articles_to_process = all_articles
                    logger.info(f"Indexing all UCC articles: {len(articles_to_process)} found")
                
                total_articles = len(articles_to_process)
                
                for i, article in enumerate(articles_to_process):
                    try:
                        # Update progress
                        progress_percentage = 10 + (i / total_articles * 80)  # 10-90%
                        await self._update_job_status('running', {
                            'stage': f'processing_article_{article.number}',
                            'percentage': progress_percentage,
                            'current_article': article.number
                        })
                        
                        # Process article
                        await self._process_article(article)
                        self.stats.articles_processed += 1
                        
                        logger.info(f"Completed UCC Article {article.number} ({i+1}/{total_articles})")
                        
                    except Exception as e:
                        logger.error(f"Failed to process UCC Article {article.number}: {e}")
                        self.stats.errors += 1
                        continue
            
            # Final processing
            await self._update_job_status('running', {'stage': 'finalizing', 'percentage': 95})
            await self._finalize_indexing()
            
            # Complete job
            self.stats.end_time = datetime.now()
            await self._update_job_status('completed', {
                'stage': 'completed', 
                'percentage': 100
            }, self.stats.to_dict())
            
            logger.info("UCC indexing completed successfully")
            
        except Exception as e:
            logger.error(f"UCC indexing failed: {e}")
            self.stats.end_time = datetime.now()
            if self.current_job_id:
                await self._update_job_error(self.current_job_id, str(e))
            raise
    
    async def _process_article(self, article: UCCArticleInfo):
        """Process a complete UCC article"""
        try:
            logger.info(f"Processing UCC Article {article.number}: {article.name}")
            
            # Fetch article content
            async with self.ucc_fetcher as fetcher:
                sections = await fetcher.fetch_article_sections(article)
            
            # Create article data structure
            article_data = {
                'number': article.number,
                'name': article.name,
                'description': article.description,
                'url': article.url,
                'sections': [asdict(section) for section in sections]
            }
            
            # Process with commercial law analysis
            processed_article = self.processor.process_article_content(article_data)
            
            # Store in database
            await self._store_article_data(processed_article)
            
            logger.info(f"Successfully processed and stored UCC Article {article.number}")
            
        except Exception as e:
            logger.error(f"Error processing UCC Article {article.number}: {e}")
            raise
    
    async def _store_article_data(self, processed_article: ProcessedUCCArticle):
        """Store processed article data in the database"""
        try:
            # Create or update article record
            article_data = {
                'number': processed_article.number,
                'name': processed_article.name,
                'description': processed_article.description,
                'officialTitle': processed_article.official_title,
                'sourceUrl': processed_article.source_url,
                'lastModified': processed_article.last_modified.isoformat() if processed_article.last_modified else None
            }
            
            article_response = await self._make_backend_request(
                'POST',
                '/api/ucc/articles',
                json=article_data
            )
            
            if not article_response or not article_response.get('success'):
                raise Exception(f"Failed to create UCC article {processed_article.number}")
            
            article_id = article_response['data']['id']
            logger.info(f"Created UCC article record: {article_id}")
            
            # Store parts if any
            for part in processed_article.parts:
                await self._store_part_data(part, article_id)
                self.stats.parts_processed += 1
            
            # Store sections
            for section in processed_article.sections:
                await self._store_section_data(section, article_id)
                self.stats.sections_processed += 1
            
        except Exception as e:
            logger.error(f"Error storing article data: {e}")
            raise
    
    async def _store_part_data(self, part_data: Dict[str, Any], article_id: str):
        """Store UCC part data"""
        try:
            part_record = {
                'articleId': article_id,
                'number': part_data.get('number'),
                'name': part_data.get('name'),
                'description': part_data.get('description'),
                'startSection': part_data.get('start_section'),
                'endSection': part_data.get('end_section')
            }
            
            response = await self._make_backend_request(
                'POST',
                '/api/ucc/parts',
                json=part_record
            )
            
            if not response or not response.get('success'):
                raise Exception(f"Failed to create UCC part {part_data.get('number')}")
            
            return response['data']['id']
            
        except Exception as e:
            logger.error(f"Error storing part data: {e}")
            raise
    
    async def _store_section_data(self, section: ProcessedUCCSection, article_id: str):
        """Store UCC section and related data"""
        try:
            # Find part ID if applicable
            part_id = None
            if section.part_number:
                part_response = await self._make_backend_request(
                    'GET',
                    f'/api/ucc/articles/{article_id}/parts/{section.part_number}'
                )
                if part_response and part_response.get('success'):
                    part_id = part_response['data']['id']
            
            # Create section record
            section_data = {
                'articleId': article_id,
                'partId': part_id,
                'number': section.number,
                'citation': section.citation,
                'heading': section.heading,
                'content': section.content,
                'htmlContent': section.html_content,
                'cleanText': section.clean_text,
                'officialComment': section.official_comment,
                'sourceUrl': section.source_url,
                'lastModified': section.last_modified.isoformat() if section.last_modified else None
            }
            
            section_response = await self._make_backend_request(
                'POST',
                '/api/ucc/sections',
                json=section_data
            )
            
            if not section_response or not section_response.get('success'):
                raise Exception(f"Failed to create UCC section {section.citation}")
            
            section_id = section_response['data']['id']
            logger.debug(f"Created UCC section: {section.citation}")
            
            # Store subsections
            if section.subsections:
                for subsection in section.subsections:
                    await self._store_subsection_data(subsection, section_id)
                    self.stats.subsections_processed += 1
            
            # Store definitions
            if section.definitions:
                for definition in section.definitions:
                    await self._store_definition_data(definition, section_id, article_id)
                    self.stats.definitions_extracted += 1
            
            # Store cross-references
            if section.cross_references:
                for cross_ref in section.cross_references:
                    await self._store_cross_reference_data(cross_ref, section_id)
                    self.stats.cross_references_found += 1
            
            # Create search index entry
            await self._store_search_index_data(section, section_id)
            
        except Exception as e:
            logger.error(f"Error storing section data for {section.citation}: {e}")
            raise
    
    async def _store_subsection_data(self, subsection: Dict[str, Any], section_id: str):
        """Store UCC subsection data"""
        try:
            subsection_data = {
                'sectionId': section_id,
                'number': subsection.get('number'),
                'content': subsection.get('content'),
                'level': subsection.get('level', 1),
                'order': subsection.get('order', 0),
                'parentSubsectionId': subsection.get('parent_subsection_id')
            }
            
            response = await self._make_backend_request(
                'POST',
                '/api/ucc/subsections',
                json=subsection_data
            )
            
            if not response or not response.get('success'):
                logger.warning(f"Failed to create UCC subsection {subsection.get('number')}")
            
        except Exception as e:
            logger.error(f"Error storing subsection data: {e}")
    
    async def _store_definition_data(self, definition: Dict[str, Any], section_id: str, article_id: str):
        """Store UCC definition data"""
        try:
            definition_data = {
                'term': definition.get('term'),
                'definition': definition.get('definition'),
                'sectionId': section_id,
                'articleId': article_id,
                'scope': definition.get('scope', 'section'),
                'alternativeTerms': definition.get('alternative_terms', []),
                'citationContext': definition.get('citation', '')
            }
            
            response = await self._make_backend_request(
                'POST',
                '/api/ucc/definitions',
                json=definition_data
            )
            
            if not response or not response.get('success'):
                logger.warning(f"Failed to create UCC definition for term: {definition.get('term')}")
            
        except Exception as e:
            logger.error(f"Error storing definition data: {e}")
    
    async def _store_cross_reference_data(self, cross_ref: Dict[str, Any], from_section_id: str):
        """Store UCC cross-reference data"""
        try:
            # Resolve target section ID if it's a UCC reference
            to_section_id = None
            if cross_ref.get('reference_type') == 'ucc_section':
                target_citation = cross_ref.get('target_citation')
                if target_citation:
                    target_response = await self._make_backend_request(
                        'GET',
                        f'/api/ucc/sections/by-citation/{target_citation}'
                    )
                    if target_response and target_response.get('success'):
                        to_section_id = target_response['data']['id']
            
            cross_ref_data = {
                'fromSectionId': from_section_id,
                'toSectionId': to_section_id,
                'externalReference': cross_ref.get('external_reference'),
                'referenceType': cross_ref.get('reference_type'),
                'context': cross_ref.get('context')
            }
            
            response = await self._make_backend_request(
                'POST',
                '/api/ucc/cross-references',
                json=cross_ref_data
            )
            
            if not response or not response.get('success'):
                logger.warning(f"Failed to create UCC cross-reference")
            
        except Exception as e:
            logger.error(f"Error storing cross-reference data: {e}")
    
    async def _store_search_index_data(self, section: ProcessedUCCSection, section_id: str):
        """Store UCC search index data"""
        try:
            search_content = self.processor.generate_search_content(section)
            
            search_index_data = {
                'sectionId': section_id,
                'searchContent': search_content,
                'keywords': section.keywords,
                'topics': section.topics,
                'commercialTerms': section.commercial_terms,
                'transactionTypes': section.transaction_types
            }
            
            response = await self._make_backend_request(
                'POST',
                '/api/ucc/search-index',
                json=search_index_data
            )
            
            if not response or not response.get('success'):
                logger.warning(f"Failed to create UCC search index for {section.citation}")
            
        except Exception as e:
            logger.error(f"Error storing search index data: {e}")
    
    async def _finalize_indexing(self):
        """Perform final indexing operations"""
        try:
            # Optimize search indexes
            logger.info("Optimizing UCC search indexes...")
            optimize_response = await self._make_backend_request(
                'POST',
                '/api/ucc/search-index/optimize'
            )
            
            # Update statistics
            stats_response = await self._make_backend_request(
                'POST',
                '/api/ucc/stats/update'
            )
            
            logger.info("UCC indexing finalization completed")
            
        except Exception as e:
            logger.warning(f"Error during indexing finalization: {e}")
    
    async def _make_backend_request(self, method: str, endpoint: str, json: Optional[Dict] = None) -> Optional[Dict]:
        """Make authenticated request to backend API"""
        try:
            headers = {
                "Authorization": f"Bearer {self.shared_secret}",
                "Content-Type": "application/json"
            }
            
            url = f"{self.backend_base_url}{endpoint}"
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                if method.upper() == "GET":
                    response = await client.get(url, headers=headers)
                elif method.upper() == "POST":
                    response = await client.post(url, headers=headers, json=json)
                elif method.upper() == "PUT":
                    response = await client.put(url, headers=headers, json=json)
                elif method.upper() == "DELETE":
                    response = await client.delete(url, headers=headers)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                
                self.stats.total_api_calls += 1
                
                if response.status_code >= 400:
                    self.stats.failed_api_calls += 1
                    logger.error(f"Backend API error: {response.status_code} - {response.text}")
                    return None
                
                return response.json()
                
        except Exception as e:
            self.stats.failed_api_calls += 1
            logger.error(f"Backend request failed: {e}")
            return None
    
    async def _update_job_status(self, status: str, progress: Optional[Dict] = None, stats: Optional[Dict] = None):
        """Update job status in backend"""
        if not self.current_job_id:
            return
        
        update_data: Dict[str, Any] = {'status': status}
        if progress:
            update_data['progress'] = progress
        if stats:
            update_data['stats'] = stats
        
        await self._make_backend_request(
            'PUT',
            f'/api/ucc/index/jobs/{self.current_job_id}',
            json=update_data
        )
    
    async def _update_job_error(self, job_id: str, error_message: str):
        """Update job with error status"""
        update_data = {
            'status': 'failed',
            'errorMessage': error_message,
            'stats': self.stats.to_dict()
        }
        
        await self._make_backend_request(
            'PUT',
            f'/api/ucc/index/jobs/{job_id}',
            json=update_data
        )
    
    async def check_indexing_status(self) -> Dict[str, Any]:
        """Check current indexing status"""
        try:
            response = await self._make_backend_request('GET', '/api/ucc/stats')
            if response and response.get('success'):
                return response['data']
            return {}
        except Exception as e:
            logger.error(f"Error checking indexing status: {e}")
            return {}
    
    async def start_incremental_indexing(self) -> str:
        """Start incremental indexing for updated content"""
        try:
            job_data = {
                'jobType': 'incremental',
                'status': 'pending'
            }
            
            job_response = await self._make_backend_request(
                'POST',
                '/api/ucc/index/jobs',
                json=job_data
            )
            
            if not job_response or not job_response.get('success'):
                raise Exception("Failed to create incremental indexing job")
            
            job_id = job_response['data']['id']
            logger.info(f"Started UCC incremental indexing job: {job_id}")
            
            # TODO: Implement incremental indexing logic
            # This would check for updates and only re-index changed content
            
            return job_id
            
        except Exception as e:
            logger.error(f"Failed to start incremental indexing: {e}")
            raise

# CLI interface for testing and administration
async def main():
    """Main function for CLI usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description="UCC Indexing System")
    parser.add_argument("--full-index", action="store_true", help="Run full UCC indexing")
    parser.add_argument("--article", help="Index specific article (e.g., '1', '2A')")
    parser.add_argument("--incremental", action="store_true", help="Run incremental indexing")
    parser.add_argument("--status", action="store_true", help="Check indexing status")
    parser.add_argument("--backend-url", default="http://127.0.0.1:5000", help="Backend API URL")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    indexer = UCCIndexer(backend_base_url=args.backend_url)
    
    try:
        if args.status:
            status = await indexer.check_indexing_status()
            print("UCC Indexing Status:")
            print(json.dumps(status, indent=2, default=str))
            
        elif args.full_index:
            logger.info("Starting full UCC indexing...")
            job_id = await indexer.start_full_indexing(args.article)
            print(f"Full indexing job started: {job_id}")
            
        elif args.incremental:
            logger.info("Starting incremental UCC indexing...")
            job_id = await indexer.start_incremental_indexing()
            print(f"Incremental indexing job started: {job_id}")
            
        else:
            parser.print_help()
            
    except Exception as e:
        logger.error(f"UCC indexing operation failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())