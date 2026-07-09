import { IsString, MaxLength, MinLength } from "class-validator";

export class LoginCredentialsDto {
  @IsString()
  @MaxLength(254)
  @MinLength(3)
  identifier!: string;

  @IsString()
  @MaxLength(128)
  @MinLength(1)
  password!: string;
}
