export class CreateUserDto {
  name: string;
  email: string;
  age?: number; // 선택적 필드
}
