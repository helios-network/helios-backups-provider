declare module 'stream-throttle' {
  import { Transform } from 'stream';
  
  interface ThrottleOptions {
    rate: number;
  }
  
  export class Throttle extends Transform {
    constructor(options: ThrottleOptions);
  }
} 