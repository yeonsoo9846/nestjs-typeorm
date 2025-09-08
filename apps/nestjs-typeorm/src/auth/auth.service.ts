import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { LoginHistory } from '../entities/loginHistory.entity';
import { RefreshToken } from '../entities/refreshToken.entity';
import { User } from '../entities/user.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(LoginHistory)
    private loginHistoryRepository: Repository<LoginHistory>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await user.comparePassword(password))) {
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any, ipAddress: string) {
    const payload = { email: user.email, sub: user.id };
    
    // Access Token (5분)
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '5m',
    });

    // Refresh Token (7일)
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    // Refresh Token을 데이터베이스에 저장
    await this.saveRefreshToken(user.id, refreshToken);
    
    await this.recordLoginHistory(user.email, ipAddress);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  private async saveRefreshToken(userId: number, token: string) {
    // 기존 refresh token들을 revoke
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true },
    );

    // 새 refresh token 저장
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7일 후 만료

    const refreshToken = this.refreshTokenRepository.create({
      token,
      userId,
      expiresAt,
    });

    await this.refreshTokenRepository.save(refreshToken);
  }

  async refreshTokens(refreshToken: string) {
    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken, isRevoked: false },
      relations: ['user'],
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new Error('Invalid or expired refresh token');
    }

    const payload = { email: tokenRecord.user.email, sub: tokenRecord.user.id };
    
    // 새로운 Access Token 생성 (5분)
    const newAccessToken = this.jwtService.sign(payload, {
      expiresIn: '5m',
    });

    // 새로운 Refresh Token 생성 (7일)
    const newRefreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    // 기존 refresh token revoke하고 새로운 것 저장
    await this.refreshTokenRepository.update(tokenRecord.id, { isRevoked: true });
    await this.saveRefreshToken(tokenRecord.user.id, newRefreshToken);

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
  }

  async revokeRefreshToken(refreshToken: string) {
    await this.refreshTokenRepository.update(
      { token: refreshToken },
      { isRevoked: true },
    );
  }

  private async recordLoginHistory(email: string, ipAddress: string) {
    const loginHistory = this.loginHistoryRepository.create({
      email,
      ipAddress,
    });
    await this.loginHistoryRepository.save(loginHistory);
  }
}
