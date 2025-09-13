#!/usr/bin/env python3
"""
UCC Content Fetcher for Cornell Law School
Scrapes Uniform Commercial Code content from Cornell Law School's Legal Information Institute

This module provides:
- Full UCC content fetching from Cornell Law School
- Article-by-article content scraping
- Section and subsection parsing
- Rate limiting and error handling
- Content caching for performance

Cornell UCC Structure:
- Articles: 1, 2, 2A, 3, 4, 4A, 5, 6, 7, 8, 9, 12
- Each article contains parts (when applicable) and sections
- Sections contain subsections and paragraphs
"""

import asyncio
import logging
import json
import time
import re
from typing import Dict, List, Optional, Any, Tuple, Set
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from urllib.parse import urljoin, urlparse
import os

import httpx
from bs4 import BeautifulSoup, Tag
from bs4.element import NavigableString
from ratelimit import limits, sleep_and_retry

# Configure logging
logger = logging.getLogger(__name__)

# Cornell Law School UCC base URL
CORNELL_UCC_BASE_URL = "https://www.law.cornell.edu/ucc"
RATE_LIMIT_CALLS = 30  # 30 calls per minute to be respectful
RATE_LIMIT_PERIOD = 60  # 1 minute in seconds
DEFAULT_TIMEOUT = 30.0

@dataclass
class UCCArticleInfo:
    """Represents UCC Article metadata"""
    number: str
    name: str
    description: Optional[str] = None
    url: str = ""
    has_parts: bool = False
    
@dataclass
class UCCPartInfo:
    """Represents UCC Part metadata"""
    number: str
    name: str
    description: Optional[str] = None
    article_number: str = ""
    start_section: Optional[str] = None
    end_section: Optional[str] = None
    
@dataclass
class UCCSectionInfo:
    """Represents UCC Section metadata and content"""
    number: str
    citation: str
    heading: str
    content: str
    html_content: str
    article_number: str
    part_number: Optional[str] = None
    subsections: Optional[List[Dict[str, Any]]] = None
    official_comment: Optional[str] = None
    source_url: str = ""
    last_modified: Optional[datetime] = None

    def __post_init__(self):
        if self.subsections is None:
            self.subsections = []

