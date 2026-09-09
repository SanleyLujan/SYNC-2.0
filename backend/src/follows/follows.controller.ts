import { Controller, Post, Delete, Get, Param, UseGuards, BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UserBlock } from '../users/entities/user-block.entity';
import { Follow } from './follow.entity';

@ApiTags('Follows')
@Controller('api/follows')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FollowsController {
  constructor(
    @InjectRepository(Follow) private readonly repo: Repository<Follow>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  private async accessible(viewer:string, target:string) {
    if (!await this.userRepo.existsBy({id:target,isActive:true,isProfileVisible:true})) return false;
    return !await this.repo.manager.getRepository(UserBlock).exists({where:[
      {blocker_id:viewer,blocked_id:target},{blocker_id:target,blocked_id:viewer},
    ]});
  }

  @Post(':userId')
  async follow(@CurrentUser() user: User, @Param('userId', ParseUUIDPipe) userId: string) {
    if (user.id===userId) throw new BadRequestException('Não pode seguir você mesmo');
    if (!await this.accessible(user.id,userId)) throw new BadRequestException('Perfil indisponível');
    await this.repo.createQueryBuilder().insert().values({follower_id:user.id,following_id:userId}).orIgnore().execute();
    // Resolve a block that may have been committed while the follow was inserted.
    if (!await this.accessible(user.id,userId)) {
      await this.repo.delete({follower_id:user.id,following_id:userId});
      throw new BadRequestException('Perfil indisponível');
    }
    return {ok:true,isFollowing:true};
  }

  @Delete(':userId')
  async unfollow(@CurrentUser() user: User, @Param('userId', ParseUUIDPipe) userId:string) {
    await this.repo.delete({follower_id:user.id,following_id:userId});
    return {ok:true,isFollowing:false};
  }

  @Get(':userId/status')
  async status(@CurrentUser() user: User, @Param('userId', ParseUUIDPipe) userId:string) {
    const visible=await this.accessible(user.id,userId);
    return {isFollowing: visible && await this.repo.existsBy({follower_id:user.id,following_id:userId})};
  }

  private visibleList(userId:string, direction:'following'|'follower') {
    const own=direction==='following'?'follower_id':'following_id';
    const qb=this.repo.createQueryBuilder('f').innerJoin('f.'+direction,'u')
      .where('f.'+own+' = :viewer',{viewer:userId}).andWhere('u.isActive = :active',{active:true}).andWhere('u.isProfileVisible = :visible',{visible:true})
      .andWhere('NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = :viewer AND b.blocked_id = u.id) OR (b.blocked_id = :viewer AND b.blocker_id = u.id))');
    return qb;
  }

  private async list(userId:string,direction:'following'|'follower') {
    return this.visibleList(userId,direction).select('u.id','id').addSelect('u.name','name')
      .addSelect('u.avatarUrl','avatarUrl').addSelect('CASE WHEN u.showLocation = true THEN u.city ELSE NULL END','city').addSelect('u.level','level')
      .addSelect('u.isVerified','isVerified').orderBy('f.createdAt','DESC').limit(500).getRawMany();
  }

  @Get('me/following')
  myFollowing(@CurrentUser() user:User) { return this.list(user.id,'following'); }
  @Get('me/followers')
  myFollowers(@CurrentUser() user:User) { return this.list(user.id,'follower'); }
  @Get('me/counts')
  async counts(@CurrentUser() user:User) {
    const [following,followers]=await Promise.all([this.visibleList(user.id,'following').getCount(),this.visibleList(user.id,'follower').getCount()]);
    return {following,followers};
  }
}
