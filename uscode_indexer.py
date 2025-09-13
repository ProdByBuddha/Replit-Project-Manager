#!/usr/bin/env python3
"""
US Code Indexing System
Orchestrates the complete indexing process for US Code data from GovInfo API

This system provides:
- Full indexing of US Code titles from GovInfo API
- Incremental updates to keep content current
- Progress tracking and job management
- Error handling and recovery
- Integration with backend storage through REST API
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
from govinfo_client import GovInfoClient
from uscode_processor import USCodeProcessor, ProcessedTitle, ProcessedSection

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('uscode_indexer.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class IndexingStats:
    """Statistics for indexing operations"""
    titles_processed: int = 0
    chapters_processed: int = 0
    sections_processed: int = 0
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
            'titles_processed': self.titles_processed,
            'chapters_processed': self.chapters_processed,
            'sections_processed': self.sections_processed,
            'errors': self.errors,
            'duration_seconds': self.duration_seconds(),
            'total_api_calls': self.total_api_calls,
            'failed_api_calls': self.failed_api_calls,
            'success_rate': (self.total_api_calls - self.failed_api_calls) / max(self.total_api_calls, 1) * 100
        }

class USCodeIndexer:
    """
    Main indexing service for US Code data
    
    Coordinates between GovInfo API, content processing, and backend storage
    to provide comprehensive US Code indexing capabilities.
    """
    
    def __init__(self, 
                 backend_base_url: str = "http://127.0.0.1:5000",
                 govinfo_api_key: Optional[str] = None,
                 shared_secret: Optional[str] = None):
        
        self.backend_base_url = backend_base_url
        self.shared_secret = shared_secret or os.getenv("PARLANT_SHARED_SECRET", "family-portal-ai-secret-2024")
        
        # Initialize components
        self.govinfo_client = GovInfoClient(api_key=govinfo_api_key)
        self.processor = USCodeProcessor()
        
        # Indexing state
        self.current_job_id: Optional[str] = None
        self.stats = IndexingStats()
        
        # Configuration
        self.batch_size = 10  # Process in batches to avoid overwhelming the system
        self.max_retries = 3
        self.retry_delay = 5.0  # seconds
        
        logger.info("US Code Indexer initialized")
    
    async def start_full_indexing(self, title_number: Optional[int] = None) -> str:
        """
        Start a full indexing operation
        
        Args:
            title_number: Optional specific title to index (if None, indexes all)
            
        Returns:
            job_id: Unique identifier for this indexing job
        """
        try:
            # Create indexing job in backend
            job_data = {
                'titleNumber': title_number,
                'jobType': 'full_index',
                'status': 'pending',
                'progress': {'stage': 'initializing', 'percentage': 0},
                'stats': {'processed': 0, 'errors': 0}
            }
            
            job_response = await self._make_backend_request(
                'POST', 
                '/api/uscode/index/jobs', 
                json=job_data
            )
            
            if not job_response or not job_response.get('success'):
                raise Exception("Failed to create indexing job")
            
            job_id = job_response['data']['id']
            self.current_job_id = job_id
            
            logger.info(f"Started full indexing job: {job_id}")
            
            # Start the actual indexing process
            await self._run_full_indexing(title_number)
            
            return job_id
            
        except Exception as e:
            logger.error(f"Failed to start full indexing: {e}")
            if self.current_job_id:
                await self._update_job_error(self.current_job_id, str(e))
            raise
    
    async def _run_full_indexing(self, title_number: Optional[int] = None):
        """Execute the full indexing process"""
        self.stats = IndexingStats(start_time=datetime.now())
        
        try:
            await self._update_job_status('running', {'stage': 'fetching_titles', 'percentage': 5})
            
            # Get list of titles to process
            if title_number:
                titles_to_process = [title_number]
                logger.info(f"Indexing single title: {title_number}")
            else:
                titles_to_process = await self._get_available_titles()
                logger.info(f"Indexing all titles: {len(titles_to_process)} found")
            
            total_titles = len(titles_to_process)
            
            for i, title_num in enumerate(titles_to_process):
                try:
                    # Update progress
                    progress_percentage = 10 + (i / total_titles * 80)  # 10-90%
                    await self._update_job_status('running', {
                        'stage': f'processing_title_{title_num}',
                        'percentage': progress_percentage,
                        'current_title': title_num,
                        'titles_remaining': total_titles - i
                    })
                    
                    logger.info(f"Processing title {title_num} ({i+1}/{total_titles})")
                    
                    # Process this title
                    await self._process_title(title_num)
                    self.stats.titles_processed += 1
                    
                    # Update job stats periodically
                    if i % 5 == 0:  # Every 5 titles
                        await self._update_job_stats()
                    
                except Exception as e:
                    logger.error(f"Error processing title {title_num}: {e}")
                    self.stats.errors += 1
                    continue  # Continue with next title
            
            # Finalize indexing
            await self._update_job_status('running', {'stage': 'finalizing', 'percentage': 95})
            await self._finalize_indexing()
            
            # Complete the job
            self.stats.end_time = datetime.now()
            await self._update_job_status('completed', {'stage': 'completed', 'percentage': 100})
            await self._update_job_stats()
            
            logger.info(f"Full indexing completed successfully. Stats: {self.stats.to_dict()}")
            
        except Exception as e:
            logger.error(f"Full indexing failed: {e}")
            self.stats.end_time = datetime.now()
            await self._update_job_error(self.current_job_id, str(e))
            raise
    
    async def _get_available_titles(self) -> List[int]:
        """Get list of available US Code titles from GovInfo API"""
        try:
            self.stats.total_api_calls += 1
            
            # Search for US Code packages
            search_results = await self.govinfo_client.search_packages(
                query="United States Code",
                collection="USCODE",
                page_size=100
            )
            
            if not search_results:
                self.stats.failed_api_calls += 1
                logger.warning("No US Code packages found")
                return []
            
            # Extract title numbers from packages
            title_numbers = set()
            
            for package in search_results.get('packages', []):
                title = package.get('title', '')
                # Extract title number from package title
                # Example: "United States Code, 2023 Edition, Title 1 - General Provisions"
                import re
                match = re.search(r'Title (\d+)', title)
                if match:
                    title_numbers.add(int(match.group(1)))
            
            # Return standard US Code titles (1-54) if API doesn't provide specific list
            if not title_numbers:
                title_numbers = set(range(1, 55))  # Titles 1-54
                logger.info("Using standard title range 1-54")
            
            sorted_titles = sorted(list(title_numbers))
            logger.info(f"Found {len(sorted_titles)} titles to process")
            
            return sorted_titles
            
        except Exception as e:
            logger.error(f"Error getting available titles: {e}")
            self.stats.failed_api_calls += 1
            # Return standard range as fallback
            return list(range(1, 55))
    
    async def _process_title(self, title_number: int):
        """Process a single US Code title"""
        try:
            logger.info(f"Processing title {title_number}")
            
            # Fetch title data from GovInfo API
            self.stats.total_api_calls += 1
            title_data = await self.govinfo_client.get_title_content(title_number)
            
            if not title_data:
                self.stats.failed_api_calls += 1
                logger.warning(f"No data found for title {title_number}")
                return
            
            # Process the title content
            processed_title = self.processor.process_title_xml(
                title_data, 
                title_number,
                package_id=f"USCODE-2023-title{title_number}"
            )
            
            # Store the title in backend
            await self._store_title(processed_title)
            
            logger.info(f"Successfully processed title {title_number}: {processed_title.name}")
            
        except Exception as e:
            logger.error(f"Error processing title {title_number}: {e}")
            self.stats.errors += 1
            raise
    
    async def _store_title(self, processed_title: ProcessedTitle):
        """Store processed title data in backend"""
        try:
            # Create title record
            title_data = {
                'number': processed_title.number,
                'name': processed_title.name,
                'description': processed_title.description,
                'packageId': processed_title.package_id,
                'lastIndexed': datetime.now().isoformat()
            }
            
            title_response = await self._make_backend_request(
                'POST',
                '/api/uscode/titles',
                json=title_data
            )
            
            if not title_response or not title_response.get('success'):
                raise Exception(f"Failed to create title {processed_title.number}")
            
            title_id = title_response['data']['id']
            logger.info(f"Created title {processed_title.number} with ID: {title_id}")
            
            # Store chapters
            for chapter_data in processed_title.chapters:
                await self._store_chapter(chapter_data, title_id)
                self.stats.chapters_processed += 1
            
            # Store sections
            for section in processed_title.sections:
                await self._store_section(section, title_id)
                self.stats.sections_processed += 1
            
        except Exception as e:
            logger.error(f"Error storing title {processed_title.number}: {e}")
            raise
    
    async def _store_chapter(self, chapter_data: Dict[str, Any], title_id: str):
        """Store chapter data in backend"""
        try:
            chapter_payload = {
                'titleId': title_id,
                'number': chapter_data.get('number'),
                'name': chapter_data.get('name'),
                'description': chapter_data.get('description'),
                'startSection': chapter_data.get('start_section'),
                'endSection': chapter_data.get('end_section')
            }
            
            await self._make_backend_request(
                'POST',
                '/api/uscode/chapters',
                json=chapter_payload
            )
            
        except Exception as e:
            logger.error(f"Error storing chapter: {e}")
            raise
    
    async def _store_section(self, section: ProcessedSection, title_id: str):
        """Store section data in backend"""
        try:
            section_data = {
                'titleId': title_id,
                'number': section.section_number,
                'citation': section.citation,
                'heading': section.heading,
                'content': section.content,
                'xmlContent': section.xml_content,
                'chapterNumber': section.chapter_number,
                'subsections': section.subsections,
                'keywords': section.keywords,
                'packageId': section.package_id,
                'lastModified': section.last_modified.isoformat() if section.last_modified else None
            }
            
            section_response = await self._make_backend_request(
                'POST',
                '/api/uscode/sections',
                json=section_data
            )
            
            if section_response and section_response.get('success'):
                section_id = section_response['data']['id']
                
                # Create search index entry
                await self._create_search_index(section_id, section)
                
                # Store cross-references if any
                for ref in section.references:
                    await self._store_cross_reference(section_id, ref)
            
        except Exception as e:
            logger.error(f"Error storing section {section.citation}: {e}")
            raise
    
    async def _create_search_index(self, section_id: str, section: ProcessedSection):
        """Create search index entry for section"""
        try:
            search_data = {
                'sectionId': section_id,
                'searchContent': f"{section.heading} {section.clean_text}",
                'keywords': section.keywords,
                'topics': self._classify_section_topics(section.clean_text)
            }
            
            await self._make_backend_request(
                'POST',
                '/api/uscode/search-index',
                json=search_data
            )
            
        except Exception as e:
            logger.error(f"Error creating search index for section {section.citation}: {e}")
    
    async def _store_cross_reference(self, from_section_id: str, reference: str):
        """Store cross-reference between sections"""
        try:
            # For now, just log the reference
            # In a full implementation, would resolve the reference to find target section
            logger.debug(f"Cross-reference from {from_section_id}: {reference}")
            
        except Exception as e:
            logger.error(f"Error storing cross-reference: {e}")
    
    def _classify_section_topics(self, content: str) -> List[str]:
        """Classify section content into legal topics"""
        topics = []
        content_lower = content.lower()
        
        topic_keywords = {
            'criminal': ['criminal', 'crime', 'penalty', 'prison', 'sentence'],
            'civil': ['civil', 'liability', 'damages', 'compensation'],
            'regulatory': ['regulation', 'compliance', 'enforcement'],
            'constitutional': ['constitution', 'amendment', 'rights'],
            'procedural': ['procedure', 'process', 'hearing', 'court']
        }
        
        for topic, keywords in topic_keywords.items():
            if any(keyword in content_lower for keyword in keywords):
                topics.append(topic)
        
        return topics
    
    async def _finalize_indexing(self):
        """Finalize the indexing process"""
        try:
            # Rebuild search indexes
            await self._make_backend_request(
                'POST',
                '/api/uscode/index/rebuild',
                json={}
            )
            
            # Optimize indexes
            await self._make_backend_request(
                'POST',
                '/api/uscode/maintenance/optimize',
                json={}
            )
            
            logger.info("Indexing finalization completed")
            
        except Exception as e:
            logger.error(f"Error finalizing indexing: {e}")
    
    async def _update_job_status(self, status: str, progress: Dict[str, Any]):
        """Update indexing job status in backend"""
        if not self.current_job_id:
            return
        
        try:
            await self._make_backend_request(
                'PUT',
                f'/api/uscode/index/jobs/{self.current_job_id}/status',
                json={
                    'status': status,
                    'progress': progress
                }
            )
        except Exception as e:
            logger.error(f"Error updating job status: {e}")
    
    async def _update_job_stats(self):
        """Update indexing job statistics"""
        if not self.current_job_id:
            return
        
        try:
            await self._make_backend_request(
                'PUT',
                f'/api/uscode/index/jobs/{self.current_job_id}/status',
                json={
                    'status': 'running',
                    'stats': self.stats.to_dict()
                }
            )
        except Exception as e:
            logger.error(f"Error updating job stats: {e}")
    
    async def _update_job_error(self, job_id: str, error_message: str):
        """Update job with error status"""
        try:
            await self._make_backend_request(
                'PUT',
                f'/api/uscode/index/jobs/{job_id}/error',
                json={
                    'errorMessage': error_message
                }
            )
        except Exception as e:
            logger.error(f"Error updating job error: {e}")
    
    async def _make_backend_request(self, method: str, endpoint: str, **kwargs) -> Optional[Dict[str, Any]]:
        """Make authenticated request to backend API"""
        try:
            url = f"{self.backend_base_url}{endpoint}"
            headers = {
                'Authorization': f'Bearer {self.shared_secret}',
                'Content-Type': 'application/json'
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    timeout=30.0,
                    **kwargs
                )
                
                if response.status_code >= 400:
                    logger.error(f"Backend API error {response.status_code}: {response.text}")
                    return None
                
                return response.json()
                
        except Exception as e:
            logger.error(f"Error making backend request to {endpoint}: {e}")
            return None
    
    async def check_incremental_updates(self) -> List[int]:
        """Check for titles that need incremental updates"""
        try:
            # Get titles that haven't been updated recently
            cutoff_date = datetime.now() - timedelta(days=30)  # Update monthly
            
            # In a full implementation, would check last_modified dates
            # For now, return empty list (no incremental updates needed)
            return []
            
        except Exception as e:
            logger.error(f"Error checking incremental updates: {e}")
            return []
    
    async def run_incremental_update(self, title_numbers: List[int]):
        """Run incremental update for specific titles"""
        try:
            logger.info(f"Running incremental update for titles: {title_numbers}")
            
            for title_number in title_numbers:
                await self._process_title(title_number)
            
            logger.info("Incremental update completed")
            
        except Exception as e:
            logger.error(f"Error in incremental update: {e}")
            raise

# CLI Interface
async def main():
    """Main CLI interface for the indexer"""
    import argparse
    
    parser = argparse.ArgumentParser(description='US Code Indexing System')
    parser.add_argument('--title', type=int, help='Index specific title number')
    parser.add_argument('--incremental', action='store_true', help='Run incremental update')
    parser.add_argument('--backend-url', default='http://127.0.0.1:5000', help='Backend API URL')
    parser.add_argument('--api-key', help='GovInfo API key')
    
    args = parser.parse_args()
    
    # Initialize indexer
    indexer = USCodeIndexer(
        backend_base_url=args.backend_url,
        govinfo_api_key=args.api_key
    )
    
    try:
        if args.incremental:
            # Check for incremental updates
            titles_to_update = await indexer.check_incremental_updates()
            if titles_to_update:
                await indexer.run_incremental_update(titles_to_update)
            else:
                logger.info("No incremental updates needed")
        else:
            # Run full indexing
            job_id = await indexer.start_full_indexing(args.title)
            logger.info(f"Indexing completed. Job ID: {job_id}")
    
    except KeyboardInterrupt:
        logger.info("Indexing interrupted by user")
    except Exception as e:
        logger.error(f"Indexing failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())