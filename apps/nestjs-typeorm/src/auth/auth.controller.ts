import {
  Body,
  Controller,
  Post,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';

import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req, @Body() loginDto: LoginDto, @Response() res) {
    const clientIp = req.ip || req.connection.remoteAddress || '0.0.0.0';
    const result = await this.authService.login(req.user, clientIp);

    // Refresh Token을 httpOnly 쿠키로 설정
    res.cookie('refreshToken', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS에서만
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    });

    // Access Token만 응답으로 반환
    const { refresh_token, ...response } = result;
    res.json(response);
  }

  @Post('refresh')
  async refreshToken(@Request() req, @Response() res) {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token not found' });
    }

    try {
      const result = await this.authService.refreshTokens(refreshToken);

      // 새로운 Refresh Token을 httpOnly 쿠키로 설정
      res.cookie('refreshToken', result.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      });

      // Access Token만 응답으로 반환
      const { refresh_token, ...response } = result;
      res.json(response);
    } catch (error) {
      res.status(401).json({ message: 'Invalid refresh token' });
    }
  }

  @Post('logout')
  async logout(@Request() req, @Response() res) {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken);
    }

    // 쿠키 제거
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
  }
}
