interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private timestamps: number[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  checkRateLimit(): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Remove old timestamps
    this.timestamps = this.timestamps.filter(timestamp => timestamp > windowStart);
    
    if (this.timestamps.length >= this.config.maxRequests) {
      return false;
    }
    
    this.timestamps.push(now);
    return true;
  }

  getRemainingRequests(): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Remove old timestamps
    this.timestamps = this.timestamps.filter(timestamp => timestamp > windowStart);
    
    return Math.max(0, this.config.maxRequests - this.timestamps.length);
  }
}

export const defaultRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000 // 1 minute
}); 