import { Controller, Get, Module, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlacesService } from './places.service';

@Controller('api/places')
@UseGuards(JwtAuthGuard)
export class PlacesController {
  constructor(private readonly places: PlacesService) {}
  @Get('gyms/nearby')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  nearby(@Query('latitude') lat: string, @Query('longitude') lng: string) {
    return this.places.nearby(lat, lng);
  }
}

@Module({ controllers: [PlacesController], providers: [PlacesService] })
export class PlacesModule {}
