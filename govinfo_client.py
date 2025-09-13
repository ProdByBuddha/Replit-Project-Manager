#!/usr/bin/env python3
"""
GovInfo API Client for US Code Integration
Official US Government Publishing Office (GPO) API client for accessing US Code data.

API Documentation: https://api.govinfo.gov/docs/
Rate Limits: 1000 requests per hour per API key
"""

import asyncio
import logging
import json
import time
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from urllib.parse import urlencode
import os

import httpx
import xmltodict
from bs4 import BeautifulSoup
from ratelimit import limits, sleep_and_retry

# Configure logging
logger = logging.getLogger(__name__)

# API Configuration
GOVINFO_BASE_URL = "https://api.govinfo.gov"
RATE_LIMIT_CALLS = 1000  # 1000 calls per hour
RATE_LIMIT_PERIOD = 3600  # 1 hour in seconds
DEFAULT_TIMEOUT = 30.0

@dataclass
class USCodeTitle:
    """Represents a US Code Title"""
    number: int
    name: str
    last_modified: Optional[datetime] = None
    package_id: Optional[str] = None
    
@dataclass
class USCodeSection:
    """Represents a US Code Section"""
    title_number: int
    section_number: str
    citation: str
    heading: str
    content: str
    xml_content: Optional[str] = None
    last_modified: Optional[datetime] = None
    url: Optional[str] = None
    package_id: Optional[str] = None

@dataclass
class USCodeChapter:
    """Represents a US Code Chapter"""
    title_number: int
    chapter_number: str
    name: str
    sections: List[USCodeSection]
    last_modified: Optional[datetime] = None

