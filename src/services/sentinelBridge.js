// sentinelBridge.js — Redis Subscriber → BullMQ Queue
const Redis = require('ioredis');
const { Queue } = require('bullmq');

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const SOLVER_QUEUE = new Queue('solver-queue', { connection: REDIS_CONFIG });

class SentinelBridge {
  constructor() {
    this.subscriber = new Redis(REDIS_CONFIG);
    this.publisher = new Redis(REDIS_CONFIG);
    this.channel = 'sentinel:events';
  }

  start() {
    console.log(`[SentinelBridge] Subscribing to ${this.channel}...`);
    
    this.subscriber.subscribe(this.channel, (err) => {
      if (err) {
        console.error('[SentinelBridge] Subscribe error:', err);
        return;
      }
      console.log('[SentinelBridge] Connected to Redis');
    });

    this.subscriber.on('message', (channel, message) => {
      if (channel !== this.channel) return;
      
      try {
        const event = JSON.parse(message);
        this.handleEvent(event);
      } catch (err) {
        console.error('[SentinelBridge] Parse error:', err);
      }
    });
  }

  handleEvent(event) {
    console.log(`[SentinelBridge] Event: ${event.type}`);
    
    switch (event.type) {
      case 'nonce_reuse':
        this.handleNonceReuse(event.payload);
        break;
      case 'watched_address':
        this.handleWatchedAddress(event.payload);
        break;
      default:
        console.log(`[SentinelBridge] Unknown event: ${event.type}`);
    }
  }

  async handleNonceReuse(payload) {
    console.log(`[SentinelBridge] NONCE REUSE → Creating solver job`);
    
    const job = await SOLVER_QUEUE.add('sentinel-nonce-reuse', {
      type: 'lambda',
      public_key: payload.public_key,
      range_start: '1',
      range_end: '140',
      threads: parseInt(process.env.SOLVER_THREADS || '24'),
      source: 'ecdsa-sentinel',
      detection_type: 'nonce_reuse',
      confidence: payload.confidence || 1.0,
    }, {
      priority: 1,
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
    });
    
    console.log(`[SentinelBridge] Job ${job.id} created`);
    
    this.publisher.publish('puzzleradar:alerts', JSON.stringify({
      type: 'sentinel:nonce_reuse',
      jobId: job.id,
      data: payload,
      timestamp: Date.now(),
    }));
  }

  async handleWatchedAddress(payload) {
    console.log(`[SentinelBridge] WATCHED → Creating solver job`);
    
    const job = await SOLVER_QUEUE.add('sentinel-watched', {
      type: 'lambda',
      public_key: payload.public_key,
      range_start: '1',
      range_end: '140',
      threads: parseInt(process.env.SOLVER_THREADS || '24'),
      source: 'ecdsa-sentinel',
      detection_type: 'watched_address',
    }, {
      priority: 2,
      attempts: 1,
    });
    
    console.log(`[SentinelBridge] Job ${job.id} created`);
    
    this.publisher.publish('puzzleradar:alerts', JSON.stringify({
      type: 'sentinel:watched_address',
      jobId: job.id,
      data: payload,
      timestamp: Date.now(),
    }));
  }

  stop() {
    this.subscriber.disconnect();
    this.publisher.disconnect();
  }
}

module.exports = SentinelBridge;
