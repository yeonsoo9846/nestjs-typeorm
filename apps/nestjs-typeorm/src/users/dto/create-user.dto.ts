export class CreateUserDto {
  name: string;
  email: string;
  password: string; // 필수 필드
  age?: number; // 선택적 필드
}
