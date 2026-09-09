// Isolated PostgreSQL/WASM integration test. Never reads .env or connects remotely.
// Run: node -r ts-node/register scripts/check-gamification.cjs <path-to-pglite-package>
process.env.NODE_ENV = 'production';
process.env.TZ = 'UTC';
require('reflect-metadata');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');
const { PGlite } = require(process.argv[2]);
const { DataSource, EntitySchema } = require('typeorm');
const { User } = require('../src/users/entities/user.entity');
const { Activity } = require('../src/activities/entities/activity.entity');
const { Challenge } = require('../src/challenges/entities/challenge.entity');
const { Match } = require('../src/matching/entities/match.entity');
const { UserBlock } = require('../src/users/entities/user-block.entity');
const { Reward } = require('../src/gamification/reward.entity');
const { UserAchievement, AchievementType, ACHIEVEMENT_INFO } = require('../src/achievements/entities/achievement.entity');
const { GamificationService } = require('../src/gamification/gamification.service');
const { ChallengesService } = require('../src/challenges/challenges.service');
const { Gamification1788900000000 } = require('../src/migrations/1788900000000-Gamification');
const { dayKey } = require('../src/gamification/rules');
const { RefreshToken } = require('../src/auth/entities/refresh-token.entity');
const { RefreshTokenService } = require('../src/auth/refresh-token.service');
const { VerificationRequest } = require('../src/verification/verification-request.entity');
const { VerificationService } = require('../src/verification/verification.service');
const { JwtService } = require('@nestjs/jwt');
const pg = new PGlite();
// PGlite has one connection: serialize acquisition, preserving transaction boundaries.
let tail = Promise.resolve();
class Pool extends EventEmitter {
  connect(cb) {
    const prior = tail;
    let release;
    tail = new Promise(resolve => { release = resolve; });
    prior.then(() => {
      const client = new EventEmitter();
      client.query = (sql, params, callback) => {
        if (typeof params === 'function') { callback = params; params = []; }
        const promise = pg.query(sql, (params || []).map(p => p instanceof Date ? p.toISOString() : p))
          .then(r => ({ ...r, rowCount: r.affectedRows ?? r.rows.length }));
        if (callback) promise.then(r => callback(null,r), callback);
        return promise;
      };
      cb(null, client, release);
    });
  }
  end(cb) { if (cb) cb(); return Promise.resolve(); }
}

const path = require('node:path');
const { TerritoryCell } = require('../src/territory/entities/territory-cell.entity');
const { TerritoryService } = require('../src/territory/territory.service');
const { Segment } = require('../src/segments/segment.entity');
const { SegmentEffort } = require('../src/segments/segment-effort.entity');
const { SegmentsController } = require('../src/segments/segments.controller');
const { SegmentsMatchService } = require('../src/segments/segments-match.service');
const { UsersService } = require('../src/users/users.service');
const { Follow } = require('../src/follows/follow.entity');
const { FollowsController } = require('../src/follows/follows.controller');
const { StatsController } = require('../src/stats/stats.controller');
const { ActivitiesService } = require('../src/activities/activities.service');
const { StatsService } = require('../src/stats/stats.service');
const { AchievementsService } = require('../src/achievements/achievements.service');
const { ActivityPoint } = require('../src/activities/entities/activity-point.entity');
const { Event } = require('../src/events/entities/event.entity');
const { Like } = require('../src/matching/entities/like.entity');
const { Message } = require('../src/chat/entities/message.entity');
const { CompleteRedTopics1789000000000 } = require('../src/migrations/1789000000000-CompleteRedTopics');
const db = new DataSource({ type:'postgres', driver:{Pool},uuidExtension:'pgcrypto',installExtensions:false,
 entities:[path.join(__dirname,'../src/**/*.entity.ts')],synchronize:true });
