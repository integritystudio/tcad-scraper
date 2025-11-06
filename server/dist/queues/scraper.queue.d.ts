import Bull from 'bull';
import { ScrapeJobData } from '../types';
export declare const scraperQueue: Bull.Queue<ScrapeJobData>;
export declare function canScheduleJob(searchTerm: string): Promise<boolean>;
//# sourceMappingURL=scraper.queue.d.ts.map