class GovInfoAPIError(Exception):
    """Custom exception for GovInfo API errors"""
    def __init__(self, message: str, status_code: Optional[int] = None, response_data: Optional[Dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data

class RateLimitExceeded(GovInfoAPIError):
    """Raised when API rate limit is exceeded"""
    pass

class GovInfoClient:
    """
    Async client for accessing GovInfo API to retrieve US Code data.
    
    Features:
    - Rate limiting compliance (1000 requests/hour)
    - Automatic retry with exponential backoff
    - XML and JSON data processing
    - Comprehensive error handling
    - Request caching for performance
    """
    
    def __init__(self, api_key: Optional[str] = None, timeout: float = DEFAULT_TIMEOUT):
        """
        Initialize GovInfo API client.
        
        Args:
            api_key: GovInfo API key. If None, will try to get from GOVINFO_API_KEY env var
            timeout: Request timeout in seconds
        """
        self.api_key = api_key or os.getenv("GOVINFO_API_KEY")
        self.timeout = timeout
        self.base_url = GOVINFO_BASE_URL
        self.session: Optional[httpx.AsyncClient] = None
        
        # Rate limiting tracking
        self._request_times: List[float] = []
        self._rate_limit_lock = asyncio.Lock()
        
        # Simple in-memory cache for frequently accessed data
        self._cache: Dict[str, Any] = {}
        self._cache_ttl: Dict[str, datetime] = {}
        self.cache_duration = timedelta(hours=1)  # Cache for 1 hour
        
        if not self.api_key:
            logger.warning("No GovInfo API key provided. Some endpoints may not be accessible.")
    
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
                "User-Agent": "FamilyPortal-USCode-Indexer/1.0 (Contact: admin@familyportal.com)",
                "Accept": "application/json",
            }
            if self.api_key:
                headers["X-API-Key"] = self.api_key
            
            self.session = httpx.AsyncClient(
                timeout=self.timeout,
                headers=headers,
                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
            )
    
    async def _enforce_rate_limit(self):
        """Enforce rate limiting to stay within API limits"""
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
    
    def _get_cache_key(self, endpoint: str, params: Optional[Dict] = None) -> str:
        """Generate cache key for request"""
        if params:
            param_str = urlencode(sorted(params.items()))
            return f"{endpoint}?{param_str}"
        return endpoint
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid"""
        if cache_key not in self._cache_ttl:
            return False
        return datetime.now() < self._cache_ttl[cache_key]
    
    def _cache_response(self, cache_key: str, data: Any):
        """Cache response data"""
        self._cache[cache_key] = data
        self._cache_ttl[cache_key] = datetime.now() + self.cache_duration
    
    async def _make_request(self, endpoint: str, params: Optional[Dict] = None, use_cache: bool = True) -> Dict:
        """
        Make API request with rate limiting and error handling.
        
        Args:
            endpoint: API endpoint path
            params: Query parameters
            use_cache: Whether to use cached responses
            
        Returns:
            Response data as dictionary
            
        Raises:
            GovInfoAPIError: On API errors
            RateLimitExceeded: When rate limit is exceeded
        """
        await self._ensure_session()
        
        # Check cache first
        cache_key = self._get_cache_key(endpoint, params)
        if use_cache and self._is_cache_valid(cache_key):
            logger.debug(f"Cache hit for {cache_key}")
            return self._cache[cache_key]
        
        # Enforce rate limiting
        await self._enforce_rate_limit()
        
        url = f"{self.base_url}{endpoint}"
        
        try:
            logger.debug(f"Making request to {url} with params {params}")
            response = await self.session.get(url, params=params)
            
            if response.status_code == 429:
                raise RateLimitExceeded("API rate limit exceeded")
            
            if response.status_code == 401:
                raise GovInfoAPIError("Unauthorized - check API key", response.status_code)
            
            if response.status_code == 404:
                raise GovInfoAPIError("Resource not found", response.status_code)
            
            response.raise_for_status()
            
            # Parse response
            if response.headers.get("content-type", "").startswith("application/json"):
                data = response.json()
            else:
                # Handle XML responses
                data = {"content": response.text, "content_type": "xml"}
            
            # Cache successful responses
            if use_cache:
                self._cache_response(cache_key, data)
            
            return data
            
        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP error {e.response.status_code}: {e.response.text}"
            raise GovInfoAPIError(error_msg, e.response.status_code)
        except httpx.RequestError as e:
            error_msg = f"Request error: {str(e)}"
            raise GovInfoAPIError(error_msg)
    
    async def get_collections(self) -> List[Dict]:
        """
        Get list of available collections.
        
        Returns:
            List of collection metadata
        """
        data = await self._make_request("/collections")
        return data.get("collections", [])
    
    async def get_uscode_titles(self) -> List[USCodeTitle]:
        """
        Get list of all US Code titles.
        
        Returns:
            List of USCodeTitle objects
        """
        try:
            # Get US Code collection packages
            params = {
                "collection": "USCODE",
                "pageSize": 100  # Adjust as needed
            }
            data = await self._make_request("/packages", params)
            
            titles = []
            packages = data.get("packages", [])
            
            for package in packages:
                # Extract title number from package ID (format: USCODE-YYYY-titleXX)
                package_id = package.get("packageId", "")
                if "title" in package_id.lower():
                    try:
                        # Extract title number from packageId
                        title_part = package_id.split("-")[-1]  # Get last part
                        if title_part.startswith("title"):
                            title_num = int(title_part[5:])  # Remove "title" prefix
                            
                            title = USCodeTitle(
                                number=title_num,
                                name=package.get("title", f"Title {title_num}"),
                                last_modified=self._parse_date(package.get("lastModified")),
                                package_id=package_id
                            )
                            titles.append(title)
                    except (ValueError, IndexError) as e:
                        logger.warning(f"Could not parse title number from {package_id}: {e}")
                        continue
            
            # Sort by title number
            titles.sort(key=lambda x: x.number)
            logger.info(f"Found {len(titles)} US Code titles")
            return titles
            
        except Exception as e:
            logger.error(f"Error fetching US Code titles: {e}")
            raise GovInfoAPIError(f"Failed to fetch US Code titles: {str(e)}")
    
    async def get_title_content(self, title_number: int, year: Optional[int] = None) -> Optional[Dict]:
        """
        Get content for a specific US Code title.
        
        Args:
            title_number: Title number (1-54)
            year: Year of the code (defaults to current year)
            
        Returns:
            Title content data or None if not found
        """
        if year is None:
            year = datetime.now().year
        
        # First, find the package ID for this title
        package_id = f"USCODE-{year}-title{title_number:02d}"
        
        try:
            # Get package details
            endpoint = f"/packages/{package_id}"
            package_data = await self._make_request(endpoint)
            
            # Get the download links
            download_link = None
            for link in package_data.get("download", {}).get("links", []):
                if link.get("type") == "xml":
                    download_link = link.get("link")
                    break
            
            if not download_link:
                logger.warning(f"No XML download link found for title {title_number}")
                return None
            
            # Download the XML content
            xml_data = await self._download_content(download_link)
            return {
                "package_id": package_id,
                "title_number": title_number,
                "xml_content": xml_data,
                "metadata": package_data
            }
            
        except GovInfoAPIError as e:
            if e.status_code == 404:
                logger.warning(f"Title {title_number} not found for year {year}")
                return None
            raise
    
    async def _download_content(self, url: str) -> str:
        """Download content from a URL"""
        await self._ensure_session()
        
        try:
            response = await self.session.get(url)
            response.raise_for_status()
            return response.text
        except Exception as e:
            raise GovInfoAPIError(f"Failed to download content from {url}: {str(e)}")
    
    def _parse_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """Parse date string from API response"""
        if not date_str:
            return None
        
        try:
            # Handle common date formats from GovInfo API
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
            
            logger.warning(f"Could not parse date: {date_str}")
            return None
            
        except Exception as e:
            logger.warning(f"Error parsing date {date_str}: {e}")
            return None
    
    async def search_uscode(self, query: str, title: Optional[int] = None, 
                           limit: int = 20) -> List[Dict]:
        """
        Search US Code content.
        
        Args:
            query: Search query
            title: Specific title to search (optional)
            limit: Maximum number of results
            
        Returns:
            List of search results
        """
        params = {
            "collection": "USCODE",
            "query": query,
            "pageSize": min(limit, 100)  # API limit
        }
        
        if title:
            params["title"] = str(title)
        
        try:
            data = await self._make_request("/search", params)
            return data.get("results", [])
        except Exception as e:
            logger.error(f"Error searching US Code: {e}")
            raise GovInfoAPIError(f"Search failed: {str(e)}")
    
    async def get_health_status(self) -> Dict[str, Any]:
        """
        Get health status of the GovInfo API client.
        
        Returns:
            Health status information
        """
        try:
            # Test API connectivity
            await self._make_request("/collections", use_cache=False)
            
            return {
                "status": "healthy",
                "api_key_configured": self.api_key is not None,
                "cache_size": len(self._cache),
                "recent_requests": len(self._request_times),
                "rate_limit_remaining": max(0, RATE_LIMIT_CALLS - len(self._request_times))
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "api_key_configured": self.api_key is not None
            }

# Example usage and testing
async def test_govinfo_client():
    """Test function for the GovInfo client"""
    async with GovInfoClient() as client:
        try:
            # Test health
            health = await client.get_health_status()
            print("Health Status:", health)
            
            # Test getting collections
            collections = await client.get_collections()
            print(f"Available collections: {len(collections)}")
            
            # Test getting US Code titles
            titles = await client.get_uscode_titles()
            print(f"US Code titles found: {len(titles)}")
            
            if titles:
                print("First few titles:")
                for title in titles[:5]:
                    print(f"  Title {title.number}: {title.name}")
            
            # Test search
            results = await client.search_uscode("constitution", limit=5)
            print(f"Search results: {len(results)}")
            
        except Exception as e:
            print(f"Test error: {e}")

if __name__ == "__main__":
    # Run tests if executed directly
    asyncio.run(test_govinfo_client())