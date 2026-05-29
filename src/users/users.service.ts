import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>, // Inyecta las herramientas de TypeORM para la tabla 'users'
  ) {}

  // 1. Lógica para registrar un nuevo usuario (Cifrando la contraseña)
  async create(username: string, passwordPlain: string): Promise<User> {
    // Verificamos si el nombre de usuario ya está tomado
    const exists = await this.userRepository.findOne({ where: { username } });
    if (exists) {
      throw new ConflictException(
        `El nombre de usuario '${username}' ya está registrado.`,
      );
    }

    // Ciframos la contraseña con 10 rondas
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);

    // Creamos la nueva instancia del usuario con el hash
    const newUser = this.userRepository.create({
      username,
      password_hash: passwordHash,
    });

    // Guardamos en la base de datos local
    return await this.userRepository.save(newUser);
  }

  // 2. Lógica para buscar un usuario por su Username
  async findOneByUsername(username: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { username } });
    return user;
  }

  // 3. Lógica auxiliar para buscar por ID
  async findOneById(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado.`);
    }
    return user;
  }
}