class UCCFetchError(Exception):
    """Custom exception for UCC fetching errors"""
    def __init__(self, message: str, status_code: Optional[int] = None, url: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.url = url

class RateLimitExceeded(UCCFetchError):
    """Raised when rate limit is exceeded"""
    pass

class UCCFetcher:
    """
    Async client for fetching UCC content from Cornell Law School.
    
    Features:
    - Rate limiting compliance (30 requests/minute)
    - Automatic retry with exponential backoff
    - HTML parsing and content extraction
    - Comprehensive error handling
    - Content caching for performance
    """
    
    def __init__(self, timeout: float = DEFAULT_TIMEOUT):
        """
        Initialize UCC fetcher.
        
        Args:
            timeout: Request timeout in seconds
        """
        self.timeout = timeout
        self.base_url = CORNELL_UCC_BASE_URL
        self.session: Optional[httpx.AsyncClient] = None
        
        # Rate limiting tracking
        self._request_times: List[float] = []
        self._rate_limit_lock = asyncio.Lock()
        
        # Simple in-memory cache for frequently accessed data
        self._cache: Dict[str, Any] = {}
        self._cache_ttl: Dict[str, datetime] = {}
        self.cache_duration = timedelta(hours=6)  # Cache for 6 hours
        
        # UCC article information
        self.ucc_articles = {
            "1": "General Provisions",
            "2": "Sales", 
            "2A": "Leases",
            "3": "Negotiable Instruments",
            "4": "Bank Deposits and Collections",
            "4A": "Funds Transfers",
            "5": "Letters of Credit",
            "6": "Bulk Transfers", 
            "7": "Warehouse Receipts, Bills of Lading and Other Documents of Title",
            "8": "Investment Securities",
            "9": "Secured Transactions",
            "12": "Controllable Electronic Records"
        }
        
        logger.info("UCC Fetcher initialized for Cornell Law School")
    
    async def __aenter__(self):
        """Async context manager entry"""
        await self._ensure_session()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.aclose()
    
    async def _ensure_session(self):
        """Ensure HTTP session is created"""
        if not self.session:
            headers = {
                "User-Agent": "FamilyPortal-UCC-Indexer/1.0 (Educational Use; Contact: admin@familyportal.com)",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Accept-Encoding": "gzip, deflate",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
            }
            
            self.session = httpx.AsyncClient(
                timeout=self.timeout,
                headers=headers,
                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
                follow_redirects=True
            )
    
    async def _enforce_rate_limit(self):
        """Enforce rate limiting to be respectful to Cornell Law School"""
        async with self._rate_limit_lock:
            now = time.time()
            
            # Remove requests older than the rate limit period
            self._request_times = [t for t in self._request_times if now - t < RATE_LIMIT_PERIOD]
            
            # Check if we're at the limit
            if len(self._request_times) >= RATE_LIMIT_CALLS:
                sleep_time = RATE_LIMIT_PERIOD - (now - self._request_times[0]) + 1
                if sleep_time > 0:
                    logger.warning(f"Rate limit reached. Sleeping for {sleep_time:.1f} seconds")
                    await asyncio.sleep(sleep_time)
                    # Clean up old requests after sleeping
                    now = time.time()
                    self._request_times = [t for t in self._request_times if now - t < RATE_LIMIT_PERIOD]
            
            # Record this request
            self._request_times.append(now)
    
    def _get_cache_key(self, url: str) -> str:
        """Generate cache key for URL"""
        return f"url:{url}"
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid"""
        if cache_key not in self._cache_ttl:
            return False
        return datetime.now() < self._cache_ttl[cache_key]
    
    def _cache_response(self, cache_key: str, data: Any):
        """Cache response data"""
        self._cache[cache_key] = data
        self._cache_ttl[cache_key] = datetime.now() + self.cache_duration
    
    async def _fetch_url(self, url: str, use_cache: bool = True) -> str:
        """
        Fetch content from a URL with rate limiting and caching.
        
        Args:
            url: URL to fetch
            use_cache: Whether to use cached content if available
            
        Returns:
            HTML content as string
        """
        cache_key = self._get_cache_key(url)
        
        # Check cache first
        if use_cache and self._is_cache_valid(cache_key):
            logger.debug(f"Using cached content for {url}")
            return self._cache[cache_key]
        
        await self._enforce_rate_limit()
        
        try:
            logger.info(f"Fetching: {url}")
            if not self.session:
                raise UCCFetchError("HTTP session not initialized - ensure UCCFetcher is used as async context manager", url=url)
            response = await self.session.get(url)
            response.raise_for_status()
            
            content = response.text
            
            # Cache the response
            if use_cache:
                self._cache_response(cache_key, content)
            
            return content
            
        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP error fetching {url}: {e.response.status_code}"
            logger.error(error_msg)
            raise UCCFetchError(error_msg, status_code=e.response.status_code, url=url)
        except httpx.RequestError as e:
            error_msg = f"Request error fetching {url}: {str(e)}"
            logger.error(error_msg)
            raise UCCFetchError(error_msg, url=url)
    
    async def get_article_list(self) -> List[UCCArticleInfo]:
        """
        Fetch the list of UCC articles from Cornell Law School.
        
        Returns:
            List of UCCArticleInfo objects
        """
        try:
            content = await self._fetch_url(self.base_url)
            soup = BeautifulSoup(content, 'html.parser')
            
            articles = []
            
            # Look for article links in the main navigation or content area
            # Cornell's UCC page typically has links to each article
            article_links = soup.find_all('a', href=re.compile(r'/ucc/\d+'))
            
            for link in article_links:
                if not isinstance(link, Tag):
                    continue
                href = link.get('href', '')
                if not isinstance(href, str):
                    continue
                article_match = re.search(r'/ucc/(\d+[A-Z]?)', href)
                
                if article_match:
                    article_num = article_match.group(1)
                    if article_num in self.ucc_articles:
                        article_name = self.ucc_articles[article_num]
                        full_url = urljoin(self.base_url, str(href))
                        
                        articles.append(UCCArticleInfo(
                            number=article_num,
                            name=article_name,
                            url=full_url
                        ))
            
            # If we didn't find links, create articles based on known structure
            if not articles:
                logger.warning("No article links found, creating from known structure")
                for article_num, article_name in self.ucc_articles.items():
                    url = f"{self.base_url}/{article_num}"
                    articles.append(UCCArticleInfo(
                        number=article_num,
                        name=article_name,
                        url=url
                    ))
            
            logger.info(f"Found {len(articles)} UCC articles")
            return articles
            
        except Exception as e:
            logger.error(f"Error fetching article list: {e}")
            raise UCCFetchError(f"Failed to fetch article list: {str(e)}")
    
    async def get_article_structure(self, article_info: UCCArticleInfo) -> Tuple[List[UCCPartInfo], List[str]]:
        """
        Fetch the structure of a UCC article (parts and section list).
        
        Args:
            article_info: Article information
            
        Returns:
            Tuple of (parts_list, section_urls)
        """
        try:
            content = await self._fetch_url(article_info.url)
            soup = BeautifulSoup(content, 'html.parser')
            
            parts = []
            section_urls = []
            
            # Look for parts structure
            part_headings = soup.find_all(['h2', 'h3', 'h4'], string=re.compile(r'Part\s+\d+', re.IGNORECASE))
            for heading in part_headings:
                part_match = re.search(r'Part\s+(\d+[A-Z]?)', heading.get_text(), re.IGNORECASE)
                if part_match:
                    part_number = part_match.group(1)
                    part_name = heading.get_text().strip()
                    
                    parts.append(UCCPartInfo(
                        number=part_number,
                        name=part_name,
                        article_number=article_info.number
                    ))
            
            # Look for section links - Cornell Law uses /ucc/article/article-section format
            section_links = soup.find_all('a', href=re.compile(rf'/ucc/{re.escape(article_info.number)}/{re.escape(article_info.number)}-\d+'))
            for link in section_links:
                if not isinstance(link, Tag):
                    continue
                href = link.get('href', '')
                if not isinstance(href, str):
                    continue
                full_url = urljoin(self.base_url, str(href))
                if full_url not in section_urls:
                    section_urls.append(full_url)
            
            # If no section links found, try alternative patterns
            if not section_urls:
                # Look for sections in the content
                section_patterns = [
                    rf'§\s*{re.escape(article_info.number)}-\d+',
                    rf'{re.escape(article_info.number)}-\d+',
                ]
                
                for pattern in section_patterns:
                    matches = re.findall(pattern, content)
                    for match in matches:
                        section_num = re.search(r'(\d+-\d+)', match)
                        if section_num:
                            section_url = f"{self.base_url}/{section_num.group(1)}"
                            if section_url not in section_urls:
                                section_urls.append(section_url)
            
            logger.info(f"Article {article_info.number}: Found {len(parts)} parts and {len(section_urls)} sections")
            return parts, section_urls
            
        except Exception as e:
            logger.error(f"Error fetching article structure for {article_info.number}: {e}")
            raise UCCFetchError(f"Failed to fetch article structure: {str(e)}")
    
    async def fetch_section(self, section_url: str) -> UCCSectionInfo:
        """
        Fetch a complete UCC section with content and metadata.
        
        Args:
            section_url: URL of the section to fetch
            
        Returns:
            UCCSectionInfo object with parsed content
        """
        try:
            content = await self._fetch_url(section_url)
            soup = BeautifulSoup(content, 'html.parser')
            
            # Extract section number and citation from URL or content - Cornell Law format: /ucc/1/1-101
            section_match = re.search(r'/ucc/(\d+[A-Z]?)/\1-(\d+)', section_url)
            if not section_match:
                raise UCCFetchError(f"Could not parse section number from URL: {section_url}")
            
            article_number = section_match.group(1)
            section_number = section_match.group(2)
            citation = f"UCC {article_number}-{section_number}"
            
            # Extract heading
            heading = ""
            heading_selectors = [
                'h1', 'h2', '.section-title', '.section-heading',
                f'*[id*="{article_number}-{section_number}"]'
            ]
            
            for selector in heading_selectors:
                heading_elem = soup.select_one(selector)
                if heading_elem:
                    heading = heading_elem.get_text().strip()
                    # Clean up the heading
                    heading = re.sub(rf'^§?\s*{re.escape(citation)}\s*\.?\s*', '', heading, flags=re.IGNORECASE)
                    if heading:
                        break
            
            # Extract main content
            content_elem = soup.find('div', class_='content') or soup.find('div', id='content') or soup.find('main')
            if not content_elem:
                content_elem = soup
            
            # Get HTML content
            html_content = str(content_elem)
            
            # Get clean text content
            text_content = content_elem.get_text()
            
            # Clean up the text content
            lines = [line.strip() for line in text_content.split('\n') if line.strip()]
            clean_content = '\n'.join(lines)
            
            # Extract subsections
            subsections = self._extract_subsections(content_elem) if isinstance(content_elem, (BeautifulSoup, Tag)) else []
            
            # Extract official comments
            official_comment = self._extract_official_comment(content_elem) if isinstance(content_elem, (BeautifulSoup, Tag)) else None
            
            return UCCSectionInfo(
                number=section_number,
                citation=citation,
                heading=heading,
                content=clean_content,
                html_content=html_content,
                article_number=article_number,
                subsections=subsections,
                official_comment=official_comment,
                source_url=section_url,
                last_modified=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Error fetching section {section_url}: {e}")
            raise UCCFetchError(f"Failed to fetch section: {str(e)}")
    
    def _extract_subsections(self, content_elem) -> List[Dict[str, Any]]:
        """Extract subsections from section content"""
        subsections = []
        
        # Look for common subsection patterns
        subsection_patterns = [
            r'\(([a-z])\)',  # (a), (b), (c)
            r'\((\d+)\)',    # (1), (2), (3)
            r'\(([ivx]+)\)', # (i), (ii), (iii)
        ]
        
        content_text = content_elem.get_text()
        
        for level, pattern in enumerate(subsection_patterns, 1):
            matches = re.finditer(pattern, content_text)
            for match in matches:
                subsection_num = match.group(1)
                start_pos = match.start()
                
                # Try to extract the content following this subsection marker
                # This is a simplified approach - more sophisticated parsing might be needed
                remaining_text = content_text[start_pos:]
                lines = remaining_text.split('\n')
                subsection_content = lines[0] if lines else ""
                
                if subsection_content:
                    subsections.append({
                        'number': f"({subsection_num})",
                        'content': subsection_content.strip(),
                        'level': level,
                        'order': len(subsections) + 1
                    })
        
        return subsections
    
    def _extract_official_comment(self, content_elem) -> Optional[str]:
        """Extract official comment if present"""
        # Look for official comment sections
        comment_selectors = [
            '.official-comment',
            '.comment',
            '*[class*="comment"]',
            '*[id*="comment"]'
        ]
        
        for selector in comment_selectors:
            comment_elem = content_elem.select_one(selector)
            if comment_elem:
                return comment_elem.get_text().strip()
        
        # Look for text patterns that indicate official comments
        content_text = content_elem.get_text()
        comment_match = re.search(r'Official Comment[:\s]+(.*?)(?:\n\n|\Z)', content_text, re.DOTALL | re.IGNORECASE)
        if comment_match:
            return comment_match.group(1).strip()
        
        return None
    
    async def fetch_article_sections(self, article_info: UCCArticleInfo) -> List[UCCSectionInfo]:
        """
        Fetch all sections for a given UCC article.
        
        Args:
            article_info: Article information
            
        Returns:
            List of UCCSectionInfo objects
        """
        try:
            logger.info(f"Fetching sections for UCC Article {article_info.number}")
            
            # Get article structure
            parts, section_urls = await self.get_article_structure(article_info)
            
            sections = []
            
            # Fetch each section
            for i, section_url in enumerate(section_urls):
                try:
                    section = await self.fetch_section(section_url)
                    sections.append(section)
                    
                    # Progress logging
                    if (i + 1) % 10 == 0:
                        logger.info(f"Fetched {i + 1}/{len(section_urls)} sections for Article {article_info.number}")
                        
                except Exception as e:
                    logger.error(f"Failed to fetch section {section_url}: {e}")
                    continue
            
            logger.info(f"Successfully fetched {len(sections)} sections for Article {article_info.number}")
            return sections
            
        except Exception as e:
            logger.error(f"Error fetching article sections for {article_info.number}: {e}")
            raise UCCFetchError(f"Failed to fetch article sections: {str(e)}")
    
    async def fetch_all_ucc_content(self) -> Dict[str, Any]:
        """
        Fetch complete UCC content from Cornell Law School.
        
        Returns:
            Dictionary containing all UCC articles, parts, and sections
        """
        try:
            logger.info("Starting complete UCC content fetch")
            start_time = datetime.now()
            
            # Get article list
            articles = await self.get_article_list()
            
            result = {
                'articles': [],
                'parts': [],
                'sections': [],
                'fetch_metadata': {
                    'started_at': start_time.isoformat(),
                    'source': 'Cornell Law School',
                    'base_url': self.base_url,
                    'total_articles': len(articles)
                }
            }
            
            # Fetch content for each article
            for article in articles:
                try:
                    logger.info(f"Processing Article {article.number}: {article.name}")
                    
                    # Get article structure
                    parts, section_urls = await self.get_article_structure(article)
                    
                    # Fetch sections
                    sections = await self.fetch_article_sections(article)
                    
                    # Add to result
                    result['articles'].append(asdict(article))
                    result['parts'].extend([asdict(part) for part in parts])
                    result['sections'].extend([asdict(section) for section in sections])
                    
                    logger.info(f"Completed Article {article.number}: {len(sections)} sections fetched")
                    
                except Exception as e:
                    logger.error(f"Failed to process Article {article.number}: {e}")
                    continue
            
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            result['fetch_metadata'].update({
                'completed_at': end_time.isoformat(),
                'duration_seconds': duration,
                'total_sections_fetched': len(result['sections']),
                'total_parts_found': len(result['parts'])
            })
            
            logger.info(f"UCC content fetch completed in {duration:.2f} seconds")
            logger.info(f"Fetched {len(result['sections'])} sections across {len(result['articles'])} articles")
            
            return result
            
        except Exception as e:
            logger.error(f"Error in complete UCC content fetch: {e}")
            raise UCCFetchError(f"Failed to fetch UCC content: {str(e)}")

# CLI interface for testing
async def main():
    """Main function for CLI testing"""
    import argparse
    
    parser = argparse.ArgumentParser(description="UCC Content Fetcher")
    parser.add_argument("--article", help="Fetch specific article (e.g., '1', '2A')")
    parser.add_argument("--list-articles", action="store_true", help="List available articles")
    parser.add_argument("--output", help="Output file for JSON results")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)
    
    async with UCCFetcher() as fetcher:
        if args.list_articles:
            articles = await fetcher.get_article_list()
            print("Available UCC Articles:")
            for article in articles:
                print(f"  Article {article.number}: {article.name}")
                
        elif args.article:
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
            result = {
                'article': asdict(target_article),
                'sections': [asdict(section) for section in sections]
            }
            
            if args.output:
                with open(args.output, 'w') as f:
                    json.dump(result, f, indent=2, default=str)
                print(f"Results written to {args.output}")
            else:
                print(json.dumps(result, indent=2, default=str))
                
        else:
            result = await fetcher.fetch_all_ucc_content()
            
            if args.output:
                with open(args.output, 'w') as f:
                    json.dump(result, f, indent=2, default=str)
                print(f"Results written to {args.output}")
            else:
                print(json.dumps(result, indent=2, default=str))

if __name__ == "__main__":
    asyncio.run(main())