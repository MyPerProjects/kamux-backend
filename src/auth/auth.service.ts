import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // 1. Validar si las credenciales coinciden usando Bcrypt
  async validateUser(
    username: string,
    passwordPlain: string,
  ): Promise<{ id: number; username: string }> {
    const user = await this.usersService.findOneByUsername(username);

    // Si el usuario no existe, o milagrosamente falta algún campo crítico, rechazamos de inmediato
    if (
      !user ||
      !user.password_hash ||
      user.id === undefined ||
      !user.username
    ) {
      throw new UnauthorizedException(
        'Credenciales inválidas. Verifica tu usuario o contraseña.',
      );
    }

    // Al pasar el IF anterior, TypeScript ya sabe con total certeza que 'user.password_hash' es un string real
    const isPasswordValid = await bcrypt.compare(
      passwordPlain,
      user.password_hash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Credenciales inválidas. Verifica tu usuario o contraseña.',
      );
    }

    // Retornamos mapeando los valores garantizados como obligatorios
    return {
      id: user.id,
      username: user.username,
    };
  }

  // 2. Generar el token JWT oficial de Kamux
  login(user: { id: number; username: string }) {
    const payload = {
      username: user.username,
      sub: user.id,
    };

    return {
      message: 'Inicio de sesión exitoso',
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
      },
    };
  }
}
