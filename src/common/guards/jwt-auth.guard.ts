import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = (await super.canActivate(context)) as boolean;
    return result;
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException(
          'Acceso denegado. Token inválido o no proporcionado.',
        )
      );
    }
    return user;
  }
}
