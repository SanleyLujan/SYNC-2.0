import { Injectable } from '@nestjs/common';

/** Account records are retained; there is deliberately no purge cron. */
@Injectable()
export class UsersCleanupService {
  async purgeExpiredDeletions(): Promise<void> {}
}
