import { ActivityComment } from '../activities/entities/activity-comment.entity';
import { EventComment } from '../events/entities/event-comment.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAchievement, AchievementType, ACHIEVEMENT_INFO } from './entities/achievement.entity';
import { Activity } from '../activities/entities/activity.entity';
import { Match } from '../matching/entities/match.entity';
import { Like } from '../matching/entities/like.entity';
import { Event } from '../events/entities/event.entity';
import { User } from '../users/entities/user.entity';
import { Story } from '../stories/entities/story.entity';
import { Message } from '../chat/entities/message.entity';
import { FeedComment } from '../activity-feed/feed-comment.entity';
import { ActivityKudos } from '../activities/entities/activity-kudos.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { GamificationService } from '../gamification/gamification.service';
import { achievementRules, AVAILABLE_ACHIEVEMENTS } from './achievement-rules';

@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(UserAchievement) private readonly achievementRepository: Repository<UserAchievement>,
    @InjectRepository(Activity) private readonly activityRepository: Repository<Activity>,
    @InjectRepository(Match) private readonly matchRepository: Repository<Match>,
    @InjectRepository(Like) private readonly likeRepository: Repository<Like>,
    @InjectRepository(Event) private readonly eventRepository: Repository<Event>,
    private readonly notificationsService: NotificationsService,
    private readonly gamification: GamificationService,
  ) {}

  private present(a: UserAchievement) {
    return { id: a.id, type: a.type, unlockedAt: a.unlockedAt, ...ACHIEVEMENT_INFO[a.type], xp: 0 };
  }

  async getUserAchievements(userId: string) {
    await this.checkAndUnlock(userId);
    const unlocked = await this.achievementRepository.find({ where: { user_id: userId }, order: { unlockedAt: 'ASC' } });
    const unique = new Map<AchievementType, UserAchievement>();
    for (const a of unlocked) if (!unique.has(a.type)) unique.set(a.type, a);
    // Keep previously earned awards, even if no longer offered to new users.
    const catalog = [...new Set([...AVAILABLE_ACHIEVEMENTS, ...unique.keys()])];
    return catalog.map(type => unique.has(type) ? this.present(unique.get(type)!) :
      { id: type, type, unlockedAt: null, ...ACHIEVEMENT_INFO[type], xp: 0 });
  }

  async checkAndUnlock(userId: string) {
    const manager = this.achievementRepository.manager;
    const [activities, matches, events, superLikes, kudos, comments, stories, messages, flash, user] = await Promise.all([
      this.activityRepository.find({ where: { user_id: userId, isCompleted: true },
        select: ['sport','startTime','distance','duration','elevationGain'] }),
      this.matchRepository.createQueryBuilder('m').where('m.user1_id = :userId OR m.user2_id = :userId',{userId}).getCount(),
      this.eventRepository.count({ where:{creator_id:userId} }),
      this.likeRepository.count({ where:{from_user_id:userId,isSuperLike:true} }),
      manager.getRepository(ActivityKudos).createQueryBuilder('k').innerJoin('k.activity','a').where('a.user_id = :userId AND k.user_id != :userId',{userId}).getCount(),
      Promise.all([FeedComment, ActivityComment, EventComment].map(target => manager.getRepository(target).count({where:{user_id:userId}}))).then(counts => counts.reduce((a,b)=>a+b,0)),
      manager.getRepository(Story).count({where:{user_id:userId}}),
      manager.getRepository(Message).count({where:{sender_id:userId}}),
      this.eventRepository.count({where:{creator_id:userId,isFlash:true}}),
      manager.getRepository(User).findOneBy({id:userId,isActive:true}),
    ]);
    if (!user) return [];
    const types = achievementRules(activities,{matches,events,superLikes,kudos,comments,stories,messages,flash,
      profileComplete: !!(user.onboardingCompleted && user.avatarUrl && user.name && user.bio && user.sports?.length),
      birthDate:user.birthDate});
    const added = await manager.transaction(async tx => {
      const lock = tx.getRepository(User).createQueryBuilder('u').where('u.id = :userId',{userId});
      if (tx.connection.options.type === 'postgres') lock.setLock('pessimistic_write');
      if (!await lock.getOne()) return [];
      const repo=tx.getRepository(UserAchievement);
      const existing = new Set((await repo.find({where:{user_id:userId}})).map(a=>a.type));
      const result: UserAchievement[]=[];
      for (const type of types) {
        if (existing.has(type)) continue;
        result.push(await repo.save(repo.create({user_id:userId,type,claimKey:userId+':'+type})));
      }
      return result;
    });
    await Promise.allSettled(added.map(a => this.notificationsService.create(userId,NotificationType.ACHIEVEMENT_UNLOCKED,
      'Conquista desbloqueada!', ACHIEVEMENT_INFO[a.type].name + ' — ' + ACHIEVEMENT_INFO[a.type].description,
      JSON.stringify({achievementType:a.type}))));
    return added.map(a=>this.present(a));
  }

  async getUserXP(userId: string) {
    const catalog = await this.getUserAchievements(userId);
    return { ...await this.gamification.summary(userId), achievementsCount:catalog.filter(a=>a.unlockedAt).length,
      totalAchievements:catalog.length };
  }
  getUserLevel(xp:number) { return Math.floor(Math.max(0,xp)/500)+1; }
}
