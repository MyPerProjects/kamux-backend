import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Leemos directo de process.env asegurando que coincida al 100% con la firma de emisión
      secretOrKey:
        process.env.JWT_SECRET || 'ClaveSecretaUltraSeguraDeKamux2026',
    });
  }

  async validate(payload: { sub: number; username: string }) {
    const user = await this.usersService.findOneById(payload.sub);
    if (!user) {
      throw new UnauthorizedException(
        'Usuario no autorizado o no existe en el sistema.',
      );
    }

    return { id: user.id, username: user.username };
  }
}
