import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class RefreshSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @MinLength(1)
  refreshToken?: string;
}
