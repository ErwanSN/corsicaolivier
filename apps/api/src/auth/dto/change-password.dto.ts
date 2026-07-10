import { IsString, MaxLength, MinLength } from "class-validator";

export class ChangePasswordDto {
  @IsString()
  @MaxLength(128)
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MaxLength(128)
  @MinLength(8)
  newPassword!: string;
}
