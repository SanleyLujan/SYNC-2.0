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
const schema = (target, name, columns) => new EntitySchema({ target, name: target.name, tableName: name, columns });
const id = { type: 'uuid', primary: true, generated: 'uuid' };
const db = new DataSource({ type: 'postgres', driver: { Pool }, uuidExtension: 'pgcrypto', installExtensions: false,
  entities: [
    schema(User, 'users', { id, totalXP: { type: Number, default: 0 }, name: {type:String}, avatarUrl: {type:String,nullable:true}, isActive: {type:Boolean,default:true}, sports: {type:'simple-array',nullable:true}, createdAt:{type:Date}, gamificationStartedAt:{type:Date} }),
    schema(Activity, 'activities', { id, user_id:{type:'uuid'}, sport:{type:String}, startTime:{type:Date}, endTime:{type:Date}, duration:{type:Number}, pausedDuration:{type:Number,default:0}, distance:{type:'real',default:0}, isCompleted:{type:Boolean,default:true} }),
    schema(Match, 'matches', {id,user1_id:{type:'uuid'},user2_id:{type:'uuid'}}),
    schema(UserBlock, 'user_blocks', {id,blocker_id:{type:'uuid'},blocked_id:{type:'uuid'}}),
    schema(UserAchievement, 'user_achievements', {id,user_id:{type:'uuid'},type:{type:String},unlockedAt:{type:Date}}),
    schema(Reward, 'gamification_rewards', {id,user_id:{type:'uuid'},source:{type:String,length:120},day:{type:String,length:10},xp:{type:Number,default:0},data:{type:'simple-json',nullable:true},createdAt:{type:Date,createDate:true}}),
    schema(Challenge, 'challenges', {id,challenger_id:{type:'uuid'},challenged_id:{type:'uuid'},sport:{type:String},metric:{type:String},target:{type:'float'},status:{type:String,default:'pending'},winner_id:{type:String,nullable:true},expiresAt:{type:Date,nullable:true},acceptedAt:{type:Date,nullable:true},ruleVersion:{type:Number,default:1},createdAt:{type:Date,createDate:true}}),
  ], synchronize: true,
});
async function run() {
  await db.initialize();
  // Test the actual production migration against a representative legacy schema.
  await db.query('DROP TABLE gamification_rewards');
  await db.query('ALTER TABLE users DROP COLUMN "gamificationStartedAt"');
  await db.query('ALTER TABLE challenges DROP COLUMN "acceptedAt", DROP COLUMN "ruleVersion"');
  const migration = new Gamification1788900000000();
  await migration.up({query:(sql) => db.query(sql)});
  await migration.up({query:(sql) => db.query(sql)});
  const gamification = new GamificationService(db);
  const challenges = new ChallengesService(db, gamification);
  const now = Date.now(), start = new Date(now-5*86400000);
  const a = randomUUID(), b = randomUUID(), outsider = randomUUID();
  for (const uid of [a,b,outsider]) await db.getRepository(User).save({id:uid,name:uid===a?'A':'B',sports:['gym','walking'],createdAt:start,gamificationStartedAt:start});
  await db.getRepository(Match).save({user1_id:a,user2_id:b});
  await assert.rejects(challenges.create(a,{challengedId:outsider,sport:'gym',metric:'duration',target:10}));
  await assert.rejects(challenges.create(a,{challengedId:b,sport:'gym',metric:'duration',target:1000}));
  const c = await challenges.create(a,{challengedId:b,sport:'gym',metric:'duration',target:10,expiresInDays:3});
  await assert.rejects(challenges.respond(outsider,c.id,true));
  await challenges.respond(b,c.id,true);
  await assert.rejects(challenges.respond(b,c.id,true));
  await assert.rejects(challenges.complete(a,c.id));
  // Backdate only the test invitation, not application state.
  await db.getRepository(Challenge).update(c.id,{acceptedAt:new Date(now-4*3600000)});
  for (const uid of [a,b]) for (let i=0;i<5;i++) {
    const end = now-(i+1)*1200000;
    await db.getRepository(Activity).save({user_id:uid,sport:'gym',startTime:new Date(end-900000),endTime:new Date(end),duration:900,distance:0});
  }
  const results = await Promise.all([gamification.summary(a),gamification.summary(a)]);
  assert.equal(results[0].totalXP,results[1].totalXP,'retry must not increase XP');
  assert.equal(results[0].todayXP,100,'daily cap including missions/challenge');
  assert.ok(results[0].missions.some(m=>m.completed));
  const list = await challenges.list(a);
  assert.equal(list[0].status,'completed');
  assert.equal(list[0].winner_id,null,'no race for winner');
  assert.equal(list[0].progress.challenger.completed,true);
  assert.equal(list[0].progress.challenged.completed,true);
  assert.equal('email' in list[0].challenged,false);
  const sourceCount = await db.getRepository(Reward).count({where:{user_id:a,source:`challenge:${c.id}`}});
  assert.equal(sourceCount,1);
  const expired = await challenges.create(a,{challengedId:b,sport:'gym',metric:'duration',target:10});
  await db.getRepository(Challenge).update(expired.id,{expiresAt:new Date(now-1000)});
  await challenges.expireChallenges();
  assert.equal((await db.getRepository(Challenge).findOneBy({id:expired.id})).status,'expired');
  await db.getRepository(UserBlock).save({blocker_id:b,blocked_id:a});
  assert.deepEqual(await challenges.peers(a),[]);
  await assert.rejects(challenges.create(a,{challengedId:b,sport:'gym',metric:'duration',target:10}));
  assert.deepEqual(await challenges.list(a),[],'blocked counterpart must disappear');
  // Legacy XP is carried over once; completed old activities cannot mint new XP.
  const achievementType = Object.keys(ACHIEVEMENT_INFO)[0];
  await db.getRepository(UserAchievement).save({user_id:outsider,type:achievementType,unlockedAt:new Date(+start-1000)});
  const legacy = await gamification.summary(outsider);
  assert.equal(legacy.totalXP,ACHIEVEMENT_INFO[achievementType].xp);
  assert.equal((await gamification.summary(outsider)).totalXP,legacy.totalXP);
  // Profile changes do not reshuffle today's persisted plan.
  await db.getRepository(User).update(a,{sports:['cycling']});
  assert.deepEqual((await gamification.summary(a)).missions.map(m=>m.id),results[0].missions.map(m=>m.id));
  // Direct anonymous clients cannot award/read the reward ledger under RLS.
  await db.query('CREATE ROLE gamification_test_anon');
  await db.query('GRANT SELECT, INSERT ON gamification_rewards TO gamification_test_anon');
  await db.query('SET ROLE gamification_test_anon');
  assert.equal((await db.query('SELECT * FROM gamification_rewards')).length,0);
  await assert.rejects(db.query(`INSERT INTO gamification_rewards (user_id,source,day,xp) VALUES ($1,'forged',$2,100)`,[a,dayKey(new Date())]));
  await db.query('RESET ROLE');
  // Verify metadata for the real full entity graph separately (no schema writes).
  const full = new DataSource({type:'postgres',driver:{Pool},uuidExtension:'pgcrypto',installExtensions:false,entities:[require('node:path').join(__dirname,'../src/**/*.entity.ts')],synchronize:false});
  await full.initialize(); await full.destroy();
  console.log('PASS: migration twice; PostgreSQL transactions; cap/retry; missions; challenge acceptance, auto-completion, expiry; outsiders/blocks; minimal profiles; RLS.');
  await db.destroy(); await pg.close();
}
run().catch(async e => { console.error(e); process.exitCode=1; try { await pg.close(); } catch {} });
