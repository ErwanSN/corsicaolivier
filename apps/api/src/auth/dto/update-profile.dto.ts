import { IsString, Matches, MaxLength, MinLength } from "class-validator";
import { usernameMaxLength, usernameMinLength } from "@corsica/contracts";

export class UpdateProfileDto {
  @IsString()
  @MinLength(usernameMinLength)
  @MaxLength(usernameMaxLength)
  @Matches(/^[a-z0-9._-]+$/i)
  username!: string;
}
