/**
 * Rate limiting utility to prevent abuse
 * 
 * This module implements a sliding window rate limiter that can
 * be used to limit the number of requests or operations within
 * a specific time window.
 */

/**
 * Configuration interface for the rate limiter
 * 
 * @property maxRequests - Maximum number of requests allowed in the time window
 * @property windowMs - Time window in milliseconds
 */
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * RateLimiter class that implements a sliding window rate limiting algorithm
 * 
 * This rate limiter tracks timestamps of operations and allows or rejects
 * new operations based on how many have occurred within the configured time window.
 */
export class RateLimiter {
  /**
   * Array of timestamps representing when requests/operations occurred
   * Only stores timestamps that are within the current time window
   */
  private timestamps: number[] = [];

  /**
   * Configuration for the rate limiter
   */
  private config: RateLimitConfig;

  /**
   * Creates a new rate limiter with the specified configuration
   * 
   * @param config - Configuration specifying max requests and time window
   */
  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Checks if a new request should be allowed based on rate limiting rules
   * 
   * This method:
   * 1. Removes expired timestamps outside the current window
   * 2. Checks if the number of recent timestamps exceeds the limit
   * 3. If allowed, records the new timestamp
   * 
   * @returns boolean - True if request is allowed, false if rate limit is exceeded
   */
  checkRateLimit(): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Remove old timestamps outside the current window
    this.timestamps = this.timestamps.filter(timestamp => timestamp > windowStart);
    
    // Check if we've hit the limit
    if (this.timestamps.length >= this.config.maxRequests) {
      return false;
    }
    
    // Record this request
    this.timestamps.push(now);
    return true;
  }

  /**
   * Gets the number of remaining requests allowed in the current time window
   * 
   * @returns number - Number of remaining requests allowed (0 if limit reached)
   */
  getRemainingRequests(): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Remove old timestamps outside the current window
    this.timestamps = this.timestamps.filter(timestamp => timestamp > windowStart);
    
    return Math.max(0, this.config.maxRequests - this.timestamps.length);
  }
}

/**
 * Default instance of the rate limiter configured for 10 requests per minute
 * Used throughout the application for consistent rate limiting
 */
export const defaultRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000 // 1 minute
}); 