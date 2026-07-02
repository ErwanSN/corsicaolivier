import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class AuthCredentialsDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MaxLength(128)
  @MinLength(8)
  password!: string;
}