const notices={create:async()=>({})};
async function run() {
 await db.initialize();
 const migration=new CompleteRedTopics1789000000000();
 const runner=db.createQueryRunner();
 // Reconstruct the prior schema only in this disposable in-memory database.
 for (const [table,column] of [['activities','territoryProcessed'],['activities','territoryOptIn'],['activities','segmentsOptIn'],
   ['activities','plannedRoute'],['territory_cells','capturedAt'],['segments','geometry'],['segment_efforts','verified'],['user_achievements','claimKey']]) {
   await runner.query('ALTER TABLE "'+table+'" DROP COLUMN "'+column+'"');
 }
 await migration.up(runner); await migration.up(runner);
 await runner.release();
 const repo=target=>db.getRepository(target);
 const owner=await repo(User).save(repo(User).create({name:'Teste A',email:'a@example.invalid',password:'test-only-not-a-real-hash',sports:['walking'],onboardingCompleted:true}));
 const other=await repo(User).save(repo(User).create({name:'Teste B',email:'b@example.invalid',password:'test-only-not-a-real-hash'}));
 const usersService=new UsersService(repo(User),repo(UserBlock),null,repo(Match));
 assert.equal((await usersService.searchUsers('Teste B',owner.id)).users.length,1);
 await repo(Like).save(repo(Like).create({from_user_id:owner.id,to_user_id:other.id}));
 assert.equal((await usersService.searchUsers('Teste B',owner.id)).users[0].matchStatus,'pending');
 const followers=new FollowsController(repo(Follow),repo(User));
 await Promise.all([followers.follow(owner,other.id),followers.follow(owner,other.id)]);
 assert.equal((await followers.counts(owner)).following,1);
 assert.equal((await followers.myFollowing(owner))[0].email,undefined);
 await repo(UserBlock).save(repo(UserBlock).create({blocker_id:other.id,blocked_id:owner.id}));
 assert.equal((await followers.status(owner,other.id)).isFollowing,false);
 assert.equal((await followers.myFollowing(owner)).length,0);
 assert.equal((await usersService.searchUsers('Teste B',owner.id)).users.length,0);
 await assert.rejects(()=>followers.follow(owner,other.id));
 await repo(UserBlock).delete({blocker_id:other.id,blocked_id:owner.id});
 const end=Date.now()-1000,start=end-120000;
 const workout=await repo(Activity).save(repo(Activity).create({user_id:owner.id,sport:'walking',startTime:new Date(start),
  endTime:new Date(end),duration:120,distance:133,calories:17,isCompleted:true,territoryOptIn:true,
  plannedRoute:[{latitude:0,longitude:0},{latitude:0,longitude:.0012}]}));
 await repo(ActivityPoint).save(Array.from({length:121},(_,i)=>repo(ActivityPoint).create({
  activity_id:workout.id,latitude:0,longitude:i*.00001,timestamp:new Date(start+i*1000),segmentStart:false})));
 // Planned destination is excluded from generic/public entity reads.
 assert.equal((await repo(Activity).findOneBy({id:workout.id})).plannedRoute,undefined);
 const territory=new TerritoryService(repo(TerritoryCell),repo(User));
 await assert.rejects(()=>territory.claim(other.id,workout.id));
 const claims=await Promise.all([territory.claim(owner.id,workout.id),territory.claim(owner.id,workout.id)]);
 assert.ok(claims[0].claimed>0); assert.equal(claims[1].claimed,0);
 assert.ok((await territory.leaderboard())[0].cells>0);
 assert.ok((await territory.cellsInBox(-1,-1,1,1)).length>0);
 const matcher=new SegmentsMatchService(repo(Segment),repo(SegmentEffort),notices);
 const segments=new SegmentsController(repo(Segment),repo(SegmentEffort),repo(Follow),notices,matcher);
 await assert.rejects(()=>segments.create(other,{name:'Invasão',activityId:workout.id}));
 const segment=await segments.create(owner,{name:'Trecho de teste',activityId:workout.id});
 assert.ok(segment.geometry.length>2);
 await Promise.all([matcher.matchActivity(owner.id,workout.id),matcher.matchActivity(owner.id,workout.id)]);
 assert.equal(await repo(SegmentEffort).countBy({verified:true}),1);
 await assert.rejects(()=>segments.recordEffort(other,segment.id,{elapsedSec:1}));
 await repo(SegmentEffort).save(repo(SegmentEffort).create({segmentId:segment.id,userId:other.id,elapsedSec:1,verified:false}));
 const board=await segments.leaderboard(segment.id);
 assert.equal(board.length,1); assert.equal(board[0].userId,owner.id);
 assert.equal((await segments.myEfforts(owner,segment.id)).count,1);
 const stats=new StatsService(repo(Activity),repo(Match),repo(Event),repo(Message));
 const totals=await stats.getUserStats(owner.id,'week');
 assert.equal(totals.totalDistance,133); assert.equal(totals.totalDuration,120);assert.equal(totals.totalCalories,17);
 const apiStats=new StatsController(stats);
 const legacy=await apiStats.getUserStats(owner,'week','1');
 assert.equal(legacy.totalDistance,.133); assert.equal(legacy.schemaVersion,1);
 assert.equal((await apiStats.getUserStats(owner,'week','2')).totalDistance,133);
 const detailService=Object.create(ActivitiesService.prototype); detailService.activityRepository=repo(Activity);
 assert.equal((await detailService.getActivityDetail(workout.id,owner.id)).plannedRoute.length,2);
 await assert.rejects(()=>detailService.getActivityDetail(workout.id,other.id));
 assert.equal(totals.totalActivities,1); assert.equal(totals.averagePace,0);
 const medals=new AchievementsService(repo(UserAchievement),repo(Activity),repo(Match),repo(Like),repo(Event),notices,{summary:async()=>({totalXP:0})});
 await Promise.all([medals.checkAndUnlock(owner.id),medals.checkAndUnlock(owner.id)]);
 assert.equal(await repo(UserAchievement).countBy({user_id:owner.id,type:'first_activity'}),1);
 assert.ok((await medals.getUserAchievements(owner.id)).some(a=>!a.unlockedAt));
 assert.equal(await repo(UserAchievement).countBy({user_id:other.id}),0);
 await repo(User).update(owner.id,{isActive:false});
 assert.deepEqual(await territory.leaderboard(),[]);
 assert.deepEqual(await segments.leaderboard(segment.id),[]);
 console.log('PASS: real PostgreSQL entities, repeatable migration, private route, follows/block, territory ownership/replay, segment GPS/manual rejection, stats units and achievement concurrency.');
 await db.destroy(); await pg.close();
}
run().catch(async e=>{console.error(e);try{await db.destroy();await pg.close();}catch{}process.exitCode=1;});
